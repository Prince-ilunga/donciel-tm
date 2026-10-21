// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Server-side plan usage & limits enforcement
// ─────────────────────────────────────────────────────────────
import { db } from '@/lib/db';
import { getPlan, PlanId } from '@/lib/plans';

export interface LimitCheckResult {
  allowed: boolean;
  reason?: string;
  current?: number;
  limit?: number;
  plan?: PlanId;
}

function currentPeriod(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function startOfMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
}

/** Effective plan: admin accounts always get ELITE */
export async function getEffectivePlan(userId: string): Promise<PlanId> {
  const user = await db.user.findUnique({
    where: { id: userId },
    select: { role: true, plan: true },
  });
  if (!user) return 'FREE';
  if (user.role === 'admin') return 'ELITE';
  return getPlan(user.plan).id;
}

/** Count trades created during the current calendar month */
export async function countTradesThisMonth(userId: string): Promise<number> {
  return db.trade.count({
    where: { userId, createdAt: { gte: startOfMonth() } },
  });
}

/** Check + increment a usage counter (atomic upsert) */
export async function checkAndIncrementUsage(
  userId: string,
  key: string,
  limitPerMonth: number
): Promise<LimitCheckResult> {
  if (limitPerMonth === -1) return { allowed: true };

  const period = currentPeriod();
  const counter = await db.usageCounter.findUnique({
    where: { userId_key_period: { userId, key, period } },
  });
  const current = counter?.count ?? 0;

  if (current >= limitPerMonth) {
    return { allowed: false, reason: `Limite mensuelle atteinte (${limitPerMonth})`, current, limit: limitPerMonth };
  }

  await db.usageCounter.upsert({
    where: { userId_key_period: { userId, key, period } },
    create: { userId, key, period, count: 1 },
    update: { count: { increment: 1 } },
  });
  return { allowed: true, current: current + 1, limit: limitPerMonth };
}

/** Enforce the monthly trade limit for a plan */
export async function checkTradeLimit(userId: string): Promise<LimitCheckResult> {
  const plan = await getEffectivePlan(userId);
  const limit = getPlan(plan).limits.maxTradesPerMonth;
  if (limit === -1) return { allowed: true, plan };

  const current = await countTradesThisMonth(userId);
  if (current >= limit) {
    return {
      allowed: false,
      reason: `Limite du plan ${plan} atteinte : ${limit} trades/mois. Passe au plan supérieur pour journaliser sans limite.`,
      current,
      limit,
      plan,
    };
  }
  return { allowed: true, current, limit, plan };
}

/** Enforce the playbook limit for a plan */
export async function checkPlaybookLimit(userId: string): Promise<LimitCheckResult> {
  const plan = await getEffectivePlan(userId);
  const limit = getPlan(plan).limits.maxPlaybooks;
  if (limit === -1) return { allowed: true, plan };

  const current = await db.playbook.count({ where: { userId } });
  if (current >= limit) {
    return {
      allowed: false,
      reason: `Limite du plan ${plan} atteinte : ${limit} playbooks. Passe au plan supérieur pour en créer davantage.`,
      current,
      limit,
      plan,
    };
  }
  return { allowed: true, current, limit, plan };
}

/** Enforce the AI coach monthly quota */
export async function checkCoachQuota(userId: string): Promise<LimitCheckResult> {
  const plan = await getEffectivePlan(userId);
  const limit = getPlan(plan).limits.coachAiPerMonth;
  return checkAndIncrementUsage(userId, 'coach_ai', limit);
}

/** Enforce export permission */
export async function checkExportPermission(userId: string): Promise<LimitCheckResult> {
  const plan = await getEffectivePlan(userId);
  if (!getPlan(plan).limits.canExport) {
    return {
      allowed: false,
      reason: "L'export PDF est disponible à partir du plan Pro.",
      plan,
    };
  }
  return { allowed: true, plan };
}

/** Standard 402-style response payload for limit errors */
export function limitErrorResponse(result: LimitCheckResult) {
  return Response.json(
    {
      error: result.reason || 'Limite du plan atteinte',
      code: 'PLAN_LIMIT_REACHED',
      currentPlan: result.plan,
      upgradeUrl: '/abonnement',
    },
    { status: 402 }
  );
}
