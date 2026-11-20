import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getSaspaySessionStatus, saspayConfigured } from '@/lib/saspay';
import { activateSaspaySession } from '@/lib/saspay-activate';

export const dynamic = 'force-dynamic';

// GET /api/billing/saspay/status[?session={sessionId}]
// Interroge SasPay (qui revérifie toujours l'état réel côté gateway) et
// active le plan si le paiement est confirmé. Sans paramètre `session`,
// on prend la session la plus récente de l'utilisateur (flux retour).
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });

    if (!saspayConfigured()) {
      return NextResponse.json({ error: 'SasPay non configuré' }, { status: 503 });
    }

    const sessionIdParam = request.nextUrl.searchParams.get('session');
    const row = sessionIdParam
      ? await db.saspaySession.findFirst({
          where: { sessionId: sessionIdParam, userId: auth.user.id },
          orderBy: { createdAt: 'desc' },
        })
      : await db.saspaySession.findFirst({
          where: { userId: auth.user.id, createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) } },
          orderBy: { createdAt: 'desc' },
        });

    if (!row) return NextResponse.json({ error: 'Session introuvable' }, { status: 404 });

    if (row.status === 'PAID') {
      return NextResponse.json({ paid: true, status: 'PAID', plan: row.plan, interval: row.interval });
    }

    const status = await getSaspaySessionStatus(row.sessionId);
    if (!status) return NextResponse.json({ paid: false, status: 'NOT_FOUND' });

    const paid =
      status.status === 'PAID' ||
      status.transaction_status === 'SUCCESS';

    if (paid) {
      await db.saspaySession.update({
        where: { id: row.id },
        data: { transactionId: status.transaction_id ?? null },
      });
      await activateSaspaySession(row.id);
      return NextResponse.json({ paid: true, status: 'PAID', plan: row.plan, interval: row.interval });
    }

    return NextResponse.json({ paid: false, status: status.status || 'PENDING' });
  } catch (error) {
    console.error('SasPay status error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la vérification du paiement' },
      { status: 500 }
    );
  }
}
