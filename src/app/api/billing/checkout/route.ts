import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getStripe, appUrl } from '@/lib/stripe';
import { getStripePriceId, PlanInterval, PlanId } from '@/lib/plans';

export const dynamic = 'force-dynamic';

// POST /api/billing/checkout  { plan: "PRO"|"ELITE", interval: "monthly"|"yearly" }
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: 401 });

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: 'Paiement non configuré. Ajoute STRIPE_SECRET_KEY dans les variables d\'environnement.' },
        { status: 503 }
      );
    }

    const body = await request.json();
    const plan = body.plan as PlanId;
    const interval = (body.interval || 'monthly') as PlanInterval;

    if (plan !== 'PRO' && plan !== 'ELITE') {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }

    const priceId = getStripePriceId(plan, interval);
    if (!priceId) {
      return NextResponse.json(
        { error: `Prix Stripe non configuré pour ${plan} ${interval}. Ajoute la variable d'environnement correspondante.` },
        { status: 503 }
      );
    }

    // Find or create the Stripe customer
    let customerId = auth.user ? (await db.user.findUnique({ where: { id: auth.user.id }, select: { stripeCustomerId: true } }))?.stripeCustomerId : null;
    if (!customerId) {
      const customer = await stripe.customers.create({
        email: auth.user!.email,
        name: auth.user!.name || undefined,
        metadata: { userId: auth.user!.id },
      });
      customerId = customer.id;
      await db.user.update({ where: { id: auth.user!.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: priceId, quantity: 1 }],
      subscription_data: {
        metadata: { userId: auth.user!.id, plan },
      },
      allow_promotion_codes: true,
      success_url: `${appUrl()}/app?upgraded=1`,
      cancel_url: `${appUrl()}/abonnement?canceled=1`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Checkout error:', error);
    return NextResponse.json({ error: 'Erreur lors de la création de la session de paiement' }, { status: 500 });
  }
}
