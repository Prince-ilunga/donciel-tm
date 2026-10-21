import { NextRequest, NextResponse } from 'next/server';
import { createHash, randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { sendPasswordResetEmail, emailConfigured } from '@/lib/email';

export const dynamic = 'force-dynamic';

// POST /api/auth/forgot-password  { email }
export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Email requis' }, { status: 400 });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await db.user.findUnique({ where: { email: normalizedEmail } });

    // Always answer OK to avoid leaking which emails are registered.
    const genericResponse = {
      message: emailConfigured()
        ? "Si un compte existe avec cet email, un lien de réinitialisation vient d'être envoyé."
        : 'Demande enregistrée. Le lien de réinitialisation a été généré (mode développement : il figure dans les logs du serveur).',
      emailConfigured: emailConfigured(),
    };

    if (!user || user.status !== 'approved') {
      return NextResponse.json(genericResponse);
    }

    // Invalidate previous tokens
    await db.passwordResetToken.deleteMany({ where: { userId: user.id } });

    const rawToken = randomBytes(32).toString('hex');
    const tokenHash = createHash('sha256').update(rawToken).digest('hex');

    await db.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000), // 1 hour
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

    await sendPasswordResetEmail(user.email, resetUrl);

    // In dev (no email provider), return the link so the flow is testable.
    if (!emailConfigured()) {
      return NextResponse.json({ ...genericResponse, devResetUrl: resetUrl });
    }
    return NextResponse.json(genericResponse);
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: "Erreur lors de la demande de réinitialisation" }, { status: 500 });
  }
}
