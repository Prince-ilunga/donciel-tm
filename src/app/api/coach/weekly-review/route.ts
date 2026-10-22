import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { checkCoachQuota, limitErrorResponse } from '@/lib/plan-limits';

export const dynamic = 'force-dynamic';

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Revue hebdomadaire IA (Pack 4 — Croissance & Rétention)
// POST /api/coach/weekly-review
//  → agrège les trades de la semaine en cours (lundi → dimanche)
//  → construit un contexte chiffré → LLM → { review } (markdown)
// ─────────────────────────────────────────────────────────────

function mondayOf(d: Date): Date {
  const day = d.getDay() === 0 ? 7 : d.getDay();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() - (day - 1));
}

function fmtDateFr(d: Date): string {
  return d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit' });
}

const SYSTEM_PROMPT_FR = `Tu génères la REVUE HEBDOMADAIRE d'un trader DONCIEL TM, un journal de trading professionnel.
Tu es un coach en performance de trading : direct, précis, encourageant, orienté action.

RÈGLES STRICTES :
1. Réponds UNIQUEMENT en markdown, structuré exactement ainsi :
   ## 📊 Bilan chiffré
   ## 💡 Patterns détectés
   ## ⚠️ Zones de vigilance
   ## 🎯 Plan pour la semaine prochaine
2. MAXIMUM 350 mots au total. Sois dense, aucune phrase de remplissage.
3. Base-toi EXCLUSIVEMENT sur les données chiffrées fournies. N'invente JAMAIS un chiffre.
4. Cite des chiffres précis (R, win rate, paires, sessions) dans chaque section.
5. Le plan pour la semaine prochaine doit être concret et actionnable (2 à 4 points maximum).
6. Si une donnée est absente (émotions, erreurs non journalisées), intègre-le dans les zones de vigilance.`;

const SYSTEM_PROMPT_EN = `You generate the WEEKLY REVIEW of a DONCIEL TM trader, a professional trading journal.
You are a trading performance coach: direct, precise, encouraging, action-oriented.

STRICT RULES:
1. Reply ONLY in markdown, structured exactly like this:
   ## 📊 Numbers recap
   ## 💡 Detected patterns
   ## ⚠️ Watch-outs
   ## 🎯 Plan for next week
2. MAXIMUM 350 words total. Be dense, no filler sentences.
3. Base yourself EXCLUSIVELY on the provided data. NEVER invent a number.
4. Quote precise numbers (R, win rate, pairs, sessions) in every section.
5. The plan for next week must be concrete and actionable (2 to 4 bullets maximum).
6. If a data point is missing (emotions, mistakes not journaled), include it in watch-outs.`;

interface AggregatedContext {
  totalTrades: number;
  wins: number;
  losses: number;
  bes: number;
  winRate: string;
  totalR: string;
  avgR: string;
  totalPnL: string;
  bestPair: string;
  worstPair: string;
  bestSession: string;
  worstSession: string;
  topEmotions: string;
  topMistakes: string;
  stopRespectPct: string;
  bestTrade: string;
  worstTrade: string;
  dailyLines: string[];
}

