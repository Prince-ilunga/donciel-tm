import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/onboarding/status
 * État d'avancement de l'onboarding, déduit des données réelles
 * de l'utilisateur (aucune migration nécessaire) :
 *  - a configuré son money management (RiskProfile) ?
 *  - a créé au moins un playbook ?
 *  - a journalisé au moins un trade ?
 */
export async function GET() {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }

    const userId = result.user.id;

    const [riskProfile, playbookCount, tradeCount] = await Promise.all([
      db.riskProfile.findUnique({ where: { userId }, select: { id: true, initialCapital: true } }),
      db.playbook.count({ where: { userId } }),
      db.trade.count({ where: { userId } }),
    ]);

    return NextResponse.json({
      hasCapital: Boolean(riskProfile && riskProfile.initialCapital > 0),
      hasPlaybook: playbookCount > 0,
      hasTrade: tradeCount > 0,
      tradeCount,
      playbookCount,
    });
  } catch (error) {
    console.error('Onboarding status error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
