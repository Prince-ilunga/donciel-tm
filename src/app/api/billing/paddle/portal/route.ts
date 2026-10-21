import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { createPaddlePortalSession, paddleConfigured } from '@/lib/paddle';

export const dynamic = 'force-dynamic';

// POST /api/billing/paddle/portal → ouvre le portail client Paddle
export async function POST(_request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });

    if (!paddleConfigured()) {
      return NextResponse.json({ error: 'Le paiement n\'est pas encore configuré' }, { status: 503 });
    }

    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { paddleCustomerId: true },
    });

    if (!user?.paddleCustomerId) {
      return NextResponse.json(
        { error: 'Aucun abonnement Paddle trouvé. Utilise d\'abord le checkout.' },
        { status: 400 }
      );
    }

    const url = await createPaddlePortalSession(user.paddleCustomerId);
    if (!url) {
      return NextResponse.json({ error: 'Impossible d\'ouvrir le portail pour le moment' }, { status: 502 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Paddle portal error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
