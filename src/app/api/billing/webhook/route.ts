import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { db } from '@/lib/db';
import { getStripe } from '@/lib/stripe';

export const dynamic = 'force-dynamic';

// Map a Stripe price ID back to the plan (from environment configuration)
function planFromPriceId(priceId: string | null | undefined): 'PRO' | 'ELITE' | null {
  if (!priceId) return null;
  if (
    priceId === process.env.STRIPE_PRICE_PRO_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_PRO_YEARLY
  ) return 'PRO';
  if (
    priceId === process.env.STRIPE_PRICE_ELITE_MONTHLY ||
    priceId === process.env.STRIPE_PRICE_ELITE_YEARLY
  ) return 'ELITE';
  return null;
}

function intervalFromPriceId(priceId: string | null | undefined): 'monthly' | 'yearly' | null {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO_YEARLY || priceId === process.env.STRIPE_PRICE_ELITE_YEARLY) return 'yearly';
  if (priceId === process.env.STRIPE_PRICE_PRO_MONTHLY || priceId === process.env.STRIPE_PRICE_ELITE_MONTHLY) return 'monthly';
  return null;
}

async function syncSubscription(subscription: Stripe.Subscription) {
  const userId = subscription.metadata?.userId;
  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const plan = planFromPriceId(priceId) ?? (subscription.metadata?.plan as 'PRO' | 'ELITE' | null);

  // Resolve the user: prefer metadata, fall back to the Stripe customer
  let targetUserId: string | undefined = userId;
  if (!targetUserId && typeof subscription.customer === 'string') {
    const user = await db.user.findUnique({ where: { stripeCustomerId: subscription.customer }, select: { id: true } });
    targetUserId = user?.id;
  }
  if (!targetUserId) return;

  if (subscription.status === 'canceled' || subscription.status === 'unpaid') {
    await db.user.update({
      where: { id: targetUserId },
      data: {
        plan: 'FREE',
        planStatus: 'canceled',
        stripeSubscriptionId: null,
        stripePriceId: null,
        planInterval: null,
        currentPeriodEnd: null,
      },
    });
    return;
  }

  if (!plan) return;

  await db.user.update({
    where: { id: targetUserId },
    data: {
      plan,
      planStatus: subscription.status, // active, trialing, past_due...
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      planInterval: intervalFromPriceId(priceId),
      currentPeriodEnd: new Date((subscription as unknown as { current_period_end: number }).current_period_end * 1000),
    },
  });
}

// POST /api/billing/webhook  (called by Stripe — raw body required)
export async function POST(request: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!stripe || !webhookSecret) {
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) {
    return NextResponse.json({ error: 'Signature manquante' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    const rawBody = await request.text();
    event = stripe.webhooks.constructEvent(rawBody, signature, webhookSecret);
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return NextResponse.json({ error: 'Signature invalide' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode === 'subscription' && typeof session.subscription === 'string') {
          const subscription = await stripe.subscriptions.retrieve(session.subscription);
          await syncSubscription(subscription);
        }
        break;
      }
      case 'customer.subscription.updated':
      case 'customer.subscription.created': {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case 'customer.subscription.deleted': {
        await syncSubscription(event.data.object as Stripe.Subscription);
        break;
      }
      case 'invoice.payment_failed': {
        const invoice = event.data.object as Stripe.Invoice;
        if (typeof invoice.customer === 'string') {
          await db.user.updateMany({
            where: { stripeCustomerId: invoice.customer },
            data: { planStatus: 'past_due' },
          });
        }
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`Webhook handler error (${event.type}):`, error);
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
