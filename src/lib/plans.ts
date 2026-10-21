// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Plan definitions & feature gating
// Single source of truth for SaaS plans, used by both
// server (API enforcement) and client (UI display).
// ─────────────────────────────────────────────────────────────

export type PlanId = 'FREE' | 'PRO' | 'ELITE';
export type PlanInterval = 'monthly' | 'yearly';

export interface PlanLimits {
  /** Max trades per calendar month (-1 = unlimited) */
  maxTradesPerMonth: number;
  /** Max playbooks (-1 = unlimited) */
  maxPlaybooks: number;
  /** AI coach calls per month (-1 = unlimited) */
  coachAiPerMonth: number;
  /** PDF/CSV export allowed */
  canExport: boolean;
  /** Advanced stats (distribution, timing) */
  advancedStats: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  tagline: string;
  /** Price in euros per month (display only) */
  priceMonthly: number;
  priceYearly: number;
  limits: PlanLimits;
  features: string[];
  highlight?: boolean;
}

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: 'FREE',
    name: 'Découverte',
    tagline: 'Commence à journaliser tes trades',
    priceMonthly: 0,
    priceYearly: 0,
    limits: {
      maxTradesPerMonth: 30,
      maxPlaybooks: 2,
      coachAiPerMonth: 5,
      canExport: false,
      advancedStats: false,
    },
    features: [
      '30 trades / mois',
      'Journal de trading complet',
      'Stats essentielles (win rate, P&L, RR)',
      '2 playbooks',
      'Coach IA : 5 analyses / mois',
      'Préparation de session & notes',
    ],
  },
  PRO: {
    id: 'PRO',
    name: 'Pro',
    tagline: 'Pour les traders sérieux',
    priceMonthly: 19,
    priceYearly: 190,
    highlight: true,
    limits: {
      maxTradesPerMonth: -1,
      maxPlaybooks: 20,
      coachAiPerMonth: 60,
      canExport: true,
      advancedStats: true,
    },
    features: [
      'Trades illimités',
      'Toutes les stats avancées (distribution, timing)',
      '20 playbooks avec images',
      'Coach IA : 60 analyses / mois',
      'Export PDF de ton journal',
      'Market data (news, sentiment, briefing)',
      'Money management (10 paliers)',
    ],
  },
  ELITE: {
    id: 'ELITE',
    name: 'Elite',
    tagline: 'Performance maximale, zéro limite',
    priceMonthly: 39,
    priceYearly: 390,
    limits: {
      maxTradesPerMonth: -1,
      maxPlaybooks: -1,
      coachAiPerMonth: -1,
      canExport: true,
      advancedStats: true,
    },
    features: [
      'Tout le plan Pro',
      'Playbooks illimités',
      'Coach IA illimité',
      'Bibliothèque vidéo complète',
      'Support prioritaire',
      'Accès anticipé aux nouvelles features',
    ],
  },
};

export const PLAN_ORDER: PlanId[] = ['FREE', 'PRO', 'ELITE'];

export function getPlan(planId: string | null | undefined): Plan {
  if (planId === 'PRO' || planId === 'ELITE') return PLANS[planId];
  return PLANS.FREE;
}

export function isPlanAtLeast(current: string | null | undefined, required: PlanId): boolean {
  const idx = PLAN_ORDER.indexOf(getPlan(current).id);
  return idx >= PLAN_ORDER.indexOf(required);
}

/** Stripe price IDs from environment (configured in Vercel) */
export function getStripePriceId(plan: Exclude<PlanId, 'FREE'>, interval: PlanInterval): string | null {
  const map: Record<string, string | undefined> = {
    'PRO:monthly': process.env.STRIPE_PRICE_PRO_MONTHLY,
    'PRO:yearly': process.env.STRIPE_PRICE_PRO_YEARLY,
    'ELITE:monthly': process.env.STRIPE_PRICE_ELITE_MONTHLY,
    'ELITE:yearly': process.env.STRIPE_PRICE_ELITE_YEARLY,
  };
  return map[`${plan}:${interval}`] || null;
}

export function stripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}
