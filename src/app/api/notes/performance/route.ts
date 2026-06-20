import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const where: Record<string, unknown> = {
      userId: result.user.id,
    };

    if (dateFrom || dateTo) {
      where.date = {
        ...(dateFrom && { gte: new Date(dateFrom) }),
        ...(dateTo && { lte: new Date(dateTo) }),
      };
    }

    const trades = await db.trade.findMany({
      where,
      orderBy: { date: 'desc' },
      select: {
        id: true,
        date: true,
        pair: true,
        direction: true,
        result: true,
        pnl: true,
        rr: true,
        session: true,
        emotions: true,
      },
    });

    // Compute summary stats
    const wins = trades.filter(t => t.result === 'WIN').length;
    const losses = trades.filter(t => t.result === 'LOSS').length;
    const bes = trades.filter(t => t.result === 'BE').length;
    const totalPnL = trades.reduce((sum, t) => sum + (t.pnl || 0), 0);
    const totalRR = trades.reduce((sum, t) => sum + (t.rr || 0), 0);
    const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

    // Mood-performance correlation from notes
    const notes = await db.note.findMany({
      where: {
        userId: result.user.id,
        mood: { not: null },
      },
      select: {
        date: true,
        mood: true,
        confidence: true,
        marketBias: true,
      },
    });

    // Build mood map: date -> mood
    const moodMap: Record<string, { mood: string; confidence: number | null; marketBias: string | null }> = {};
    for (const note of notes) {
      const dateKey = new Date(note.date).toISOString().split('T')[0];
      if (note.mood) {
        moodMap[dateKey] = {
          mood: note.mood,
          confidence: note.confidence,
          marketBias: note.marketBias,
        };
      }
    }

    // Aggregate mood vs performance
    const moodStats: Record<string, { count: number; wins: number; totalPnL: number; avgRR: number; rrSum: number }> = {};
    for (const trade of trades) {
      const dateKey = new Date(trade.date).toISOString().split('T')[0];
      const moodData = moodMap[dateKey];
      if (moodData) {
        if (!moodStats[moodData.mood]) {
          moodStats[moodData.mood] = { count: 0, wins: 0, totalPnL: 0, avgRR: 0, rrSum: 0 };
        }
        moodStats[moodData.mood].count++;
        if (trade.result === 'WIN') moodStats[moodData.mood].wins++;
        moodStats[moodData.mood].totalPnL += trade.pnl || 0;
        moodStats[moodData.mood].rrSum += trade.rr || 0;
      }
    }

    // Calculate averages
    for (const key of Object.keys(moodStats)) {
      const s = moodStats[key];
      s.avgRR = s.count > 0 ? s.rrSum / s.count : 0;
    }

    return NextResponse.json({
      trades,
      summary: {
        totalTrades: trades.length,
        wins,
        losses,
        bes,
        winRate: Math.round(winRate * 10) / 10,
        totalPnL: Math.round(totalPnL * 100) / 100,
        totalRR: Math.round(totalRR * 100) / 100,
        avgRR: trades.length > 0 ? Math.round((totalRR / trades.length) * 100) / 100 : 0,
      },
      moodStats,
      moodMap,
    });
  } catch (error) {
    console.error('Notes performance error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des performances' },
      { status: 500 }
    );
  }
}
