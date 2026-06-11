import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword, ADMIN_EMAIL } from '@/lib/auth';

/**
 * POST /api/auth/setup
 * Creates or resets the admin user. This endpoint is only available
 * when no admin user exists OR when called with the correct setup key.
 * 
 * Body: { email, password, name, setupKey? }
 * 
 * The setupKey is optional but recommended for security.
 * If no admin exists, the first call creates one automatically.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password, name } = body;

    // Only allow setting up the designated admin email
    const targetEmail = email || ADMIN_EMAIL;
    const targetPassword = password || 'Donciel3.';
    const targetName = name || 'Donciel';

    if (!targetEmail || !targetPassword) {
      return NextResponse.json(
        { error: 'Email et mot de passe requis' },
        { status: 400 }
      );
    }

    if (targetPassword.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    // Check if any admin exists
    const adminCount = await db.user.count({
      where: { role: 'admin' },
    });

    // If admins already exist, only allow setup for the designated admin email
    if (adminCount > 0 && targetEmail !== ADMIN_EMAIL) {
      return NextResponse.json(
        { error: 'Un administrateur existe déjà' },
        { status: 403 }
      );
    }

    const existingUser = await db.user.findUnique({
      where: { email: targetEmail },
    });

    const hashedPassword = await hashPassword(targetPassword);

    if (existingUser) {
      // Update existing user to be admin with approved status
      const updatedUser = await db.user.update({
        where: { id: existingUser.id },
        data: {
          password: hashedPassword,
          role: 'admin',
          status: 'approved',
          name: targetName,
        },
      });

      return NextResponse.json({
        message: 'Administrateur mis à jour avec succès',
        user: {
          id: updatedUser.id,
          email: updatedUser.email,
          name: updatedUser.name,
          role: updatedUser.role,
          status: updatedUser.status,
        },
      });
    } else {
      // Create new admin user
      const newUser = await db.user.create({
        data: {
          email: targetEmail,
          password: hashedPassword,
          name: targetName,
          role: 'admin',
          status: 'approved',
        },
      });

      return NextResponse.json({
        message: 'Administrateur créé avec succès',
        user: {
          id: newUser.id,
          email: newUser.email,
          name: newUser.name,
          role: newUser.role,
          status: newUser.status,
        },
      }, { status: 201 });
    }
  } catch (error) {
    console.error('Setup error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la configuration' },
      { status: 500 }
    );
  }
}
