// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Discipline : Score DONCIEL + détection de violations
// (Pack "Discipline & Risque"). Fonctions pures réutilisables
// côté client et côté serveur.
//
// Le Score DONCIEL (0-100) évalue la DISCIPLINE, pas seulement la
// performance : un trader rentable mais hors-plan n'est pas discipliné.
// ─────────────────────────────────────────────────────────────

import { TradeLike, tradePnl, tradeR, computeCoreStats } from './analytics';

export interface RiskProfileLike {
  initialCapital: number;
  currency: string;
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  maxTradesPerDay: number | null;
}

export interface RiskProfileInput {
  initialCapital: number;
  currency?: string;
  riskPerTradePct?: number;
  maxDailyLossPct?: number;
  maxWeeklyLossPct?: number;
  maxTradesPerDay?: number | null;
}

export function normalizeProfile(p: RiskProfileInput): RiskProfileLike {
  return {
    initialCapital: p.initialCapital,
    currency: p.currency || 'USD',
    riskPerTradePct: typeof p.riskPerTradePct === 'number' ? p.riskPerTradePct : 1,
    maxDailyLossPct: typeof p.maxDailyLossPct === 'number' ? p.maxDailyLossPct : 3,
    maxWeeklyLossPct: typeof p.maxWeeklyLossPct === 'number' ? p.maxWeeklyLossPct : 6,
    maxTradesPerDay: typeof p.maxTradesPerDay === 'number' ? p.maxTradesPerDay : null,
  };
}

// ─── Score DONCIEL ───────────────────────────────────────────

export interface ScorePillars {
  discipline: number;   // /30 — respect du plan (playbook lié, setup & modèle renseignés)
  consistency: number;  // /20 — régularité (faible variance des R)
  risk: number;         // /20 — gestion du risque (pertes tenues à -1R)
  performance: number;  // /20 — espérance & win rate
  journaling: number;   // /10 — qualité du journal (émotions/leçons/erreurs renseignées)
}

export interface DoncielScore {
  total: number; // 0-100
  pillars: ScorePillars;
  grade: 'A+' | 'A' | 'B' | 'C' | 'D';
  tradesAnalyzed: number;
}

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v));
}

export function computeDoncielScore(trades: TradeLike[]): DoncielScore {
  const n = trades.length;
  if (n === 0) {
    return {
      total: 0,
      pillars: { discipline: 0, consistency: 0, risk: 0, performance: 0, journaling: 0 },
      grade: 'D',
      tradesAnalyzed: 0,
    };
  }

  // 1. Discipline (/30)
  const withPlaybook = trades.filter((t) => t.playbookId).length / n;
  const withSetup = trades.filter((t) => t.setup && t.setup.trim().length > 0).length / n;
  const withModel = trades.filter((t) => t.entryModel && t.entryModel.trim().length > 0).length / n;
  const discipline = Math.round((withPlaybook * 15 + withSetup * 7.5 + withModel * 7.5) * 10) / 10;

  // 2. Consistance (/20) — écart-type des R (faible variance = exécution régulière)
  const rrValues = trades.filter((t) => typeof t.rr === 'number').map((t) => t.rr as number);
  let consistency = 0;
  if (rrValues.length >= 2) {
    const mean = rrValues.reduce((a, b) => a + b, 0) / rrValues.length;
    const std = Math.sqrt(rrValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / rrValues.length);
    consistency = Math.round(clamp(20 * (1 - Math.min(std, 3) / 3), 0, 20) * 10) / 10;
  }

  // 3. Risque (/20) — pertes tenues autour de -1R (pas de dépassement de stop)
  const losses = trades.filter((t) => t.result === 'LOSS');
  let risk = 0;
  if (losses.length > 0) {
    const respected = losses.filter((t) => (t.rr ?? -1) >= -1.1).length;
    risk = Math.round((respected / losses.length) * 20 * 10) / 10;
  } else if (trades.length > 0) {
    risk = 20; // aucune perte : rien à reprocher
  }

  // 4. Performance (/20) — espérance positive + win rate
  const core = computeCoreStats(trades);
  const exp = core.expectancy;
  const perfExp = exp > 0 ? clamp(exp / 0.5, 0, 1) : 0; // 0.5R de moyenne = plein score
  const perfWr = clamp(core.winRate / 60, 0, 1); // 60% WR = plein score
  const performance = Math.round((perfExp * 12 + perfWr * 8) * 10) / 10;

  // 5. Journaling (/10) — émotions, leçons ou erreurs renseignées
  const journalFilled = trades.filter((t) =>
    [t.emotions, t.lessons, t.mistakes, t.confluence].some((v) => v && String(v).trim().length > 0)
  ).length / n;
  const journaling = Math.round(journalFilled * 10 * 10) / 10;

  const total = Math.round(clamp(discipline + consistency + risk + performance + journaling, 0, 100));
  const grade: DoncielScore['grade'] =
    total >= 85 ? 'A+' : total >= 70 ? 'A' : total >= 55 ? 'B' : total >= 40 ? 'C' : 'D';

  return {
    total,
    pillars: { discipline, consistency, risk, performance, journaling },
    grade,
    tradesAnalyzed: n,
  };
}

