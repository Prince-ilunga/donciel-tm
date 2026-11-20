// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Activation d'un plan après paiement SasPay
// Paiement à l'acte (non récurrent) : on prolonge la période de
// 30 jours (mensuel) ou 365 jours (annuel), même sémantique que
// l'approbation manuelle mobile money par un administrateur.
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db';
import { sendPlanActivatedEmail } from '@/lib/email';

/**
 * Active le plan d'un utilisateur après un paiement SasPay confirmé.
 * Idempotent : renvoie true si la session était déjà activée.
 */
export async function activateSaspaySession(rowId: string): Promise<boolean> {
  const row = await db.saspaySession.findUnique({
    where: { id: rowId },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!row) return false;
  if (row.status === 'PAID') return true;

  const periodEnd = new Date();
  periodEnd.setDate(periodEnd.getDate() + (row.interval === 'yearly' ? 365 : 30));

  await db.$transaction([
    db.saspaySession.update({
      where: { id: row.id },
      data: { status: 'PAID', activatedAt: new Date() },
    }),
    db.user.update({
      where: { id: row.userId },
      data: {
        plan: row.plan,
        planStatus: 'active',
        planInterval: row.interval,
        currentPeriodEnd: periodEnd,
      },
    }),
  ]);

  await sendPlanActivatedEmail(
    row.user.email,
    row.plan,
    row.interval === 'yearly' ? 12 : 1
  ).catch(() => undefined);
  return true;
}
