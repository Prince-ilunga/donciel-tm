import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes (briefing changes less frequently)

// System prompts for LLM
const BRIEFING_SYSTEM_PROMPT_FR = `Tu es DONCIEL-AI™, un analyste de marché matinal expert. Tu génères des briefings matinaux complets pour les traders avec des scénarios probabilistes.

RÈGLES STRICTES :
1. Le briefing doit couvrir la session asiatique (ce qui s'est passé la nuit), le résumé overnight, et les attentes pour la journée
2. Les scénarios doivent être réalistes et basés sur les données factuelles
3. Les probabilités des 3 scénarios doivent totaliser 100%
4. Les niveaux clés doivent inclure des niveaux de support/résistance concrets
5. Les événements à risque doivent lister les événements économiques du jour avec heure
6. Le style doit être professionnel, concis et actionnable
7. Inclure des données chiffrées quand disponibles (indices, taux, prix)

Tu réponds TOUJOURS au format JSON demandé, sans texte additionnel.`;

const BRIEFING_SYSTEM_PROMPT_EN = `You are DONCIEL-AI™, an expert morning market analyst. You generate comprehensive morning briefings for traders with probabilistic scenarios.

STRICT RULES:
1. The briefing must cover the Asian session (what happened overnight), overnight summary, and expectations for the day
2. Scenarios must be realistic and based on factual data
3. The probabilities of the 3 scenarios must total 100%
4. Key levels must include concrete support/resistance levels
5. Risk events must list the day's economic events with times
6. The style must be professional, concise and actionable
7. Include numerical data when available (indices, rates, prices)

You ALWAYS respond in the requested JSON format, with no additional text.`;

