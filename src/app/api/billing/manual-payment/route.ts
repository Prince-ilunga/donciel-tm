import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { PLANS, PlanId, PlanInterval } from '@/lib/plans';
import { mobileMoneyConfig } from '@/lib/paddle';

export const dynamic = 'force-dynamic';

const METHODS = ['MPESA', 'AIRTEL', 'ORANGE'] as const;

// POST /api/billing/manual-payment
// L'utilisateur déclare un paiement mobile money (M-Pesa / Airtel / Orange)
// qu'un administrateur devra valider pour activer le plan.
export async function POST(request: NextRequest) {
  try {
    const auth = await getAuthUser();
    if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });

    const body = await request.json().catch(() => null);
    const plan = body?.plan as PlanId;
    const interval = body?.interval as PlanInterval;
    const method = body?.method as string;
    const reference = String(body?.reference || '').trim();
    const phone = String(body?.phone || '').trim();

    if (plan !== 'PRO' && plan !== 'ELITE') {
      return NextResponse.json({ error: 'Plan invalide' }, { status: 400 });
    }
    if (interval !== 'monthly' && interval !== 'yearly') {
      return NextResponse.json({ error: 'Intervalle invalide' }, { status: 400 });
    }
    if (!METHODS.includes(method as (typeof METHODS)[number])) {
      return NextResponse.json({ error: 'Opérateur mobile invalide' }, { status: 400 });
    }
    if (reference.length < 4) {
      return NextResponse.json({ error: 'Référence de transaction trop courte (min. 4 caractères)' }, { status: 400 });
    }
    if (phone.length < 8) {
      return NextResponse.json({ error: 'Numéro de téléphone invalide' }, { status: 400 });
    }

    if (!mobileMoneyConfig()) {
      return NextResponse.json({ error: 'Le paiement mobile money n\'est pas activé' }, { status: 503 });
    }

    // Une seule demande en attente à la fois
    const existing = await db.paymentRequest.findFirst({
      where: { userId: auth.user.id, status: 'PENDING' },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: 'Tu as déjà une demande en attente de validation' },
        { status: 409 }
      );
    }

    const planDef = PLANS[plan];
    const amount = interval === 'yearly' ? planDef.priceYearly : planDef.priceMonthly;

    const created = await db.paymentRequest.create({
      data: {
        userId: auth.user.id,
        plan,
        interval,
        method,
        amount,
        currency: 'USD',
        reference,
        phone,
      },
      select: { id: true, plan: true, interval: true, amount: true, status: true, createdAt: true },
    });

    return NextResponse.json({ request: created }, { status: 201 });
  } catch (error) {
    console.error('Manual payment error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'envoi de la demande' }, { status: 500 });
  }
}

// GET /api/billing/manual-payment → les demandes de l'utilisateur connecté
export async function GET() {
  try {
    const auth = await getAuthUser();
    if (auth.error || !auth.user) return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });

    const requests = await db.paymentRequest.findMany({
      where: { userId: auth.user.id },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: {
        id: true, plan: true, interval: true, method: true,
        amount: true, currency: true, status: true, adminNote: true, createdAt: true,
      },
    });

    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Manual payment list error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
