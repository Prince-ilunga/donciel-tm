import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

function calculateStdDev(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
  return parseFloat(Math.sqrt(variance).toFixed(2));
}

type TradeRecord = {
  id: string;
  pair: string;
  direction: string;
  session: string;
  marketCondition: string;
  timeframe: string;
  setup: string | null;
  rr: number | null;
  pnl: number | null;
  result: string | null;
  date: Date;
  entryTime: string | null;
};

function buildGroupStats(trades: TradeRecord[], keyFn: (t: TradeRecord) => string) {
  const groups: Record<string, { count: number; wins: number; totalRR: number; totalPnL: number; rrValues: number[] }> = {};
  for (const trade of trades) {
    const key = keyFn(trade);
    if (!groups[key]) groups[key] = { count: 0, wins: 0, totalRR: 0, totalPnL: 0, rrValues: [] };
    groups[key].count++;
    if (trade.result === 'WIN') groups[key].wins++;
    if (trade.rr !== null) { groups[key].totalRR += trade.rr; groups[key].rrValues.push(trade.rr); }
    if (trade.pnl !== null) groups[key].totalPnL += trade.pnl;
  }
  const result: Record<string, { count: number; winRate: number; avgRR: number; totalRR: number; totalPnL: number }> = {};
  for (const [key, g] of Object.entries(groups)) {
    result[key] = {
      count: g.count,
      winRate: g.count > 0 ? parseFloat(((g.wins / g.count) * 100).toFixed(2)) : 0,
      avgRR: g.rrValues.length > 0 ? parseFloat((g.rrValues.reduce((a, b) => a + b, 0) / g.rrValues.length).toFixed(2)) : 0,
      totalRR: parseFloat(g.totalRR.toFixed(2)),
      totalPnL: parseFloat(g.totalPnL.toFixed(2)),
    };
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthUser();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair');
    const direction = searchParams.get('direction');
    const session = searchParams.get('session');
    const marketCondition = searchParams.get('marketCondition');
    const timeframe = searchParams.get('timeframe');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = { userId: authResult.user.id };
    if (pair) where.pair = pair;
    if (direction) where.direction = direction;
    if (session) where.session = session;
    if (marketCondition) where.marketCondition = marketCondition;
    if (timeframe) where.timeframe = timeframe;
    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
    }

    const trades = await db.trade.findMany({
      where,
      select: {
        id: true,
        pair: true,
        direction: true,
        session: true,
        marketCondition: true,
        timeframe: true,
        setup: true,
        rr: true,
        pnl: true,
        result: true,
        date: true,
        entryTime: true,
      },
      orderBy: { date: 'asc' },
    }) as unknown as TradeRecord[];

    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.result === 'WIN');
    const losses = trades.filter((t) => t.result === 'LOSS');
    const bes = trades.filter((t) => t.result === 'BE');
    const winRate = totalTrades > 0 ? parseFloat(((wins.length / totalTrades) * 100).toFixed(2)) : 0;

    const rrValues = trades.filter((t) => t.rr !== null).map((t) => t.rr as number);
    const totalRR = rrValues.length > 0 ? parseFloat(rrValues.reduce((a, b) => a + b, 0).toFixed(2)) : 0;
    const avgRR = rrValues.length > 0 ? parseFloat((rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2)) : 0;
    const bestRR = rrValues.length > 0 ? parseFloat(Math.max(...rrValues).toFixed(2)) : 0;
    // Worst RR: only consider negative RR values (the most negative one)
    const negativeRRs = rrValues.filter(rr => rr < 0);
    const worstRR = negativeRRs.length > 0 ? parseFloat(Math.min(...negativeRRs).toFixed(2)) : 0;
    const stdDeviation = calculateStdDev(rrValues);

    const pnlValues = trades.filter((t) => t.pnl !== null).map((t) => t.pnl as number);
    const totalPnL = pnlValues.length > 0 ? parseFloat(pnlValues.reduce((a, b) => a + b, 0).toFixed(2)) : 0;
    const grossProfit = pnlValues.filter((v) => v > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(pnlValues.filter((v) => v < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? Infinity : 0;
    const avgWin = wins.length > 0 ? parseFloat((pnlValues.filter(v => v > 0).reduce((a, b) => a + b, 0) / wins.length).toFixed(2)) : 0;
    const avgLoss = losses.length > 0 ? parseFloat((Math.abs(pnlValues.filter(v => v < 0).reduce((a, b) => a + b, 0)) / losses.length).toFixed(2)) : 0;

    // Consecutive
    let maxConsecutiveWins = 0, maxConsecutiveLosses = 0, curW = 0, curL = 0;
    for (const trade of trades) {
      if (trade.result === 'WIN') { curW++; curL = 0; maxConsecutiveWins = Math.max(maxConsecutiveWins, curW); }
      else if (trade.result === 'LOSS') { curL++; curW = 0; maxConsecutiveLosses = Math.max(maxConsecutiveLosses, curL); }
      else { curW = 0; curL = 0; }
    }

    // Grouped stats
    const byPair = buildGroupStats(trades, (t) => t.pair);
    const byDirection = buildGroupStats(trades, (t) => t.direction);
    const bySession = buildGroupStats(trades, (t) => t.session);
    const byMarketCondition = buildGroupStats(trades, (t) => t.marketCondition);
    const byTimeframe = buildGroupStats(trades, (t) => t.timeframe);
    const bySetup = buildGroupStats(trades, (t) => t.setup || 'N/A');

    // Day of week (1=Mon, 7=Sun)
    const byDay = buildGroupStats(trades, (t) => {
      const d = new Date(t.date);
      return String(d.getDay() === 0 ? 7 : d.getDay()); // 1=Mon...7=Sun
    });

    // Hour
    const byHour = buildGroupStats(trades, (t) => {
      if (t.entryTime) return t.entryTime.split(':')[0];
      const d = new Date(t.date);
      return String(d.getHours());
    });

    // Month (YYYY-MM)
    const byMonth = buildGroupStats(trades, (t) => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    });

    // Week (YYYY-WNN)
    const byWeek = buildGroupStats(trades, (t) => {
      const d = new Date(t.date);
      const startOfYear = new Date(d.getFullYear(), 0, 1);
      const weekNum = Math.ceil(((d.getTime() - startOfYear.getTime()) / 86400000 + startOfYear.getDay() + 1) / 7);
      return `${d.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
    });

    // RR Distribution
    const rrRanges = [
      { range: '0-1', min: 0, max: 1 },
      { range: '1-2', min: 1, max: 2 },
      { range: '2-3', min: 2, max: 3 },
      { range: '3-5', min: 3, max: 5 },
      { range: '5-10', min: 5, max: 10 },
      { range: '10+', min: 10, max: Infinity },
    ];
    const rrDistribution = rrRanges.map(({ range, min, max }) => ({
      range,
      count: rrValues.filter((rr) => rr >= min && (max === Infinity ? true : rr < max)).length,
    }));

    // Cumulative RR
    let cumRR = 0;
    const cumulativeRR = rrValues.map((rr, i) => {
      cumRR += rr;
      return { tradeNumber: i + 1, cumulativeRR: parseFloat(cumRR.toFixed(2)) };
    });

    // Moving Average (up to 20 trades) — works from trade 1 with expanding window
    const windowSize = 20;
    const movingAvgRR = rrValues.map((_, i) => {
      const startIdx = Math.max(0, i - windowSize + 1);
      const window = rrValues.slice(startIdx, i + 1);
      return { tradeNumber: i + 1, avgRR: parseFloat((window.reduce((a, b) => a + b, 0) / window.length).toFixed(2)) };
    });

    return NextResponse.json({
      stats: {
        totalTrades,
        wins: wins.length,
        losses: losses.length,
        bes: bes.length,
        winRate,
        totalRR,
        avgRR,
        bestRR,
        worstRR,
        stdDeviation,
        totalPnL,
        grossProfit: parseFloat(grossProfit.toFixed(2)),
        grossLoss: parseFloat(grossLoss.toFixed(2)),
        profitFactor,
        avgWin,
        avgLoss,
        maxConsecutiveWins,
        maxConsecutiveLosses,
        byPair,
        byDirection,
        bySession,
        byMarketCondition,
        byTimeframe,
        bySetup,
        byDay,
        byHour,
        byMonth,
        byWeek,
        rrDistribution,
        cumulativeRR,
        movingAvgRR,
      },
    });
  } catch (error) {
    console.error('Stats GET error:', error);
    return NextResponse.json({ error: 'Erreur stats' }, { status: 500 });
  }
}
