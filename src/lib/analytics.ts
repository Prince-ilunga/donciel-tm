// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Moteur d'analytique partagé (Pack "Analytics Pro")
// Fonctions pures, utilisables côté client (calculs sur les trades
// renvoyés par /api/trades) comme côté serveur.
//
// Unités :
//  - R  : le multiple de risque (t.rr est déjà signé : -1 pour une perte,
//         positif pour un gain, partiel pour un BE)
//  - PnL : montant monétaire (t.pnl)
// ─────────────────────────────────────────────────────────────

export interface TradeLike {
  id: string;
  date: string | Date;
  pair: string;
  direction: string;
  session: string;
  marketCondition: string;
  timeframe: string;
  setup: string | null;
  structure: string | null;
  entryModel: string | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number | null;
  entryTime: string | null;
  exitTime: string | null;
  duration: string | null;
  lotSize: number | null;
  rr: number | null;
  pnl: number | null;
  result: string | null;
  emotions?: string | null;
  confluence?: string | null;
  mistakes?: string | null;
  lessons?: string | null;
  notes?: string | null;
  mfe?: number | null;
  mae?: number | null;
  accountName?: string | null;
  playbookId?: string | null;
  importSource?: string | null;
}

export interface GroupStats {
  count: number;
  wins: number;
  losses: number;
  winRate: number;
  totalRR: number;
  avgRR: number;
  totalPnL: number;
  expectancy: number; // espérance moyenne en R
}

export type BreakdownDimension =
  | 'pair'
  | 'direction'
  | 'session'
  | 'marketCondition'
  | 'timeframe'
  | 'setup'
  | 'structure'
  | 'entryModel'
  | 'day'
  | 'hour'
  | 'month'
  | 'duration'
  | 'account';

export interface CoreStats {
  totalTrades: number;
  wins: number;
  losses: number;
  bes: number;
  winRate: number;
  totalRR: number;
  avgRR: number;
  expectancy: number; // R moyen par trade (tous trades)
  bestRR: number;
  worstRR: number;
  totalPnL: number;
  grossProfit: number;
  grossLoss: number;
  profitFactor: number;
  avgWinPnl: number;
  avgLossPnl: number;
  maxWinStreak: number;
  maxLossStreak: number;
  currentStreakType: 'WIN' | 'LOSS' | 'BE' | 'NONE';
  currentStreakCount: number;
  maxDrawdownR: number;
  maxDrawdownPct: number; // vs pic d'équité R cumulée
  recoveryFactor: number;
}

export interface EquityPoint {
  index: number;
  date: string;
  equityR: number;
  drawdownR: number;
}

export interface CalendarDay {
  dateISO: string; // YYYY-MM-DD
  dayOfMonth: number;
  weekday: number; // 1 = lundi … 7 = dimanche
  count: number;
  wins: number;
  losses: number;
  pnl: number;
  r: number;
  trades: TradeLike[];
}

export const DAY_LABELS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
export const MONTH_LABELS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function toDate(t: TradeLike): Date {
  return t.date instanceof Date ? t.date : new Date(t.date);
}

/** R effectif d'un trade (0 si inconnu) */
export function tradeR(t: TradeLike): number {
  return typeof t.rr === 'number' ? t.rr : 0;
}

/** PnL effectif d'un trade (0 si inconnu) */
export function tradePnl(t: TradeLike): number {
  return typeof t.pnl === 'number' ? t.pnl : 0;
}

