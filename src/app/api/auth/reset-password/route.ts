import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// POST /api/auth/reset-password  { token, password }
export async function POST(request: NextRequest) {
  try {
    const { token, password } = await request.json();

    if (!token || typeof token !== 'string') {
      return NextResponse.json({ error: 'Token manquant' }, { status: 400 });
    }
    if (!password || typeof password !== 'string' || password.length < 6) {
      return NextResponse.json(
        { error: 'Le mot de passe doit contenir au moins 6 caractères' },
        { status: 400 }
      );
    }

    const tokenHash = createHash('sha256').update(token).digest('hex');
    const resetToken = await db.passwordResetToken.findUnique({
      where: { tokenHash },
      include: { user: true },
    });

    if (!resetToken || resetToken.usedAt || resetToken.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Lien invalide ou expiré. Refais une demande de réinitialisation.' },
        { status: 400 }
      );
    }

    const hashed = await hashPassword(password);

    // Atomic: consume the token + update the password
    await db.$transaction([
      db.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      db.user.update({
        where: { id: resetToken.userId },
        data: { password: hashed },
      }),
    ]);

    return NextResponse.json({ message: 'Mot de passe mis à jour. Tu peux te connecter.' });
  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Erreur lors de la réinitialisation' }, { status: 500 });
  }
}
