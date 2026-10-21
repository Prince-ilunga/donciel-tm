import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, createToken, setAuthCookie, ADMIN_EMAIL, isSecureRequest } from '@/lib/auth';
import { sendWelcomeEmail } from '@/lib/email';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;
    const normalizedEmail = typeof email === 'string' ? email.trim().toLowerCase() : '';

    if (!normalizedEmail || !password) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    const existingUser = await db.user.findUnique({ where: { email: normalizedEmail } });
    if (existingUser) {
      return NextResponse.json(
        { error: 'Cet email est déjà utilisé' },
        { status: 409 }
      );
    }

    const hashedPassword = await hashPassword(password);
    const isAdminEmail = normalizedEmail === ADMIN_EMAIL;

    // SaaS self-service: approve by default unless manual approval is enabled.
    const autoApprove = process.env.AUTO_APPROVE_REGISTRATIONS !== 'false';
    const status = isAdminEmail || autoApprove ? 'approved' : 'pending';

    const user = await db.user.create({
      data: {
        email: normalizedEmail,
        password: hashedPassword,
        name: name || null,
        role: isAdminEmail ? 'admin' : 'user',
        status,
      },
    });

    // Welcome email (non-blocking failure)
    sendWelcomeEmail(user.email, user.name).catch(() => {});

    if (status === 'approved') {
      const token = await createToken({
        id: user.id,
        email: user.email,
        role: user.role,
      });

      const response = NextResponse.json(
        {
          message: 'Inscription réussie',
          user: {
            id: user.id,
            email: user.email,
            name: user.name,
            role: user.role,
            status: user.status,
            language: user.language,
          },
        },
        { status: 201 }
      );

      response.headers.set('Set-Cookie', setAuthCookie(token, isSecureRequest(request)));
      return response;
    }

    return NextResponse.json(
      {
        message: 'Inscription réussie. Votre compte est en attente d\'approbation.',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          status: user.status,
          language: user.language,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Register error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'inscription' },
      { status: 500 }
    );
  }
}
