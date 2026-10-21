import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getPlan, stripeConfigured } from '@/lib/plans';

export const dynamic = 'force-dynamic';

// GET /api/billing/subscription → current plan + usage for the UI
export async function GET(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });

    const user = await db.user.findUnique({
      where: { id: auth.user.id },
      select: {
        plan: true,
        planStatus: true,
        planInterval: true,
        currentPeriodEnd: true,
        role: true,
        stripeCustomerId: true,
        stripeSubscriptionId: true,
      },
    });

    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    const plan = user.role === 'admin' ? getPlan('ELITE') : getPlan(user.plan);

    return NextResponse.json({
      plan: plan.id,
      planName: plan.name,
      planStatus: user.planStatus,
      interval: user.planInterval,
      currentPeriodEnd: user.currentPeriodEnd,
      isAdmin: user.role === 'admin',
      hasSubscription: Boolean(user.stripeSubscriptionId),
      billingConfigured: stripeConfigured(),
    });
  } catch (error) {
    console.error('Subscription fetch error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération de l\'abonnement' }, { status: 500 });
  }
}
