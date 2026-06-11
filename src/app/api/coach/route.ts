import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// LLM API config
const LLM_API_KEY = 'Z.ai';
const LLM_CHAT_ID = 'chat-37d327cb-5893-4e17-a4a9-e4098be752b9';
const LLM_USER_ID = '26181383-7709-4b65-bdf7-0470c757aac4';
const LLM_TOKEN = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMjYxODEzODMtNzcwOS00YjY1LWJkZjctMDQ3MGM3NTdhYWM0IiwiY2hhdF9pZCI6ImNoYXQtMzdkMzI3Y2ItNTg5My00ZTE3LWE0YTktZTQwOThiZTc1MmI5IiwicGxhdGZvcm0iOiJ6YWkifQ.Y0FAcnkiB6qvQ5dPZgGdL7npfip_pYCxx_wYhwMAocw';

// Proxy URLs to try in order:
// 1. Local LLM proxy (mini-service on port 3030 — works in dev environment)
// 2. Direct internal API (works from machines on the same VPC)
// 3. Caddy gateway proxy (for external access through XTransformPort)
const LLM_PROXY_URLS = [
  'http://localhost:3030/chat/completions',
  'https://internal-api.z.ai/v1/chat/completions',
  'http://47.57.242.119:81/chat/completions?XTransformPort=3030',
];