function groupOf(trades: TradeLike[], keyFn: (t: TradeLike) => string): Record<string, GroupStats> {
  const map: Record<string, { count: number; wins: number; losses: number; totalRR: number; totalPnL: number; nR: number }> = {};
  for (const t of trades) {
    const key = keyFn(t);
    if (!map[key]) map[key] = { count: 0, wins: 0, losses: 0, totalRR: 0, totalPnL: 0, nR: 0 };
    const g = map[key];
    g.count++;
    if (t.result === 'WIN') g.wins++;
    if (t.result === 'LOSS') g.losses++;
    if (typeof t.rr === 'number') { g.totalRR += t.rr; g.nR++; }
    g.totalPnL += tradePnl(t);
  }
  const out: Record<string, GroupStats> = {};
  for (const [key, g] of Object.entries(map)) {
    const closed = g.count - 0; // tous trades comptés
    out[key] = {
      count: g.count,
      wins: g.wins,
      losses: g.losses,
      winRate: closed > 0 ? Math.round((g.wins / closed) * 1000) / 10 : 0,
      totalRR: Math.round(g.totalRR * 100) / 100,
      avgRR: g.nR > 0 ? Math.round((g.totalRR / g.nR) * 100) / 100 : 0,
      totalPnL: Math.round(g.totalPnL * 100) / 100,
      expectancy: g.nR > 0 ? Math.round((g.totalRR / g.nR) * 100) / 100 : 0,
    };
  }
  return out;
}

/** Durée en minutes depuis le champ duration ("1h 23m", "45m", "2h"…) */
function durationMinutes(t: TradeLike): number | null {
  if (!t.duration) return null;
  const h = /(\d+)\s*h/.exec(t.duration);
  const m = /(\d+)\s*m/.exec(t.duration);
  if (!h && !m) return null;
  const minutes = (h ? parseInt(h[1], 10) * 60 : 0) + (m ? parseInt(m[1], 10) : 0);
  return minutes > 0 ? minutes : null;
}

export function durationBucket(t: TradeLike): string {
  const mins = durationMinutes(t);
  if (mins === null) return 'N/A';
  if (mins < 5) return '< 5 min';
  if (mins < 15) return '5-15 min';
  if (mins < 30) return '15-30 min';
  if (mins < 60) return '30-60 min';
  if (mins < 120) return '1-2 h';
  return '2 h +';
}

export function weekdayKey(t: TradeLike): string {
  const d = toDate(t);
  return String(d.getDay() === 0 ? 7 : d.getDay());
}

export function hourKey(t: TradeLike): string {
  if (t.entryTime && /^\d{1,2}/.test(t.entryTime)) {
    return String(parseInt(t.entryTime.split(':')[0], 10)).padStart(2, '0');
  }
  const d = toDate(t);
  return String(d.getHours()).padStart(2, '0');
}

export function monthKey(t: TradeLike): string {
  const d = toDate(t);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Stats de base + streaks + drawdown. `trades` doit être trié du plus ancien au plus récent. */
export function computeCoreStats(input: TradeLike[]): CoreStats {
  const trades = [...input].sort((a, b) => toDate(a).getTime() - toDate(b).getTime());
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === 'WIN');
  const losses = trades.filter((t) => t.result === 'LOSS');
  const bes = trades.filter((t) => t.result === 'BE');
  const winRate = totalTrades > 0 ? Math.round((wins.length / totalTrades) * 1000) / 10 : 0;

  const rrValues = trades.filter((t) => typeof t.rr === 'number').map((t) => t.rr as number);
  const totalRR = Math.round(rrValues.reduce((a, b) => a + b, 0) * 100) / 100;
  const avgRR = rrValues.length ? Math.round((totalRR / rrValues.length) * 100) / 100 : 0;
  const expectancy = avgRR;
  const bestRR = rrValues.length ? Math.max(...rrValues) : 0;
  const worstRR = rrValues.length ? Math.min(...rrValues) : 0;

  const pnlValues = trades.map(tradePnl);
  const totalPnL = Math.round(pnlValues.reduce((a, b) => a + b, 0) * 100) / 100;
  const grossProfit = pnlValues.filter((v) => v > 0).reduce((a, b) => a + b, 0);
  const grossLoss = Math.abs(pnlValues.filter((v) => v < 0).reduce((a, b) => a + b, 0));
  const profitFactor = grossLoss > 0 ? Math.round((grossProfit / grossLoss) * 100) / 100 : grossProfit > 0 ? 999 : 0;
  const avgWinPnl = wins.length ? Math.round((grossProfit / wins.length) * 100) / 100 : 0;
  const avgLossPnl = losses.length ? Math.round((grossLoss / losses.length) * 100) / 100 : 0;

  // Streaks
  let maxWinStreak = 0, maxLossStreak = 0, curW = 0, curL = 0;
  for (const t of trades) {
    if (t.result === 'WIN') { curW++; curL = 0; maxWinStreak = Math.max(maxWinStreak, curW); }
    else if (t.result === 'LOSS') { curL++; curW = 0; maxLossStreak = Math.max(maxLossStreak, curL); }
    else { curW = 0; curL = 0; }
  }
  let currentStreakType: CoreStats['currentStreakType'] = 'NONE';
  let currentStreakCount = 0;
  for (let i = trades.length - 1; i >= 0; i--) {
    const r = trades[i].result;
    if (r !== 'WIN' && r !== 'LOSS') break;
    if (currentStreakType === 'NONE') { currentStreakType = r; currentStreakCount = 1; continue; }
    if (r === currentStreakType) currentStreakCount++; else break;
  }

  // Équité en R + drawdown
  let equity = 0, peak = 0, maxDd = 0, peakEquity = 0;
  for (const t of trades) {
    equity += tradeR(t);
    if (equity > peak) { peak = equity; peakEquity = peak; }
    const dd = peak - equity;
    if (dd > maxDd) maxDd = dd;
  }
  const maxDrawdownPct = peakEquity > 0 ? Math.round((maxDd / peakEquity) * 1000) / 10 : 0;
  const recoveryFactor = maxDd > 0 ? Math.round((totalRR / maxDd) * 100) / 100 : totalRR > 0 ? 999 : 0;

  return {
    totalTrades,
    wins: wins.length,
    losses: losses.length,
    bes: bes.length,
    winRate,
    totalRR,
    avgRR,
    expectancy,
    bestRR,
    worstRR,
    totalPnL,
    grossProfit: Math.round(grossProfit * 100) / 100,
    grossLoss: Math.round(grossLoss * 100) / 100,
    profitFactor,
    avgWinPnl,
    avgLossPnl,
    maxWinStreak,
    maxLossStreak,
    currentStreakType,
    currentStreakCount,
    maxDrawdownR: Math.round(maxDd * 100) / 100,
    maxDrawdownPct,
    recoveryFactor,
  };
}

