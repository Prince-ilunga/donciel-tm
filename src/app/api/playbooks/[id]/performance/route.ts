import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { id } = await params;

    // Verify playbook belongs to user
    const playbook = await db.playbook.findFirst({
      where: { id, userId: result.user.id },
    });

    if (!playbook) {
      return NextResponse.json(
        { error: 'Playbook non trouvé' },
        { status: 404 }
      );
    }

    // Fetch all trades linked to this playbook
    const trades = await db.trade.findMany({
      where: { playbookId: id, userId: result.user.id },
      orderBy: { date: 'desc' },
    });

    const totalTrades = trades.length;
    const wins = trades.filter((t) => t.result === 'WIN');
    const losses = trades.filter((t) => t.result === 'LOSS');
    const bes = trades.filter((t) => t.result === 'BE');
    const winCount = wins.length;
    const lossCount = losses.length;
    const beCount = bes.length;

    // Win rate (wins / closed trades where result is not null)
    const closedTrades = trades.filter((t) => t.result !== null);
    const winRate = closedTrades.length > 0
      ? parseFloat(((winCount / closedTrades.length) * 100).toFixed(2))
      : 0;

    // Average RR (from trades with rr value)
    const tradesWithRR = trades.filter((t) => t.rr !== null && t.rr !== undefined);
    const avgRR = tradesWithRR.length > 0
      ? parseFloat((tradesWithRR.reduce((sum, t) => sum + (t.rr ?? 0), 0) / tradesWithRR.length).toFixed(2))
      : 0;

    // Total P&L
    const tradesWithPnl = trades.filter((t) => t.pnl !== null && t.pnl !== undefined);
    const totalPnl = tradesWithPnl.length > 0
      ? parseFloat(tradesWithPnl.reduce((sum, t) => sum + (t.pnl ?? 0), 0).toFixed(2))
      : 0;

    // Profit factor (gross profit / gross loss)
    const grossProfit = wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0);
    const grossLoss = Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0));
    const profitFactor = grossLoss > 0
      ? parseFloat((grossProfit / grossLoss).toFixed(2))
      : grossProfit > 0 ? Infinity : 0;

    // Average win / average loss
    const avgWin = winCount > 0
      ? parseFloat((wins.reduce((sum, t) => sum + (t.pnl ?? 0), 0) / winCount).toFixed(2))
      : 0;
    const avgLoss = lossCount > 0
      ? parseFloat((Math.abs(losses.reduce((sum, t) => sum + (t.pnl ?? 0), 0)) / lossCount).toFixed(2))
      : 0;

    // Best RR / Worst RR
    const rrValues = tradesWithRR.map((t) => t.rr as number);
    const bestRR = rrValues.length > 0 ? Math.max(...rrValues) : 0;
    const worstRR = rrValues.length > 0 ? Math.min(...rrValues) : 0;

    // Recent 10 trades
    const recentTrades = trades.slice(0, 10).map((t) => ({
      id: t.id,
      date: t.date,
      pair: t.pair,
      direction: t.direction,
      result: t.result,
      rr: t.rr,
      pnl: t.pnl,
    }));

    return NextResponse.json({
      performance: {
        totalTrades,
        winCount,
        lossCount,
        beCount,
        winRate,
        avgRR,
        totalPnl,
        profitFactor,
        avgWin,
        avgLoss,
        bestRR,
        worstRR,
        recentTrades,
      },
    });
  } catch (error) {
    console.error('Playbook Performance GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des performances du playbook' },
      { status: 500 }
    );
  }
}