// Build trading context from user's data for the AI coach
async function buildTradingContext(userId: string): Promise<string> {
  const trades = await db.trade.findMany({
    where: { userId },
    orderBy: { date: 'desc' },
    take: 100,
  });

  if (trades.length === 0) {
    return "Cet utilisateur n'a encore aucun trade enregistré.";
  }

  // Calculate comprehensive statistics
  const totalTrades = trades.length;
  const wins = trades.filter(t => t.result === 'WIN').length;
  const losses = trades.filter(t => t.result === 'LOSS').length;
  const bes = trades.filter(t => t.result === 'BE').length;
  const winRate = totalTrades > 0 ? ((wins / totalTrades) * 100).toFixed(1) : '0';
  const totalRR = trades.reduce((s, t) => s + (t.rr ?? 0), 0);
  const avgRR = totalTrades > 0 ? (totalRR / totalTrades).toFixed(2) : '0';
  const totalPnL = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);

  // By pair
  const byPair: Record<string, { count: number; wins: number; totalRR: number }> = {};
  trades.forEach(t => {
    if (!byPair[t.pair]) byPair[t.pair] = { count: 0, wins: 0, totalRR: 0 };
    byPair[t.pair].count++;
    if (t.result === 'WIN') byPair[t.pair].wins++;
    byPair[t.pair].totalRR += (t.rr ?? 0);
  });

  // By session
  const bySession: Record<string, { count: number; wins: number; totalRR: number }> = {};
  trades.forEach(t => {
    if (!bySession[t.session]) bySession[t.session] = { count: 0, wins: 0, totalRR: 0 };
    bySession[t.session].count++;
    if (t.result === 'WIN') bySession[t.session].wins++;
    bySession[t.session].totalRR += (t.rr ?? 0);
  });

  // By setup
  const bySetup: Record<string, { count: number; wins: number; totalRR: number }> = {};
  trades.forEach(t => {
    const setup = t.setup || 'Non défini';
    if (!bySetup[setup]) bySetup[setup] = { count: 0, wins: 0, totalRR: 0 };
    bySetup[setup].count++;
    if (t.result === 'WIN') bySetup[setup].wins++;
    bySetup[setup].totalRR += (t.rr ?? 0);
  });

  // By structure
  const byStructure: Record<string, { count: number; wins: number; totalRR: number }> = {};
  trades.forEach(t => {
    const structure = t.structure || 'Non défini';
    if (!byStructure[structure]) byStructure[structure] = { count: 0, wins: 0, totalRR: 0 };
    byStructure[structure].count++;
    if (t.result === 'WIN') byStructure[structure].wins++;
    byStructure[structure].totalRR += (t.rr ?? 0);
  });

  // By entry model
  const byEntryModel: Record<string, { count: number; wins: number; totalRR: number }> = {};
  trades.forEach(t => {
    const model = t.entryModel || 'Non défini';
    if (!byEntryModel[model]) byEntryModel[model] = { count: 0, wins: 0, totalRR: 0 };
    byEntryModel[model].count++;
    if (t.result === 'WIN') byEntryModel[model].wins++;
    byEntryModel[model].totalRR += (t.rr ?? 0);
  });

  // By direction
  const longTrades = trades.filter(t => t.direction === 'LONG');
  const shortTrades = trades.filter(t => t.direction === 'SHORT');
  const longWinRate = longTrades.length > 0 ? ((longTrades.filter(t => t.result === 'WIN').length / longTrades.length) * 100).toFixed(1) : '0';
  const shortWinRate = shortTrades.length > 0 ? ((shortTrades.filter(t => t.result === 'WIN').length / shortTrades.length) * 100).toFixed(1) : '0';

  // By market condition
  const byCondition: Record<string, { count: number; wins: number; totalRR: number }> = {};
  trades.forEach(t => {
    if (!byCondition[t.marketCondition]) byCondition[t.marketCondition] = { count: 0, wins: 0, totalRR: 0 };
    byCondition[t.marketCondition].count++;
    if (t.result === 'WIN') byCondition[t.marketCondition].wins++;
    byCondition[t.marketCondition].totalRR += (t.rr ?? 0);
  });

  // Recent form (last 10 trades)
  const recent10 = trades.slice(0, 10);
  const recent10Wins = recent10.filter(t => t.result === 'WIN').length;
  const recent10RR = recent10.reduce((s, t) => s + (t.rr ?? 0), 0);

  // Consecutive streaks
  let maxConsecWins = 0, maxConsecLosses = 0, currWins = 0, currLosses = 0;
  trades.forEach(t => {
    if (t.result === 'WIN') { currWins++; currLosses = 0; maxConsecWins = Math.max(maxConsecWins, currWins); }
    else if (t.result === 'LOSS') { currLosses++; currWins = 0; maxConsecLosses = Math.max(maxConsecLosses, currLosses); }
    else { currWins = 0; currLosses = 0; }
  });

  // News impact
  const withNews = trades.filter(t => t.newsEnabled);
  const withoutNews = trades.filter(t => !t.newsEnabled);
  const newsWinRate = withNews.length > 0 ? ((withNews.filter(t => t.result === 'WIN').length / withNews.length) * 100).toFixed(1) : 'N/A';
  const noNewsWinRate = withoutNews.length > 0 ? ((withoutNews.filter(t => t.result === 'WIN').length / withoutNews.length) * 100).toFixed(1) : 'N/A';

  // Emotions analysis
  const emotionsTrades = trades.filter(t => t.emotions);
  const commonEmotions: Record<string, number> = {};
  emotionsTrades.forEach(t => {
    if (t.emotions) {
      t.emotions.split(',').map(e => e.trim().toLowerCase()).forEach(e => {
        if (e) commonEmotions[e] = (commonEmotions[e] || 0) + 1;
      });
    }
  });
  const topEmotions = Object.entries(commonEmotions)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([e, c]) => `${e} (${c}x)`)
    .join(', ');

  // Mistakes analysis
  const mistakesTrades = trades.filter(t => t.mistakes);
  const commonMistakes: Record<string, number> = {};
  mistakesTrades.forEach(t => {
    if (t.mistakes) {
      t.mistakes.split(',').map(e => e.trim().toLowerCase()).forEach(e => {
        if (e) commonMistakes[e] = (commonMistakes[e] || 0) + 1;
      });
    }
  });
  const topMistakes = Object.entries(commonMistakes)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([e, c]) => `${e} (${c}x)`)
    .join(', ');

  let context = `## Statistiques Globales
- Total trades: ${totalTrades} (${wins} WIN, ${losses} LOSS, ${bes} BE)
- Win Rate: ${winRate}%
- RR Total: ${totalRR.toFixed(2)} | RR Moyen: ${avgRR}
- P&L Total: ${totalPnL.toFixed(2)}$
- Série max: ${maxConsecWins} wins consécutifs | ${maxConsecLosses} losses consécutives
- 10 derniers trades: ${recent10Wins}/${recent10.length} wins, RR cumulé: ${recent10RR.toFixed(2)}

## Performance par Direction
- LONG: ${longTrades.length} trades, win rate ${longWinRate}%
- SHORT: ${shortTrades.length} trades, win rate ${shortWinRate}%

## Performance par Paire`;

  Object.entries(byPair).sort((a, b) => b[1].count - a[1].count).forEach(([pair, data]) => {
    const wr = ((data.wins / data.count) * 100).toFixed(1);
    context += `\n- ${pair}: ${data.count} trades, win rate ${wr}%, RR total ${data.totalRR.toFixed(2)}`;
  });

  context += '\n## Performance par Session';
  Object.entries(bySession).sort((a, b) => b[1].totalRR - a[1].totalRR).forEach(([session, data]) => {
    const wr = ((data.wins / data.count) * 100).toFixed(1);
    context += `\n- ${session}: ${data.count} trades, win rate ${wr}%, RR total ${data.totalRR.toFixed(2)}`;
  });

  context += '\n## Performance par Setup';
  Object.entries(bySetup).sort((a, b) => b[1].totalRR - a[1].totalRR).forEach(([setup, data]) => {
    const wr = ((data.wins / data.count) * 100).toFixed(1);
    context += `\n- ${setup}: ${data.count} trades, win rate ${wr}%, RR total ${data.totalRR.toFixed(2)}`;
  });

  context += '\n## Performance par Structure';
  Object.entries(byStructure).sort((a, b) => b[1].totalRR - a[1].totalRR).forEach(([structure, data]) => {
    const wr = ((data.wins / data.count) * 100).toFixed(1);
    context += `\n- ${structure}: ${data.count} trades, win rate ${wr}%, RR total ${data.totalRR.toFixed(2)}`;
  });

  context += '\n## Performance par Modèle d\'Entrée';
  Object.entries(byEntryModel).sort((a, b) => b[1].totalRR - a[1].totalRR).forEach(([model, data]) => {
    const wr = ((data.wins / data.count) * 100).toFixed(1);
    context += `\n- ${model}: ${data.count} trades, win rate ${wr}%, RR total ${data.totalRR.toFixed(2)}`;
  });

  context += '\n## Performance par Condition de Marché';
  Object.entries(byCondition).sort((a, b) => b[1].totalRR - a[1].totalRR).forEach(([cond, data]) => {
    const wr = ((data.wins / data.count) * 100).toFixed(1);
    context += `\n- ${cond}: ${data.count} trades, win rate ${wr}%, RR total ${data.totalRR.toFixed(2)}`;
  });

  context += `\n## Impact des News
- Avec News: ${withNews.length} trades, win rate ${newsWinRate}%
- Sans News: ${withoutNews.length} trades, win rate ${noNewsWinRate}%`;

  if (topEmotions) context += `\n## Émotions fréquentes\n- ${topEmotions}`;
  if (topMistakes) context += `\n## Erreurs fréquentes\n- ${topMistakes}`;

  // Last 10 trades detail
  context += '\n## 10 Derniers Trades (détail)';
  recent10.forEach((t, i) => {
    context += `\n${i + 1}. ${t.date} | ${t.direction} ${t.pair} | ${t.setup || '-'} | RR: ${t.rr ?? 0} | ${t.result || '-'} | Session: ${t.session} | ${t.emotions ? 'Émotion: ' + t.emotions : ''} ${t.mistakes ? 'Erreur: ' + t.mistakes : ''}`;
  });

  return context;
}

