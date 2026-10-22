import { NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { getEffectivePlan, limitErrorResponse } from '@/lib/plan-limits';
import { getPlan } from '@/lib/plans';
import { computeDoncielScore, DoncielScore } from '@/lib/discipline';
import { computeCoreStats, TradeLike } from '@/lib/analytics';

// ─────────────────────────────────────────────────────────────
// Leaderboard API (Pack 3 — Discipline & Risque)
//  GET → classement communautaire basé sur le Score DONCIEL
//  des 30 derniers jours (traders approuvés, ≥ 10 trades).
//  Réservé au plan Elite (402 sinon). Aucun email exposé.
// ─────────────────────────────────────────────────────────────

const MIN_TRADES = 10;
const TOP_SIZE = 20;
const PERIOD_DAYS = 30;

interface MinimalTrade {
  id: string;
  userId: string;
  date: Date;
  pair: string;
  result: string | null;
  rr: number | null;
  pnl: number | null;
  setup: string | null;
  entryModel: string | null;
  emotions: string | null;
  confluence: string | null;
  mistakes: string | null;
  lessons: string | null;
  playbookId: string | null;
}

interface LeaderboardEntry {
  rank: number;
  name: string;
  isSelf: boolean;
  plan: string;
  score: number;
  winRate: number;
  totalRR: number;
  tradesCount: number;
  grade: DoncielScore['grade'];
}

interface MeSummary {
  rank: number | null;
  qualified: boolean;
  name: string;
  score: number;
  winRate: number;
  totalRR: number;
  tradesCount: number;
  grade: DoncielScore['grade'];
}

/** Reconstruit un TradeLike complet depuis la projection minimale (champs requis par défaut neutres). */
function toTradeLike(t: MinimalTrade): TradeLike {
  return {
    id: t.id,
    date: t.date,
    pair: t.pair,
    direction: 'LONG',
    session: '',
    marketCondition: '',
    timeframe: '',
    setup: t.setup,
    structure: null,
    entryModel: t.entryModel,
    entryPrice: 0,
    stopLoss: 0,
    takeProfit: 0,
    exitPrice: null,
    entryTime: null,
    exitTime: null,
    duration: null,
    lotSize: null,
    rr: t.rr,
    pnl: t.pnl,
    result: t.result,
    emotions: t.emotions,
    confluence: t.confluence,
    mistakes: t.mistakes,
    lessons: t.lessons,
    notes: null,
    mfe: null,
    mae: null,
    accountName: null,
    playbookId: t.playbookId,
    importSource: null,
  };
}

/**
 * Anonymisation : prénom + initiale (ex. "Prince I.").
 * Pour soi-même : nom complet. Jamais d'email.
 */
function displayName(fullName: string | null, isSelf: boolean): string {
  const trimmed = fullName?.trim() || '';
  if (isSelf) return trimmed || 'Moi';
  if (!trimmed) return 'Trader';
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1]!.charAt(0).toUpperCase()}.`;
}

export async function GET() {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }
    const requesterId = result.user.id;

    // ─── Gating : réservé au plan Elite (admin = Elite) ───
    const plan = await getEffectivePlan(requesterId);
    if (plan !== 'ELITE') {
      return limitErrorResponse({
        allowed: false,
        reason: 'Le classement de la communauté est réservé au plan Elite.',
        plan,
      });
    }

    // ─── Utilisateurs approuvés (role user ou admin) ───
    const users = await db.user.findMany({
      where: { status: 'approved', role: { in: ['user', 'admin'] } },
      select: { id: true, name: true, plan: true, role: true },
    });

    // ─── Une seule query : trades des 30 derniers jours (projection minimale) ───
    const since = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const trades = await db.trade.findMany({
      where: { user: { status: 'approved' }, date: { gte: since } },
      select: {
        id: true,
        userId: true,
        date: true,
        pair: true,
        result: true,
        rr: true,
        pnl: true,
        setup: true,
        entryModel: true,
        emotions: true,
        confluence: true,
        mistakes: true,
        lessons: true,
        playbookId: true,
      },
    });

    // ─── Groupement par utilisateur ───
    const byUser = new Map<string, MinimalTrade[]>();
    for (const t of trades) {
      const list = byUser.get(t.userId);
      if (list) list.push(t);
      else byUser.set(t.userId, [t]);
    }

    interface UserStats {
      userId: string;
      name: string | null;
      plan: string;
      isSelf: boolean;
      score: DoncielScore;
      core: ReturnType<typeof computeCoreStats>;
    }

    const stats: UserStats[] = [];
    for (const u of users) {
      const list = byUser.get(u.id) || [];
      const likeTrades = list.map(toTradeLike);
      const score = computeDoncielScore(likeTrades);
      const core = computeCoreStats(likeTrades);
      stats.push({
        userId: u.id,
        name: u.name,
        plan: u.role === 'admin' ? 'ELITE' : getPlan(u.plan).id,
        isSelf: u.id === requesterId,
        score,
        core,
      });
    }

    // ─── Qualifiés : ≥ 10 trades sur la période ───
    const qualified = stats.filter((s) => s.core.totalTrades >= MIN_TRADES);

    // Tri : score décroissant, puis totalRR décroissant
    qualified.sort((a, b) => {
      if (b.score.total !== a.score.total) return b.score.total - a.score.total;
      return b.core.totalRR - a.core.totalRR;
    });

    const leaderboard: LeaderboardEntry[] = qualified
      .slice(0, TOP_SIZE)
      .map((s, index) => ({
        rank: index + 1,
        name: displayName(s.name, s.isSelf),
        isSelf: s.isSelf,
        plan: s.plan,
        score: s.score.total,
        winRate: s.core.winRate,
        totalRR: s.core.totalRR,
        tradesCount: s.core.totalTrades,
        grade: s.score.grade,
      }));

    // ─── Résumé du demandeur (rang même s'il n'est pas encore qualifié) ───
    const selfStats = stats.find((s) => s.isSelf);
    let me: MeSummary | null = null;
    if (selfStats) {
      const qualifiedIndex = qualified.findIndex((s) => s.userId === selfStats.userId);
      me = {
        rank: qualifiedIndex >= 0 ? qualifiedIndex + 1 : null,
        qualified: qualifiedIndex >= 0,
        name: displayName(selfStats.name, true),
        score: selfStats.score.total,
        winRate: selfStats.core.winRate,
        totalRR: selfStats.core.totalRR,
        tradesCount: selfStats.core.totalTrades,
        grade: selfStats.score.grade,
      };
    }

    return NextResponse.json({
      leaderboard,
      me,
      meta: {
        minTrades: MIN_TRADES,
        periodDays: PERIOD_DAYS,
        totalQualified: qualified.length,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error('Leaderboard GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du classement' },
      { status: 500 }
    );
  }
}
