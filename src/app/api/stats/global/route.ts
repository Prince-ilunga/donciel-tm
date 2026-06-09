import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

function buildGroupStats(trades: any[], keyFn: (t: any) => string) {
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
      avgRR: g.rrValues.length > 0 ? parseFloat((g.rrValues.reduce((a: number, b: number) => a + b, 0) / g.rrValues.length).toFixed(2)) : 0,
      totalRR: parseFloat(g.totalRR.toFixed(2)),
      totalPnL: parseFloat(g.totalPnL.toFixed(2)),
    };
  }
  return result;
}

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const where: Record<string, unknown> = { user: { status: 'approved' } };

    const trades = await db.trade.findMany({
      where,
      select: {
        id: true, userId: true, pair: true, direction: true, session: true,
        marketCondition: true, timeframe: true, setup: true, rr: true, pnl: true,
        result: true, date: true, entryTime: true,
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { date: 'asc' },
    });

    const totalTrades = trades.length;
    const wins = trades.filter((t: any) => t.result === 'WIN');
    const losses = trades.filter((t: any) => t.result === 'LOSS');
    const winRate = totalTrades > 0 ? parseFloat(((wins.length / totalTrades) * 100).toFixed(2)) : 0;

    const rrValues = trades.filter((t: any) => t.rr !== null).map((t: any) => t.rr as number);
    const totalRR = rrValues.length > 0 ? parseFloat(rrValues.reduce((a, b) => a + b, 0).toFixed(2)) : 0;
    const avgRR = rrValues.length > 0 ? parseFloat((rrValues.reduce((a, b) => a + b, 0) / rrValues.length).toFixed(2)) : 0;

    const pnlValues = trades.filter((t: any) => t.pnl !== null).map((t: any) => t.pnl as number);
    const totalPnL = pnlValues.length > 0 ? parseFloat(pnlValues.reduce((a, b) => a + b, 0).toFixed(2)) : 0;
    const grossProfit = pnlValues.filter(v => v > 0).reduce((a, b) => a + b, 0);
    const grossLoss = Math.abs(pnlValues.filter(v => v < 0).reduce((a, b) => a + b, 0));
    const profitFactor = grossLoss > 0 ? parseFloat((grossProfit / grossLoss).toFixed(2)) : grossProfit > 0 ? Infinity : 0;

    const byPair = buildGroupStats(trades, (t: any) => t.pair);
    const byDirection = buildGroupStats(trades, (t: any) => t.direction);
    const bySession = buildGroupStats(trades, (t: any) => t.session);

    const uniqueUsers = new Set(trades.map((t: any) => t.userId)).size;

    return NextResponse.json({
      stats: {
        totalTrades,
        wins: wins.length,
        losses: losses.length,
        winRate,
        totalRR,
        avgRR,
        totalPnL,
        profitFactor,
        uniqueUsers,
        byPair,
        byDirection,
        bySession,
      },
    });
  } catch (error) {
    console.error('Global stats error:', error);
    return NextResponse.json({ error: 'Erreur stats globales' }, { status: 500 });
  }
}