const SYSTEM_PROMPT_FR = `Tu es le Coach IA Professionnel de DONCIEL TM, un journal de trading avancé. Tu es un expert en analyse de performance de trading, psychologie des marchés, et gestion du risque.

Tu as accès aux données complètes de l'utilisateur ci-dessous. Tu DOIS :
1. Répondre en français
2. Baser tes réponses EXCLUSIVEMENT sur les données réelles fournies
3. Donner des conseils concrets, actionnables et spécifiques
4. Identifier les patterns, forces et faiblesses avec des chiffres précis
5. Être direct mais encourageant — un vrai coach, pas un bot générique
6. Utiliser des emojis pour rendre tes réponses vivantes (📊 🎯 ⚡ 🔥 💡 ⚠️ ✅ ❌)
7. Quand tu identifies un problème, proposer TOUJOURS une solution concrète
8. Structurer tes réponses avec des titres et listes pour la lisibilité

Format de réponse préféré :
- 📊 **Analyse** : les faits chiffrés
- 💡 **Insight** : ce que ça signifie
- 🎯 **Action** : ce que le trader doit faire

Tu ne dois JAMAIS inventer des données. Si les données sont insuffisantes, dis-le.`;

const SYSTEM_PROMPT_EN = `You are the Professional AI Coach of DONCIEL TM, an advanced trading journal. You are an expert in trading performance analysis, market psychology, and risk management.

You have access to the user's complete data below. You MUST:
1. Respond in English
2. Base your answers EXCLUSIVELY on the real data provided
3. Give concrete, actionable and specific advice
4. Identify patterns, strengths and weaknesses with precise numbers
5. Be direct but encouraging — a real coach, not a generic bot
6. Use emojis to make your responses lively (📊 🎯 ⚡ 🔥 💡 ⚠️ ✅ ❌)
7. When you identify a problem, ALWAYS propose a concrete solution
8. Structure your responses with headings and lists for readability

Preferred response format:
- 📊 **Analysis**: the factual numbers
- 💡 **Insight**: what it means
- 🎯 **Action**: what the trader should do

Never invent data. If data is insufficient, say so.`;

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { message, history, language } = await request.json();

    if (!message) {
      return NextResponse.json({ error: 'Message requis' }, { status: 400 });
    }

    // Build trading context
    const tradingContext = await buildTradingContext(result.user.id);

    const systemPrompt = language === 'fr' ? SYSTEM_PROMPT_FR : SYSTEM_PROMPT_EN;
    const fullSystemPrompt = `${systemPrompt}\n\n## DONNÉES DE L'UTILISATEUR\n\n${tradingContext}`;

    // Build messages array
    const messages: { role: string; content: string }[] = [
      { role: 'assistant', content: fullSystemPrompt },
    ];

    // Add conversation history (max last 10 messages to keep context manageable)
    if (history && Array.isArray(history)) {
      const recentHistory = history.slice(-10);
      recentHistory.forEach((msg: { role: string; content: string }) => {
        messages.push(msg);
      });
    }

    // Add current user message
    messages.push({ role: 'user', content: message });

    // Call LLM via proxy with fallback logic
    // Try local proxy first (works in dev), then direct API (works on same VPC)
    let completion: any = null;
    let lastError: string = '';

    for (const proxyUrl of LLM_PROXY_URLS) {
      try {
        const isLocalProxy = proxyUrl.includes('localhost:3030') || proxyUrl.includes('XTransformPort');
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };

        // Local proxy handles auth internally; direct API needs auth headers
        if (!isLocalProxy) {
          headers['Authorization'] = `Bearer ${LLM_API_KEY}`;
          headers['X-Z-AI-From'] = 'Z';
          headers['X-Chat-Id'] = LLM_CHAT_ID;
          headers['X-User-Id'] = LLM_USER_ID;
          headers['X-Token'] = LLM_TOKEN;
        }

        const llmResponse = await fetch(proxyUrl, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages,
            thinking: { type: 'disabled' },
          }),
          signal: AbortSignal.timeout(60000), // 60s timeout
        });

        if (!llmResponse.ok) {
          const errBody = await llmResponse.text();
          lastError = `API error ${llmResponse.status}: ${errBody.substring(0, 100)}`;
          continue; // Try next URL
        }

        completion = await llmResponse.json();
        break; // Success — stop trying
      } catch (err: any) {
        lastError = err?.message || 'Connection failed';
        continue; // Try next URL
      }
    }

    if (!completion) {
      throw new Error(
        language === 'fr'
          ? 'Impossible de contacter le serveur IA. Veuillez réessayer.'
          : 'Unable to reach the AI server. Please try again.'
      );
    }

    const response = completion.choices[0]?.message?.content;

    if (!response) {
      return NextResponse.json(
        { error: language === 'fr' ? 'Pas de réponse du coach' : 'No response from coach' },
        { status: 500 }
      );
    }

    return NextResponse.json({ response });
  } catch (error: any) {
    console.error('Coach API error:', error);
    const errorMessage = error?.message || 'Unknown error';
    return NextResponse.json(
      { error: `Erreur coach IA: ${errorMessage}` },
      { status: 500 }
    );
  }
}