// ─── Violations de règles ────────────────────────────────────

export interface DailyViolation {
  dateISO: string;
  dayPnl: number;
  lossPct: number;   // positif, ex: 4.2 = -4.2%
  limitPct: number;
  capitalAtStart: number;
  tradesCount: number;
}

export interface OverRiskTrade {
  tradeId: string;
  date: string;
  pair: string;
  riskPct: number;
  limitPct: number;
  riskAmount: number;
  capitalAtEntry: number;
}

export interface OvertradingDay {
  dateISO: string;
  count: number;
  limit: number;
}

export interface ViolationsReport {
  dailyLossViolations: DailyViolation[];
  weeklyLossViolations: DailyViolation[]; // dateISO = début de semaine (lundi)
  overRiskTrades: OverRiskTrade[];
  overtradingDays: OvertradingDay[];
  totalViolations: number;
  cleanStreakDays: number; // jours consécutifs (finissant aujourd'hui) sans violation
}

/** Risque monétaire planifié d'un trade : |entrée - SL| × lot × taille de contrat. */
export function tradeRiskAmount(t: TradeLike): number | null {
  if (typeof t.lotSize !== 'number' || t.lotSize <= 0) return null;
  const risk = Math.abs(t.entryPrice - t.stopLoss);
  if (risk <= 0) return null;
  return risk * t.lotSize * getContractSizeSafe(t.pair);
}