/** Courbe d'équité en R avec drawdown au fil des trades (ordre chronologique). */
export function computeEquityCurve(input: TradeLike[]): EquityPoint[] {
  const trades = [...input].sort((a, b) => toDate(a).getTime() - toDate(b).getTime());
  let equity = 0, peak = 0;
  return trades.map((t, i) => {
    equity += tradeR(t);
    if (equity > peak) peak = equity;
    return {
      index: i + 1,
      date: toDate(t).toISOString().slice(0, 10),
      equityR: Math.round(equity * 100) / 100,
      drawdownR: Math.round((peak - equity) * 100) / 100,
    };
  });
}

/** Breakdown 360° : stats par dimension. */
export function breakdown(trades: TradeLike[], dimension: BreakdownDimension): Record<string, GroupStats> {
  switch (dimension) {
    case 'pair': return groupOf(trades, (t) => t.pair);
    case 'direction': return groupOf(trades, (t) => t.direction);
    case 'session': return groupOf(trades, (t) => t.session);
    case 'marketCondition': return groupOf(trades, (t) => t.marketCondition);
    case 'timeframe': return groupOf(trades, (t) => t.timeframe);
    case 'setup': return groupOf(trades, (t) => t.setup || 'Non défini');
    case 'structure': return groupOf(trades, (t) => t.structure || 'Non définie');
    case 'entryModel': return groupOf(trades, (t) => t.entryModel || 'Non défini');
    case 'day': return groupOf(trades, weekdayKey);
    case 'hour': return groupOf(trades, hourKey);
    case 'month': return groupOf(trades, monthKey);
    case 'duration': return groupOf(trades, durationBucket);
    case 'account': return groupOf(trades, (t) => t.accountName || 'Principal');
    default: return {};
  }
}

/** Label lisible d'une clé de dimension. */
export function dimensionLabel(dimension: BreakdownDimension, key: string, lang: 'fr' | 'en' = 'fr'): string {
  if (dimension === 'day') {
    const idx = parseInt(key, 10) - 1;
    if (lang === 'en') return ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx] || key;
    return DAY_LABELS_FR[idx] || key;
  }
  if (dimension === 'month' && /^\d{4}-\d{2}$/.test(key)) {
    const m = MONTH_LABELS_FR[parseInt(key.slice(5), 10) - 1];
    return m ? `${m} ${key.slice(0, 4)}` : key;
  }
  if (dimension === 'account' && key === 'Principal') return lang === 'en' ? 'Main' : 'Principal';
  return key;
}

