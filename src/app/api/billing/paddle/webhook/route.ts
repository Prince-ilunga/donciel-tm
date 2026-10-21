import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyPaddleSignature,
  planFromPaddlePriceId,
  intervalFromPaddlePriceId,
} from '@/lib/paddle';

export const dynamic = 'force-dynamic';

// ─── Types minimaux du payload Paddle ────────────────────────
interface PaddleSubItem {
  price?: { id?: string };
  status?: string;
}
interface PaddleSubscriptionData {
  id: string;
  status: string; // active, trialing, past_due, paused, canceled
  customer_id: string;
  items?: PaddleSubItem[];
  custom_data?: { userId?: string; plan?: string } | null;
  current_billing_period?: { starts_at?: string; ends_at?: string } | null;
}
interface PaddleTransactionData {
  id: string;
  subscription_id?: string;
  customer_id?: string;
  custom_data?: { userId?: string } | null;
}
interface PaddleEvent {
  event_type: string;
  data: PaddleSubscriptionData | PaddleTransactionData;
}

async function syncSubscription(sub: PaddleSubscriptionData) {
  const priceId = sub.items?.[0]?.price?.id ?? null;
  const plan = planFromPaddlePriceId(priceId) ?? (sub.custom_data?.plan as 'PRO' | 'ELITE' | null) ?? null;

  // Resolve the user: prefer custom_data, fall back to paddleCustomerId
  let targetUserId: string | undefined = sub.custom_data?.userId;
  if (!targetUserId) {
    const user = await db.user.findUnique({
      where: { paddleCustomerId: sub.customer_id },
      select: { id: true },
    });
    targetUserId = user?.id;
  }
  if (!targetUserId) {
    console.warn('[PADDLE WEBHOOK] utilisateur introuvable pour', sub.customer_id);
    return;
  }

  if (sub.status === 'canceled') {
    await db.user.update({
      where: { id: targetUserId },
      data: {
        plan: 'FREE',
        planStatus: 'canceled',
        paddleSubscriptionId: null,
        paddlePriceId: null,
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
      planStatus: sub.status === 'paused' ? 'past_due' : sub.status, // active, trialing, past_due
      paddleSubscriptionId: sub.id,
      paddleCustomerId: sub.customer_id,
      paddlePriceId: priceId,
      planInterval: intervalFromPaddlePriceId(priceId),
      currentPeriodEnd: sub.current_billing_period?.ends_at
        ? new Date(sub.current_billing_period.ends_at)
        : null,
    },
  });
}

// POST /api/billing/paddle/webhook  (called by Paddle — raw body required)
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.PADDLE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('paddle-signature');

  const valid = await verifyPaddleSignature(rawBody, signature, webhookSecret);
  if (!valid) {
    console.error('[PADDLE WEBHOOK] signature invalide');
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
  }

  let event: PaddleEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  try {
    switch (event.event_type) {
      case 'transaction.completed': {
        const tx = event.data as PaddleTransactionData;
        // Mémorise le client Paddle dès la première transaction
        if (tx.custom_data?.userId && tx.customer_id) {
          await db.user.update({
            where: { id: tx.custom_data.userId },
            data: { paddleCustomerId: tx.customer_id },
          }).catch(() => undefined);
        }
        break;
      }
      case 'subscription.created':
      case 'subscription.activated':
      case 'subscription.updated':
      case 'subscription.resumed':
      case 'subscription.canceled': {
        await syncSubscription(event.data as PaddleSubscriptionData);
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`[PADDLE WEBHOOK] handler error (${event.event_type}):`, error);
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
