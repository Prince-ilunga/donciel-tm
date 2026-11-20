import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, demoReadonlyGuard } from '@/lib/auth';
import { PLANS, PlanId, PlanInterval } from '@/lib/plans';
import { createSaspayCheckoutSession, saspayConfigured } from '@/lib/saspay';
import { appUrl } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/billing/saspay/checkout  { plan: "PRO"|"ELITE", interval: "monthly"|"yearly" }
// Crée une session de checkout hébergée SasPay (montant en USD) et
// renvoie l'URL de la page de paiement à ouvrir.
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });

    if (!saspayConfigured()) {
      return NextResponse.json(
        { error: 'Le paiement SasPay n\'est pas activé. Ajoute SASPAY_API_KEY dans les variables d\'environnement.' },
        { status: 503 }
      );
    }

    // Compte démo : lecture seule
    const demoGuard = demoReadonlyGuard(auth.user.email);
    if (demoGuard) return demoGuard;

    const body = await request.json().catch(() => null);
    const plan = body?.plan as PlanId;
    const interval = (body?.interval || 'monthly') as PlanInterval;

    if (plan !== 'PRO' && plan !== 'ELITE') {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }
    if (interval !== 'monthly' && interval !== 'yearly') {
      return NextResponse.json({ error: 'Intervalle invalide' }, { status: 400 });
    }

    const planDef = PLANS[plan];
    const amount = interval === 'yearly' ? planDef.priceYearly : planDef.priceMonthly;

    // 1. Session SasPay (checkout hébergé, devise USD)
    const description = `DONCIEL TM — Plan ${planDef.name} (${interval === 'yearly' ? 'annuel' : 'mensuel'})`;
    const session = await createSaspayCheckoutSession({
      amount: amount.toFixed(2),
      currency: 'USD',
      description,
      customerEmail: auth.user.email,
      customerName: auth.user.name || auth.user.email,
      returnUrl: `${appUrl()}/abonnement?saspay=return`,
      metadata: { userId: auth.user.id, plan, interval },
    });

    // 2. Trace locale pour l'activation (webhook ou polling au retour)
    await db.saspaySession.create({
      data: {
        sessionId: session.id,
        userId: auth.user.id,
        plan,
        interval,
        amount,
        currency: 'USD',
        status: 'PENDING',
      },
    });

    // return_url : SasPay ne supporte pas les placeholders — reconstruire avec le vrai id
    return NextResponse.json({ url: session.checkout_url, sessionId: session.id });
  } catch (error) {
    console.error('SasPay checkout error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Erreur lors de la création du paiement SasPay' },
      { status: 500 }
    );
  }
}