function buildWeekContext(
  trades: {
    date: Date;
    pair: string;
    session: string;
    direction: string;
    result: string | null;
    rr: number | null;
    pnl: number | null;
    emotions: string | null;
    mistakes: string | null;
    setup: string | null;
  }[]
): AggregatedContext {
  const totalTrades = trades.length;
  const wins = trades.filter((t) => t.result === 'WIN').length;
  const losses = trades.filter((t) => t.result === 'LOSS').length;
  const bes = trades.filter((t) => t.result === 'BE').length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0';

  const totalR = trades.reduce((s, t) => s + (t.rr ?? 0), 0);
  const avgR = totalTrades > 0 ? totalR / totalTrades : 0;
  const totalPnL = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  const groupBy = (keyFn: (t: (typeof trades)[number]) => string) => {
    const map: Record<string, { count: number; wins: number; totalR: number }> = {};
    for (const t of trades) {
      const k = keyFn(t);
      if (!map[k]) map[k] = { count: 0, wins: 0, totalR: 0 };
      map[k].count++;
      if (t.result === 'WIN') map[k].wins++;
      map[k].totalR += t.rr ?? 0;
    }
    return map;
  };

  const byPair = groupBy((t) => t.pair);
  const bySession = groupBy((t) => t.session);
  const rank = (map: Record<string, { count: number; wins: number; totalR: number }>, asc = false) =>
    Object.entries(map).sort((a, b) => (asc ? a[1].totalR - b[1].totalR : b[1].totalR - a[1].totalR));

  const bestPair = rank(byPair)[0];
  const worstPair = rank(byPair, true)[0];
  const bestSession = rank(bySession)[0];
  const worstSession = rank(bySession, true)[0];

  const countTerms = (field: 'emotions' | 'mistakes') => {
    const counts: Record<string, number> = {};
    for (const t of trades) {
      const raw = t[field];
      if (!raw) continue;
      raw
        .split(',')
        .map((v) => v.trim().toLowerCase())
        .filter(Boolean)
        .forEach((v) => {
          counts[v] = (counts[v] || 0) + 1;
        });
    }
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([k, c]) => `${k} (${c}x)`)
      .join(', ');
  };

  const lossTrades = trades.filter((t) => t.result === 'LOSS');
  const respected = lossTrades.filter((t) => (t.rr ?? -1) >= -1.1).length;
  const stopRespectPct =
    lossTrades.length > 0 ? ((respected / lossTrades.length) * 100).toFixed(0) : '100';

  const sortedByR = [...trades].sort((a, b) => (b.rr ?? 0) - (a.rr ?? 0));
  const fmtTrade = (t: (typeof trades)[number] | undefined) =>
    t ? `${t.pair} ${t.direction} ${t.result || ''} ${t.rr ?? 0}R (${fmtDateFr(t.date)})` : '—';

  // Agrégat par jour (lundi → dimanche)
  const byDay = new Map<string, { r: number; count: number }>();
  for (const t of trades) {
    const key = fmtDateFr(t.date);
    if (!byDay.has(key)) byDay.set(key, { r: 0, count: 0 });
    byDay.get(key)!.r += t.rr ?? 0;
    byDay.get(key)!.count++;
  }

  return {
    totalTrades,
    wins,
    losses,
    bes,
    winRate,
    totalR: totalR.toFixed(2),
    avgR: avgR.toFixed(2),
    totalPnL: totalPnL.toFixed(2),
    bestPair: bestPair ? `${bestPair[0]} (${bestPair[1].totalR.toFixed(2)}R en ${bestPair[1].count} trades)` : '—',
    worstPair: worstPair ? `${worstPair[0]} (${worstPair[1].totalR.toFixed(2)}R en ${worstPair[1].count} trades)` : '—',
    bestSession: bestSession ? `${bestSession[0]} (${bestSession[1].totalR.toFixed(2)}R)` : '—',
    worstSession: worstSession ? `${worstSession[0]} (${worstSession[1].totalR.toFixed(2)}R)` : '—',
    topEmotions: countTerms('emotions') || 'non journalisées',
    topMistakes: countTerms('mistakes') || 'non journalisées',
    stopRespectPct,
    bestTrade: fmtTrade(sortedByR[0]),
    worstTrade: fmtTrade(sortedByR[sortedByR.length - 1]),
    dailyLines: [...byDay.entries()].map(
      ([d, v]) => `- ${d} : ${v.count} trade(s), ${v.r.toFixed(2)}R`
    ),
  };
}

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // ─── Plan gating : quota mensuel du Coach IA ───
    const quotaCheck = await checkCoachQuota(result.user.id);
    if (!quotaCheck.allowed) {
      return limitErrorResponse(quotaCheck);
    }

    const userLanguage = result.user.language;
    const fr = userLanguage !== 'en';

    // Semaine en cours : lundi 00:00 → dimanche 23:59
    const now = new Date();
    const monday = mondayOf(now);
    monday.setHours(0, 0, 0, 0);
    const sundayEnd = new Date(monday);
    sundayEnd.setDate(monday.getDate() + 7); // borne exclusive

    const trades = await db.trade.findMany({
      where: {
        userId: result.user.id,
        date: { gte: monday, lt: sundayEnd },
      },
      orderBy: { date: 'asc' },
    });

    if (trades.length === 0) {
      return NextResponse.json(
        { error: fr ? 'Aucun trade cette semaine' : 'No trades this week' },
        { status: 400 }
      );
    }

    // Notes hebdo existantes (contexte : éviter les répétitions)
    let weekNotes: { title: string; date: Date }[] = [];
    try {
      weekNotes = await db.note.findMany({
        where: { userId: result.user.id, type: 'WEEK' },
        orderBy: { date: 'desc' },
        take: 3,
        select: { title: true, date: true },
      });
    } catch {
      weekNotes = [];
    }

    const ctx = buildWeekContext(trades);
    const mondayLabel = fmtDateFr(monday);
    const sundayLabel = fmtDateFr(new Date(sundayEnd.getTime() - 24 * 60 * 60 * 1000));

    const context = `## Semaine analysée
- Période : lundi ${mondayLabel} → dimanche ${sundayLabel}

## Chiffres clés
- Trades : ${ctx.totalTrades} (${ctx.wins} WIN, ${ctx.losses} LOSS, ${ctx.bes} BE)
- Win rate : ${ctx.winRate}%
- R total : ${ctx.totalR} | R moyen : ${ctx.avgR}
- P&L total : ${ctx.totalPnL}$
- Meilleure paire : ${ctx.bestPair}
- Paire la plus coûteuse : ${ctx.worstPair}
- Meilleure session : ${ctx.bestSession} | Session la plus coûteuse : ${ctx.worstSession}
- Respect du stop (-1R) sur les pertes : ${ctx.stopRespectPct}%
- Meilleur trade : ${ctx.bestTrade}
- Pire trade : ${ctx.worstTrade}

## Détail par jour
${ctx.dailyLines.join('\n') || '- aucun'}

## Journaling
- Émotions fréquentes : ${ctx.topEmotions}
- Erreurs fréquentes : ${ctx.topMistakes}
${weekNotes.length > 0 ? `\n## Notes hebdo déjà rédigées (ne pas dupliquer)\n${weekNotes.map((n) => `- ${n.title} (${fmtDateFr(n.date)})`).join('\n')}` : ''}`;

    const systemPrompt = fr ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;
    const messages: { role: string; content: string }[] = [
      { role: 'assistant', content: `${systemPrompt}\n\n## DONNÉES DE LA SEMAINE\n\n${context}` },
      {
        role: 'user',
        content: fr
          ? `Génère maintenant la revue hebdomadaire (max 350 mots) pour la semaine du lundi ${mondayLabel} au dimanche ${sundayLabel}.`
          : `Generate the weekly review now (max 350 words) for the week of Monday ${mondayLabel} to Sunday ${sundayLabel}.`,
      },
    ];

    // Appel LLM unifié (sandbox SDK / proxy Vercel)
    const { callZAI } = await import('@/lib/zai');
    const completion = await callZAI(messages);
    const review: string | undefined = completion?.choices?.[0]?.message?.content;

    if (!review) {
      return NextResponse.json(
        { error: fr ? 'Pas de réponse de la revue IA' : 'No response from the review engine' },
        { status: 500 }
      );
    }

    return NextResponse.json({ review });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Weekly review API error:', error);
    return NextResponse.json(
      { error: `Erreur revue hebdo IA: ${message}` },
      { status: 500 }
    );
  }
}
