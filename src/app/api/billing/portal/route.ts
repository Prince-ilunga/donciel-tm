import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getStripe, appUrl } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// POST /api/billing/portal → Stripe customer portal (manage card, cancel, invoices)
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });

    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json({ error: 'Paiement non configuré' }, { status: 503 });
    }

    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: { stripeCustomerId: true },
    });

    if (!user?.stripeCustomerId) {
      return NextResponse.json(
        { error: 'Aucun abonnement à gérer. Souscris d\'abord à un plan.' },
        { status: 400 }
      );
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${appUrl()}/abonnement`,
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error('Portal error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'ouverture du portail de gestion' }, { status: 500 });
  }
}
