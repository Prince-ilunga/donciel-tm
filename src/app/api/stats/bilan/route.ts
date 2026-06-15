import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

type TradeRecord = {
  id: string;
  pair: string;
  direction: string;
  session: string;
  marketCondition: string;
  timeframe: string;
  setup: string | null;
  structure: string | null;
  entryModel: string | null;
  entryTime: string | null;
  duration: string | null;
  rr: number | null;
  pnl: number | null;
  result: string | null;
  date: Date;
};

interface ConfigStats {
  key: string;
  label: string;
  category: string;
  count: number;
  wins: number;
  winRate: number;
  totalRR: number;
  avgRR: number;
  totalPnL: number;
  performance: 'best' | 'average' | 'weak';
}

function buildConfigs(
  trades: TradeRecord[],
  keyFn: (t: TradeRecord) => string,
  category: string
): ConfigStats[] {
  const groups: Record<string, { count: number; wins: number; totalRR: number; totalPnL: number; rrValues: number[] }> = {};
  for (const trade of trades) {
    const key = keyFn(trade);
    if (!groups[key]) groups[key] = { count: 0, wins: 0, totalRR: 0, totalPnL: 0, rrValues: [] };
    groups[key].count++;
    if (trade.result === 'WIN') groups[key].wins++;
    if (trade.rr !== null) { groups[key].totalRR += trade.rr; groups[key].rrValues.push(trade.rr); }
    if (trade.pnl !== null) groups[key].totalPnL += trade.pnl;
  }

  const configs: ConfigStats[] = [];
  for (const [key, g] of Object.entries(groups)) {
    if (g.count < 1) continue;
    configs.push({
      key,
      label: key,
      category,
      count: g.count,
      wins: g.wins,
      winRate: g.count > 0 ? parseFloat(((g.wins / g.count) * 100).toFixed(1)) : 0,
      totalRR: parseFloat(g.totalRR.toFixed(2)),
      avgRR: g.rrValues.length > 0 ? parseFloat((g.rrValues.reduce((a, b) => a + b, 0) / g.rrValues.length).toFixed(2)) : 0,
      totalPnL: parseFloat(g.totalPnL.toFixed(2)),
      performance: 'average',
    });
  }
  return configs;
}

function classifyByDimension(configs: ConfigStats[]): ConfigStats[] {
  if (configs.length === 0) return [];
  if (configs.length === 1) {
    configs[0].performance = configs[0].winRate >= 50 && configs[0].avgRR >= 0 ? 'best' : configs[0].winRate < 35 ? 'weak' : 'average';
    return configs;
  }

  // Composite score: 60% winRate + 40% normalized avgRR
  const maxAvgRR = Math.max(...configs.map(c => Math.abs(c.avgRR)), 1);

  const scored = configs.map(c => {
    const normalizedRR = ((c.avgRR / maxAvgRR) + 1) / 2 * 100;
    const score = 0.6 * c.winRate + 0.4 * normalizedRR;
    return { config: c, score };
  });

  scored.sort((a, b) => b.score - a.score);

  const total = scored.length;
  const bestCount = Math.max(1, Math.ceil(total * 0.33));
  const weakCount = Math.max(1, Math.ceil(total * 0.33));

  for (let i = 0; i < scored.length; i++) {
    if (i < bestCount) {
      scored[i].config.performance = 'best';
    } else if (i >= total - weakCount) {
      scored[i].config.performance = 'weak';
    } else {
      scored[i].config.performance = 'average';
    }
  }

  // Override: absolute thresholds
  for (const item of scored) {
    if (item.config.winRate >= 60 && item.config.avgRR > 0) {
      item.config.performance = 'best';
    } else if (item.config.winRate < 30 || (item.config.winRate < 40 && item.config.avgRR < -0.3)) {
      item.config.performance = 'weak';
    }
  }

  return scored.map(s => s.config);
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await getAuthUser();
    if (authResult.error) {
      return NextResponse.json({ error: authResult.error }, { status: 401 });
    }

    const trades = await db.trade.findMany({
      where: { userId: authResult.user.id },
      select: {
        id: true, pair: true, direction: true, session: true,
        marketCondition: true, timeframe: true, setup: true,
        structure: true, entryModel: true, entryTime: true,
        duration: true, rr: true, pnl: true, result: true, date: true,
      },
      orderBy: { date: 'desc' },
    }) as unknown as TradeRecord[];

    if (trades.length === 0) {
      return NextResponse.json({ bilan: { best: [], average: [], weak: [] } });
    }

    const allConfigs: ConfigStats[] = [
      ...buildConfigs(trades, (t) => t.pair, 'Paire'),
      ...buildConfigs(trades, (t) => t.direction, 'Direction'),
      ...buildConfigs(trades, (t) => t.session, 'Session'),
      ...buildConfigs(trades, (t) => t.marketCondition, 'Condition'),
      ...buildConfigs(trades, (t) => t.timeframe, 'Timeframe'),
      ...buildConfigs(trades, (t) => t.setup || 'N/A', 'Setup'),
      ...buildConfigs(trades, (t) => t.structure || 'N/A', 'Structure'),
      ...buildConfigs(trades, (t) => t.entryModel || 'N/A', 'Modèle'),
      ...buildConfigs(trades, (t) => {
        if (!t.duration) return 'N/A';
        const dur = t.duration.toLowerCase();
        if (dur.includes('min')) {
          const mins = parseInt(dur);
          if (mins <= 15) return '0-15min';
          if (mins <= 30) return '15-30min';
          if (mins <= 60) return '30-60min';
          return '60+min';
        }
        if (dur.includes('h') || dur.includes('heure')) return '1h+';
        return dur;
      }, 'Durée'),
      ...buildConfigs(trades, (t) => {
        if (!t.entryTime) return 'N/A';
        const hour = parseInt(t.entryTime.split(':')[0]);
        if (hour >= 6 && hour < 10) return '06h-10h';
        if (hour >= 10 && hour < 14) return '10h-14h';
        if (hour >= 14 && hour < 18) return '14h-18h';
        if (hour >= 18 && hour < 22) return '18h-22h';
        return '22h-06h';
      }, 'Timing'),
    ];

    // Classify each dimension independently
    const dimensions = ['Paire', 'Direction', 'Session', 'Condition', 'Timeframe', 'Setup', 'Structure', 'Modèle', 'Durée', 'Timing'];
    const classifiedConfigs: ConfigStats[] = [];

    for (const dim of dimensions) {
      const dimConfigs = allConfigs.filter(c => c.category === dim);
      const classified = classifyByDimension(dimConfigs);
      classifiedConfigs.push(...classified);
    }

    const best = classifiedConfigs
      .filter(c => c.performance === 'best')
      .sort((a, b) => {
        if (b.winRate !== a.winRate) return b.winRate - a.winRate;
        return b.avgRR - a.avgRR;
      });

    const average = classifiedConfigs
      .filter(c => c.performance === 'average')
      .sort((a, b) => b.winRate - a.winRate || b.avgRR - a.avgRR);

    const weak = classifiedConfigs
      .filter(c => c.performance === 'weak')
      .sort((a, b) => a.winRate - b.winRate || a.avgRR - b.avgRR);

    return NextResponse.json({
      bilan: { best, average, weak },
    });
  } catch (error) {
    console.error('BILAN stats error:', error);
    return NextResponse.json({ error: 'Erreur bilan' }, { status: 500 });
  }
}
