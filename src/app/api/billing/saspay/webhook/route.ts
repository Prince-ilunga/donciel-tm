import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { verifySaspayWebhookSignature, getSaspaySessionStatus } from '@/lib/saspay';
import { activateSaspaySession } from '@/lib/saspay-activate';

export const dynamic = 'force-dynamic';

// ─── Types minimaux du payload SasPay ────────────────────────
interface SaspayTransactionData {
  id: string;
  reference?: string;
  type?: string;
  status?: string;
  amount?: string;
  charged?: string;
  net_amount?: string;
  currency?: string;
  country?: string;
  network?: string;
  msisdn?: string;
  metadata?: Record<string, unknown> | null;
}
interface SaspayEvent {
  event: string;
  data: SaspayTransactionData;
}

// POST /api/billing/saspay/webhook  (appelé par SasPay — corps brut requis)
// Événements attendus : transaction.success / transaction.failed / webhook.test
// Filet de sécurité du flux principal (polling au retour du client) :
// SasPay ne transmet pas systématiquement les métadonnées de session dans
// le payload, on rattache donc la transaction à une session locale en
// comparant les statuts interrogés côté gateway.
export async function POST(request: NextRequest) {
  const webhookSecret = process.env.SASPAY_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return NextResponse.json({ error: 'Webhook non configuré' }, { status: 503 });
  }

  const rawBody = await request.text();
  const signature = request.headers.get('x-webhook-signature');
  const timestamp = request.headers.get('x-webhook-timestamp');

  const valid = await verifySaspayWebhookSignature(rawBody, signature, timestamp, webhookSecret);
  if (!valid) {
    console.error('[SASPAY WEBHOOK] signature invalide');
    return NextResponse.json({ error: 'Signature invalide' }, { status: 401 });
  }

  let event: SaspayEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: 'JSON invalide' }, { status: 400 });
  }

  try {
    switch (event.event) {
      case 'webhook.test': {
        console.log('[SASPAY WEBHOOK] event de test reçu');
        break;
      }
      case 'transaction.success': {
        const tx = event.data;
        // 1. Lien direct via metadata (si SasPay les transmet)
        const meta = tx.metadata as { userId?: string; plan?: string; interval?: string } | null;
        let row = null as null | { id: string; status: string };

        if (meta?.userId) {
          row = await db.saspaySession.findFirst({
            where: { userId: meta.userId, status: 'PENDING' },
            orderBy: { createdAt: 'desc' },
            select: { id: true, status: true },
          });
        }

        // 2. Sinon : rattacher en comparant les transactions des sessions
        //    locales récentes (même montant/devise, session toujours PENDING)
        if (!row) {
          const amount = parseFloat(String(tx.amount ?? '0'));
          const candidates = await db.saspaySession.findMany({
            where: {
              status: 'PENDING',
              createdAt: { gte: new Date(Date.now() - 24 * 3600 * 1000) },
              ...(Number.isFinite(amount) && amount > 0 ? { amount } : {}),
              ...(tx.currency ? { currency: tx.currency } : {}),
            },
            orderBy: { createdAt: 'desc' },
            take: 10,
            select: { id: true, sessionId: true, transactionId: true, status: true },
          });
          for (const candidate of candidates) {
            try {
              const status = await getSaspaySessionStatus(candidate.sessionId);
              if (status && (status.transaction_id === tx.id || status.status === 'PAID')) {
                row = { id: candidate.id, status: candidate.status };
                if (status.transaction_id && !candidate.transactionId) {
                  await db.saspaySession.update({
                    where: { id: candidate.id },
                    data: { transactionId: status.transaction_id },
                  });
                }
                break;
              }
            } catch {
              // session suivante
            }
          }
        }

        if (row) {
          await activateSaspaySession(row.id);
        } else {
          console.warn('[SASPAY WEBHOOK] transaction réussie sans session locale correspondante :', tx.id);
        }
        break;
      }
      case 'transaction.failed':
      case 'transaction.cancelled': {
        // Rien à faire : la session locale reste PENDING et expire d'elle-même.
        break;
      }
      default:
        break;
    }
  } catch (error) {
    console.error(`[SASPAY WEBHOOK] handler error (${event.event}):`, error);
    return NextResponse.json({ error: 'Erreur de traitement' }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