// Copie volontairement minimale (évite une dépendance import/export de utils côté serveur)
function getContractSizeSafe(pair: string): number {
  const p = pair.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (p === 'XAUUSD') return 100;
  if (p === 'US30' || p === 'US30CASH' || p === 'US30USD') return 5;
  if (p === 'US100' || p === 'NAS100' || p === 'US100CASH' || p === 'NAS100CASH') return 20;
  if (p === 'US500' || p === 'SPX500') return 10;
  if (p === 'GER40' || p === 'DAX40' || p === 'GER30') return 25;
  if (p === 'JP225' || p === 'NIKKEI225') return 10;
  if (p === 'XAGUSD') return 5000;
  if (p === 'BTCUSD' || p === 'BTCUSDT') return 1;
  if (p === 'ETHUSD' || p === 'ETHUSDT') return 10;
  if (p.startsWith('USDJPY') || p.endsWith('JPY')) return 90000 / 100;
  return 100000; // Forex standard
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Lundi de la semaine contenant `d` */
function mondayOf(d: Date): Date {
  const day = d.getDay() === 0 ? 7 : d.getDay();
  const monday = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
  return monday;
}

function toDate(t: TradeLike): Date {
  return t.date instanceof Date ? t.date : new Date(t.date);
}

/** Analyse complète des violations sur l'historique des trades (chronologique). */
export function computeViolations(trades: TradeLike[], profileInput: RiskProfileInput): ViolationsReport {
  const profile = normalizeProfile(profileInput);
  const sorted = [...trades].sort((a, b) => toDate(a).getTime() - toDate(b).getTime());

  const dailyLossViolations: DailyViolation[] = [];
  const weeklyLossViolations: DailyViolation[] = [];
  const overRiskTrades: OverRiskTrade[] = [];
  const overtradingDays: OvertradingDay[] = [];

  // Agrégation par jour (avec capital courant)
  const byDay = new Map<string, { pnl: number; count: number; trades: TradeLike[] }>();
  let runningCapital = profile.initialCapital;
  const capitalAtDayStart = new Map<string, number>();

  for (const t of sorted) {
    const key = isoDate(toDate(t));
    if (!byDay.has(key)) {
      byDay.set(key, { pnl: 0, count: 0, trades: [] });
      capitalAtDayStart.set(key, runningCapital);
    }
    const day = byDay.get(key)!;
    day.pnl += tradePnl(t);
    day.count++;
    day.trades.push(t);
    runningCapital += tradePnl(t);
  }

  // 1. Pertes quotidiennes
  for (const [dateISO, day] of byDay.entries()) {
    const capital = capitalAtDayStart.get(dateISO) || profile.initialCapital;
    if (day.pnl < 0 && capital > 0) {
      const lossPct = Math.round((Math.abs(day.pnl) / capital) * 1000) / 10;
      if (lossPct > profile.maxDailyLossPct) {
        dailyLossViolations.push({
          dateISO, dayPnl: Math.round(day.pnl * 100) / 100, lossPct,
          limitPct: profile.maxDailyLossPct, capitalAtStart: Math.round(capital * 100) / 100,
          tradesCount: day.count,
        });
      }
    }
    if (profile.maxTradesPerDay && day.count > profile.maxTradesPerDay) {
      overtradingDays.push({ dateISO, count: day.count, limit: profile.maxTradesPerDay });
    }
  }

  // 2. Pertes hebdomadaires
  const byWeek = new Map<string, { pnl: number; count: number; start: Date }>();
  for (const [dateISO, day] of byDay.entries()) {
    const start = mondayOf(new Date(dateISO + 'T00:00:00'));
    const key = isoDate(start);
    if (!byWeek.has(key)) byWeek.set(key, { pnl: 0, count: 0, start });
    const week = byWeek.get(key)!;
    week.pnl += day.pnl;
    week.count += day.count;
  }
  for (const [startISO, week] of byWeek.entries()) {
    // capital en début de semaine = capital au début du premier jour tradé de la semaine
    const days = [...byDay.keys()].filter((d) => isoDate(mondayOf(new Date(d + 'T00:00:00'))) === startISO).sort();
    const capital = days.length ? (capitalAtDayStart.get(days[0]) || profile.initialCapital) : profile.initialCapital;
    if (week.pnl < 0 && capital > 0) {
      const lossPct = Math.round((Math.abs(week.pnl) / capital) * 1000) / 10;
      if (lossPct > profile.maxWeeklyLossPct) {
        weeklyLossViolations.push({
          dateISO: startISO, dayPnl: Math.round(week.pnl * 100) / 100, lossPct,
          limitPct: profile.maxWeeklyLossPct, capitalAtStart: Math.round(capital * 100) / 100,
          tradesCount: week.count,
        });
      }
    }
  }

  // 3. Risque par trade trop élevé
  for (const t of sorted) {
    const riskAmount = tradeRiskAmount(t);
    if (riskAmount === null) continue;
    const dateKey = isoDate(toDate(t));
    const capital = capitalAtDayStart.get(dateKey) || profile.initialCapital;
    if (capital <= 0) continue;
    const riskPct = Math.round((riskAmount / capital) * 1000) / 10;
    if (riskPct > profile.riskPerTradePct * 1.5) { // tolérance 50% (slippage / points d'entrée approximés)
      overRiskTrades.push({
        tradeId: t.id, date: dateKey, pair: t.pair, riskPct,
        limitPct: profile.riskPerTradePct,
        riskAmount: Math.round(riskAmount * 100) / 100,
        capitalAtEntry: Math.round(capital * 100) / 100,
      });
    }
  }

  // 4. Série propre (jours consécutifs finissant aujourd'hui sans aucune violation)
  const violationDays = new Set<string>(dailyLossViolations.map((v) => v.dateISO));
  const today = new Date();
  let cleanStreakDays = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    // on ne compte que les jours où il y a eu du trading
    if (!byDay.has(isoDate(d))) continue;
    if (violationDays.has(isoDate(d))) break;
    cleanStreakDays++;
  }

  return {
    dailyLossViolations,
    weeklyLossViolations,
    overRiskTrades,
    overtradingDays,
    totalViolations:
      dailyLossViolations.length + weeklyLossViolations.length + overRiskTrades.length + overtradingDays.length,
    cleanStreakDays,
  };
}