async function fetchBriefingData(lang: string, period: string = 'today'): Promise<{
  summary: string;
  asia: string;
  today: string;
  keyLevels: string[];
  scenarios: { name: string; probability: number; description: string }[];
  riskEvents: string[];
  updatedAt: string;
  error?: string;
}> {
  const isFr = lang === 'fr';

  const fallbackResult = {
    summary: isFr ? 'Données de briefing temporairement indisponibles.' : 'Briefing data temporarily unavailable.',
    asia: isFr ? 'Session asiatique : données non disponibles.' : 'Asian session: data unavailable.',
    today: isFr ? 'Événements du jour : données non disponibles.' : "Today's events: data unavailable.",
    keyLevels: [],
    scenarios: [
      { name: isFr ? 'Haussier' : 'Bullish', probability: 33, description: isFr ? 'Données insuffisantes' : 'Insufficient data' },
      { name: 'Neutre', probability: 34, description: isFr ? 'Données insuffisantes' : 'Insufficient data' },
      { name: isFr ? 'Baissier' : 'Bearish', probability: 33, description: isFr ? 'Données insuffisantes' : 'Insufficient data' },
    ],
    riskEvents: [],
    updatedAt: new Date().toISOString(),
  };

  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    const isWeek = period === 'week';
    const recencyDays = isWeek ? 7 : 1;

    // 1. Search for overnight / Asian session data
    let overnightData = '';
    try {
      const overnightResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? isWeek
            ? 'marchés asiatiques cette semaine Nikkei Hang Seng Shanghai Wall Street futures performance'
            : 'marchés asiatiques aujourd\'hui Nikkei Hang Seng Shanghai overnight Wall Street futures'
          : isWeek
            ? 'Asian markets this week Nikkei Hang Seng Shanghai Wall Street futures performance'
            : 'Asian markets today Nikkei Hang Seng Shanghai overnight Wall Street futures',
        num: 6,
        recency_days: recencyDays,
      });
      if (Array.isArray(overnightResults)) {
        overnightData = overnightResults
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Briefing overnight search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 2. Search for today's market outlook and key events
    let outlookData = '';
    try {
      const outlookResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? isWeek
            ? 'prévisions marché cette semaine forex indices matières premières événements économiques'
            : 'prévisions marché aujourd\'hui forex indices matières premières événements économiques'
          : isWeek
            ? 'market outlook this week forex indices commodities economic events schedule'
            : 'market outlook today forex indices commodities economic events schedule',
        num: 6,
        recency_days: recencyDays,
      });
      if (Array.isArray(outlookResults)) {
        outlookData = outlookResults
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Briefing outlook search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 3. Search for key levels and technical data
    let technicalData = '';
    try {
      const techResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? isWeek
            ? 'niveaux clés support résistance EURUSD gold S&P 500 Nasdaq cette semaine analyse technique'
            : 'niveaux clés support résistance EURUSD gold S&P 500 Nasdaq aujourd\'hui analyse technique'
          : isWeek
            ? 'key support resistance levels EURUSD gold S&P 500 Nasdaq this week technical analysis'
            : 'key support resistance levels EURUSD gold S&P 500 Nasdaq today technical analysis',
        num: 5,
        recency_days: recencyDays,
      });
      if (Array.isArray(techResults)) {
        technicalData = techResults
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Briefing technical search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Check if we have any data
    const allData = [overnightData, outlookData, technicalData].filter(Boolean);
    if (allData.length === 0) {
      return { ...fallbackResult, error: isFr ? 'Aucune donnée de marché disponible' : 'No market data available' };
    }

    // 4. Use LLM to generate comprehensive briefing
    const systemPrompt = isFr ? BRIEFING_SYSTEM_PROMPT_FR : BRIEFING_SYSTEM_PROMPT_EN;
    const combinedData = [
      overnightData ? `=== SESSION ASIATIQUE / OVERNIGHT ===\n${overnightData}` : '',
      outlookData ? `=== PRÉVISIONS / ÉVÉNEMENTS DU JOUR ===\n${outlookData}` : '',
      technicalData ? `=== NIVEAUX CLÉS / TECHNIQUE ===\n${technicalData}` : '',
    ].filter(Boolean).join('\n\n');

    const today = new Date();
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = isFr ? dayNames[today.getDay()] : dayNamesEn[today.getDay()];

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: isFr
            ? `Génère le briefing${isWeek ? ' hebdomadaire' : ' matinal'} DONCIEL™ pour ${dayName} ${today.toLocaleDateString('fr-FR')}.

${isWeek ? 'Période demandée: CETTE SEMAINE. Couvre les événements et tendances de toute la semaine.' : 'Période demandée: AUJOURD\'HUI. Couvre la session overnight et les attentes pour la journée.'}

DONNÉES COLLECTÉES:
${combinedData}

Réponds au format JSON suivant:
{
  "summary": "Résumé de la session overnight en 3-4 phrases avec données chiffrées (indices, taux, prix)",
  "asia": "Résumé de la session asiatique en 2-3 phrases avec performances des indices",
  "today": "Événements clés attendus aujourd'hui en 2-3 phrases",
  "keyLevels": ["EUR/USD: niveau clé avec contexte", "Gold: niveau clé avec contexte", "S&P 500: niveau clé", "..."],
  "scenarios": [
    { "name": "Haussier", "probability": pourcentage, "description": "Conditions et catalyseurs pour ce scénario en 2 phrases" },
    { "name": "Neutre", "probability": pourcentage, "description": "Conditions pour ce scénario en 2 phrases" },
    { "name": "Baissier", "probability": pourcentage, "description": "Conditions et risques pour ce scénario en 2 phrases" }
  ],
  "riskEvents": ["Événement économique HH:MM", "..."]
}`
            : `Generate the ${isWeek ? 'weekly' : 'morning'} DONCIEL™ briefing for ${dayName} ${today.toLocaleDateString('en-US')}.

${isWeek ? 'Requested period: THIS WEEK. Cover events and trends for the entire week.' : 'Requested period: TODAY. Cover the overnight session and expectations for the day.'}

COLLECTED DATA:
${combinedData}

Respond in the following JSON format:
{
  "summary": "Overnight session summary in 3-4 sentences with numerical data (indices, rates, prices)",
  "asia": "Asian session summary in 2-3 sentences with index performances",
  "today": "Key events expected today in 2-3 sentences",
  "keyLevels": ["EUR/USD: key level with context", "Gold: key level with context", "S&P 500: key level", "..."],
  "scenarios": [
    { "name": "Bullish", "probability": percentage, "description": "Conditions and catalysts for this scenario in 2 sentences" },
    { "name": "Neutral", "probability": percentage, "description": "Conditions for this scenario in 2 sentences" },
    { "name": "Bearish", "probability": percentage, "description": "Conditions and risks for this scenario in 2 sentences" }
  ],
  "riskEvents": ["Economic event HH:MM", "..."]
}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices[0]?.message?.content || '';
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          summary: parsed.summary || fallbackResult.summary,
          asia: parsed.asia || fallbackResult.asia,
          today: parsed.today || fallbackResult.today,
          keyLevels: Array.isArray(parsed.keyLevels) ? parsed.keyLevels : [],
          scenarios: Array.isArray(parsed.scenarios) ? parsed.scenarios : fallbackResult.scenarios,
          riskEvents: Array.isArray(parsed.riskEvents) ? parsed.riskEvents : [],
          updatedAt: new Date().toISOString(),
        };
      }
    } catch {}

    return fallbackResult;
  } catch (error) {
    console.error('Briefing API error:', error instanceof Error ? error.message : 'Unknown error');
    return { ...fallbackResult, error: isFr ? 'Service temporairement indisponible' : 'Service temporarily unavailable' };
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') === 'en' ? 'en' : 'fr';
    const period = searchParams.get('period') === 'week' ? 'week' : 'today';

    // Check cache
    const cacheKey = `briefing-${lang}-${period}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchBriefingData(lang, period);

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Briefing route error:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération du briefing',
        summary: 'Briefing temporarily unavailable.',
        asia: 'Data unavailable.',
        today: 'Data unavailable.',
        keyLevels: [],
        scenarios: [
          { name: 'Bullish', probability: 33, description: 'Insufficient data' },
          { name: 'Neutral', probability: 34, description: 'Insufficient data' },
          { name: 'Bearish', probability: 33, description: 'Insufficient data' },
        ],
        riskEvents: [],
        updatedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