export const DIMENSIONS: { value: BreakdownDimension; labelFr: string; labelEn: string }[] = [
  { value: 'pair', labelFr: 'Paire / Instrument', labelEn: 'Pair / Instrument' },
  { value: 'direction', labelFr: 'Direction (Long/Short)', labelEn: 'Direction (Long/Short)' },
  { value: 'session', labelFr: 'Session', labelEn: 'Session' },
  { value: 'setup', labelFr: 'Setup', labelEn: 'Setup' },
  { value: 'entryModel', labelFr: "Modèle d'entrée", labelEn: 'Entry model' },
  { value: 'structure', labelFr: 'Structure', labelEn: 'Structure' },
  { value: 'marketCondition', labelFr: 'Condition de marché', labelEn: 'Market condition' },
  { value: 'timeframe', labelFr: 'Timeframe', labelEn: 'Timeframe' },
  { value: 'day', labelFr: 'Jour de la semaine', labelEn: 'Day of week' },
  { value: 'hour', labelFr: "Heure d'entrée", labelEn: 'Entry hour' },
  { value: 'duration', labelFr: 'Durée de détention', labelEn: 'Holding duration' },
  { value: 'month', labelFr: 'Mois', labelEn: 'Month' },
  { value: 'account', labelFr: 'Compte', labelEn: 'Account' },
];

/** Construit les jours d'un mois (avec tous les jours, même vides) + agrégats par jour. */
export function buildCalendarMonth(trades: TradeLike[], year: number, month: number): CalendarDay[] {
  const byDay: Record<string, CalendarDay> = {};
  for (const t of trades) {
    const d = toDate(t);
    if (d.getFullYear() !== year || d.getMonth() !== month - 1) continue;
    const dateISO = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    if (!byDay[dateISO]) {
      byDay[dateISO] = {
        dateISO,
        dayOfMonth: d.getDate(),
        weekday: d.getDay() === 0 ? 7 : d.getDay(),
        count: 0, wins: 0, losses: 0, pnl: 0, r: 0, trades: [],
      };
    }
    const day = byDay[dateISO];
    day.count++;
    if (t.result === 'WIN') day.wins++;
    if (t.result === 'LOSS') day.losses++;
    day.pnl += tradePnl(t);
    day.r += tradeR(t);
    day.trades.push(t);
  }
  for (const day of Object.values(byDay)) {
    day.pnl = Math.round(day.pnl * 100) / 100;
    day.r = Math.round(day.r * 100) / 100;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  const days: CalendarDay[] = [];
  for (let d = 1; d <= daysInMonth; d++) {
    const dateISO = `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
    days.push(byDay[dateISO] || {
      dateISO, dayOfMonth: d,
      weekday: new Date(year, month - 1, d).getDay() === 0 ? 7 : new Date(year, month - 1, d).getDay(),
      count: 0, wins: 0, losses: 0, pnl: 0, r: 0, trades: [],
    });
  }
  return days;
}

/** Agrégats d'un mois (pour l'en-tête du calendrier). */
export function monthSummary(trades: TradeLike[], year: number, month: number) {
  const inMonth = trades.filter((t) => {
    const d = toDate(t);
    return d.getFullYear() === year && d.getMonth() === month - 1;
  });
  const core = computeCoreStats(inMonth);
  const greenDays = new Set(
    inMonth.filter((t) => tradePnl(t) > 0).map((t) => toDate(t).toISOString().slice(0, 10))
  ).size;
  const redDays = new Set(
    inMonth.filter((t) => tradePnl(t) < 0).map((t) => toDate(t).toISOString().slice(0, 10))
  ).size;
  return {
    ...core,
    greenDays,
    redDays,
    tradingDays: new Set(inMonth.map((t) => toDate(t).toISOString().slice(0, 10))).size,
  };
}