// ─── Objectifs mensuels ──────────────────────────────────────

export type GoalMetric = 'RR_TOTAL' | 'WIN_RATE' | 'PROFIT_FACTOR' | 'NET_PNL' | 'TRADES_COUNT' | 'DISCIPLINE_SCORE';

export const GOAL_METRICS: { value: GoalMetric; labelFr: string; labelEn: string; unit: string }[] = [
  { value: 'RR_TOTAL', labelFr: 'RR cumulé', labelEn: 'Total R', unit: 'R' },
  { value: 'WIN_RATE', labelFr: 'Win rate', labelEn: 'Win rate', unit: '%' },
  { value: 'PROFIT_FACTOR', labelFr: 'Profit factor', labelEn: 'Profit factor', unit: '' },
  { value: 'NET_PNL', labelFr: 'P&L net', labelEn: 'Net P&L', unit: '$' },
  { value: 'TRADES_COUNT', labelFr: 'Nombre de trades', labelEn: 'Trades count', unit: '' },
  { value: 'DISCIPLINE_SCORE', labelFr: 'Score DONCIEL', labelEn: 'DONCIEL Score', unit: '/100' },
];

export interface GoalProgress {
  metric: GoalMetric;
  target: number;
  current: number;
  progressPct: number; // 0-100+ (peut dépasser si objectif dépassé)
  achieved: boolean;
}

export function computeGoalProgress(
  goals: { metric: string; target: number; period: string; status: string }[],
  monthTrades: TradeLike[],
  period: string,
  score?: DoncielScore
): GoalProgress[] {
  const core = computeCoreStats(monthTrades);
  const monthKeyNow = period;
  return goals
    .filter((g) => g.period === monthKeyNow && g.status === 'ACTIVE')
    .map((g) => {
      let current = 0;
      switch (g.metric) {
        case 'RR_TOTAL': current = core.totalRR; break;
        case 'WIN_RATE': current = core.winRate; break;
        case 'PROFIT_FACTOR': current = Math.min(core.profitFactor, 999); break;
        case 'NET_PNL': current = core.totalPnL; break;
        case 'TRADES_COUNT': current = core.totalTrades; break;
        case 'DISCIPLINE_SCORE': current = score?.total ?? 0; break;
        default: current = 0;
      }
      const achieved = current >= g.target;
      const progressPct = g.target !== 0 ? Math.round((current / g.target) * 100) : 0;
      return {
        metric: g.metric as GoalMetric,
        target: g.target,
        current: Math.round(current * 100) / 100,
        progressPct,
        achieved,
      };
    });
}
