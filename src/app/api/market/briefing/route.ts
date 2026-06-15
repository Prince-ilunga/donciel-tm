import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { XMLParser } from 'fast-xml-parser';

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 10 * 60 * 1000; // 10 minutes
const CACHE_DURATION_WEEK = 15 * 60 * 1000; // 15 minutes for weekly

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ──────────────────────────────────────────────────────
// Asset-specific briefing data
// ──────────────────────────────────────────────────────

const ASSET_BRIEFING_DATA: Record<string, {
  keyLevelsFr: string[];
  keyLevelsEn: string[];
  bullAdjFr: string;
  bullAdjEn: string;
  bearAdjFr: string;
  bearAdjEn: string;
  neutralAdjFr: string;
  neutralAdjEn: string;
  riskKeywords: string[];
}> = {
  XAUUSD: {
    keyLevelsFr: [
      'XAU/USD: Support 2 300 / Résistance 2 400',
      'DXY: Support 104.00 / Résistance 105.50',
      'Rendements 10 ans US: Support 4.20% / Résistance 4.50%',
    ],
    keyLevelsEn: [
      'XAU/USD: Support 2300 / Resistance 2400',
      'DXY: Support 104.00 / Resistance 105.50',
      'US 10Y Yields: Support 4.20% / Resistance 4.50%',
    ],
    bullAdjFr: 'L\'or bénéficie de la faiblesse du dollar et des anticipations de baisse de taux.',
    bullAdjEn: 'Gold benefits from dollar weakness and rate cut expectations.',
    bearAdjFr: 'L\'or sous pression face à un dollar fort et des rendements élevés.',
    bearAdjEn: 'Gold under pressure from a strong dollar and elevated yields.',
    neutralAdjFr: 'L\'or évolue dans un range, en attente de catalyseurs (Fed, inflation).',
    neutralAdjEn: 'Gold trading in a range, awaiting catalysts (Fed, inflation).',
    riskKeywords: ['gold', 'xau', 'fed', 'inflation', 'dollar', 'treasury', 'yields', 'safe haven'],
  },
  EURUSD: {
    keyLevelsFr: [
      'EUR/USD: Support 1.0800 / Résistance 1.0950',
      'DXY: Support 104.00 / Résistance 105.50',
      'Spread Bund-OAT: Surveillance risque périphérique',
    ],
    keyLevelsEn: [
      'EUR/USD: Support 1.0800 / Resistance 1.0950',
      'DXY: Support 104.00 / Resistance 105.50',
      'Bund-OAT spread: Watch peripheral risk',
    ],
    bullAdjFr: 'L\'euro soutenu par des données zone euro solides et/ou un dollar faible.',
    bullAdjEn: 'Euro supported by solid eurozone data and/or weak dollar.',
    bearAdjFr: 'L\'euro sous pression face à un dollar fort ou des données EU décevantes.',
    bearAdjEn: 'Euro under pressure from strong dollar or disappointing EU data.',
    neutralAdjFr: 'EUR/USD en range, en attente de données US ou de la BCE.',
    neutralAdjEn: 'EUR/USD ranging, awaiting US data or ECB.',
    riskKeywords: ['euro', 'ecb', 'eur', 'dollar', 'fed', 'germany', 'eu ', 'bce'],
  },
  GBPUSD: {
    keyLevelsFr: [
      'GBP/USD: Support 1.2600 / Résistance 1.2800',
      'EUR/GBP: Support 0.8500 / Résistance 0.8650',
      'Gilt 10 ans: Surveillance rendements UK',
    ],
    keyLevelsEn: [
      'GBP/USD: Support 1.2600 / Resistance 1.2800',
      'EUR/GBP: Support 0.8500 / Resistance 0.8650',
      'UK 10Y Gilt: Watch UK yields',
    ],
    bullAdjFr: 'La livre soutenue par le maintien des taux BdA et/ou un dollar faible.',
    bullAdjEn: 'Pound supported by BoE rate hold and/or weak dollar.',
    bearAdjFr: 'La livre sous pression face à des signaux BdA accommodants ou un dollar fort.',
    bearAdjEn: 'Pound under pressure from dovish BoE signals or strong dollar.',
    neutralAdjFr: 'GBP/USD en consolidation, en attente de décisions BdA.',
    neutralAdjEn: 'GBP/USD consolidating, awaiting BoE decisions.',
    riskKeywords: ['pound', 'boe', 'bank of england', 'uk', 'britain', 'sterling', 'gbp'],
  },
  US30: {
    keyLevelsFr: [
      'US30: Support 38 000 / Résistance 40 000',
      'VIX: Support 12 / Résistance 20',
      'Rendements 10 ans US: Surveillance inflation',
    ],
    keyLevelsEn: [
      'US30: Support 38000 / Resistance 40000',
      'VIX: Support 12 / Resistance 20',
      'US 10Y Yields: Watch inflation',
    ],
    bullAdjFr: 'Le Dow soutenu par de bonnes publications et un contexte de taux accommodant.',
    bullAdjEn: 'Dow supported by strong earnings and accommodative rate environment.',
    bearAdjFr: 'Le Dow sous pression face à des risques de récession ou des résultats décevants.',
    bearAdjEn: 'Dow under pressure from recession risks or disappointing earnings.',
    neutralAdjFr: 'Le Dow en range, en attente de catalyseurs (résultats, Fed).',
    neutralAdjEn: 'Dow ranging, awaiting catalysts (earnings, Fed).',
    riskKeywords: ['dow', 'stock', 'earnings', 'fed', 'rate', 'blue chip', 'market', 'equity'],
  },
  US100: {
    keyLevelsFr: [
      'US100: Support 17 500 / Résistance 19 000',
      'VIX: Support 12 / Résistance 20',
      'Semiconducteurs: Surveillance secteur tech',
    ],
    keyLevelsEn: [
      'US100: Support 17500 / Resistance 19000',
      'VIX: Support 12 / Resistance 20',
      'Semiconductors: Watch tech sector',
    ],
    bullAdjFr: 'Le Nasdaq soutenu par la dynamique IA et des résultats tech solides.',
    bullAdjEn: 'Nasdaq supported by AI momentum and strong tech earnings.',
    bearAdjFr: 'Le Nasdaq sous pression face à des valorisations élevées ou des résultats tech décevants.',
    bearAdjEn: 'Nasdaq under pressure from elevated valuations or disappointing tech earnings.',
    neutralAdjFr: 'Le Nasdaq en consolidation, en attente de catalyseurs (IA, résultats).',
    neutralAdjEn: 'Nasdaq consolidating, awaiting catalysts (AI, earnings).',
    riskKeywords: ['nasdaq', 'tech', 'ai ', 'semiconductor', 'growth', 'fed', 'rate', 'earnings'],
  },
};

function generateAssetBriefing(
  asset: string,
  sentiment: 'bullish' | 'bearish' | 'neutral',
  lang: string,
  rssItems: { title: string; snippet: string; date: string }[]
): { keyLevels: string[]; scenarioAdjustment: string; riskEvents: string[] } | null {
  const isFr = lang === 'fr';
  const data = ASSET_BRIEFING_DATA[asset.toUpperCase()];
  if (!data) return null;

  const keyLevels = isFr ? data.keyLevelsFr : data.keyLevelsEn;

  const scenarioAdjustment = sentiment === 'bullish'
    ? (isFr ? data.bullAdjFr : data.bullAdjEn)
    : sentiment === 'bearish'
    ? (isFr ? data.bearAdjFr : data.bearAdjEn)
    : (isFr ? data.neutralAdjFr : data.neutralAdjEn);

  // Filter risk events relevant to this asset
  const riskEvents = rssItems
    .filter(i => {
      const t = i.title.toLowerCase();
      return data.riskKeywords.some(kw => t.includes(kw));
    })
    .slice(0, 5)
    .map(i => i.title.length > 80 ? i.title.substring(0, 80) + '...' : i.title);

  if (riskEvents.length === 0) {
    riskEvents.push(
      isFr
        ? `Surveillez les annonces impactant ${asset.toUpperCase()}`
        : `Watch for announcements impacting ${asset.toUpperCase()}`,
      isFr
        ? 'Calendrier économique à suivre'
        : 'Economic calendar to watch'
    );
  }

  return { keyLevels, scenarioAdjustment, riskEvents };
}

// ──────────────────────────────────────────────────────
// RSS fallback (works without ZAI SDK)
// ──────────────────────────────────────────────────────

const BRIEFING_RSS_FEEDS = [
  { id: 1, name: 'Top News', keywords: ['market', 'fed', 'rate', 'inflation', 'gdp', 'employment', 'stock', 'bond', 'treasury', 'oil', 'gold', 'dollar', 'euro', 'asia', 'nikkei', 'hang seng', 'wall street', 'futures', 'marché', 'taux', 'inflation', 'emploi', 'boursier'] },
  { id: 14, name: 'Economy', keywords: ['fed', 'ecb', 'boe', 'rate', 'inflation', 'gdp', 'employment', 'consumer', 'manufacturing', 'pmi', 'economy', 'recession', 'growth', 'policy'] },
  { id: 25, name: 'Stock Market', keywords: ['dow', 'nasdaq', 'sp', 'stock', 'market', 'futures', 'wall street', 'rally', 'selloff', 'earnings', 'tech', 'index', 'asian', 'european'] },
  { id: 11, name: 'Commodities', keywords: ['gold', 'oil', 'commodit', 'fed', 'dollar', 'inflation', 'rate', 'energy', 'copper', 'silver'] },
];

function generateBriefingFromRSS(rssItems: { title: string; snippet: string; date: string }[], lang: string, period: string): {
  summary: string;
  asia: string;
  today: string;
  keyLevels: string[];
  scenarios: { name: string; probability: number; description: string }[];
  riskEvents: string[];
  updatedAt: string;
} {
  const isFr = lang === 'fr';
  const isWeek = period === 'week';

  const titles = rssItems.map(i => i.title.toLowerCase());
  const text = titles.join(' ');

  // Detect Asian market news
  const asianKeywords = ['asia', 'asian', 'nikkei', 'hang seng', 'shanghai', 'shenzhen', 'korean', 'kospi', 'japanese', 'yen', 'boj'];
  const asianItems = rssItems.filter(i => asianKeywords.some(kw => i.title.toLowerCase().includes(kw)));

  // Score sentiment
  const bullishWords = ['rally', 'surge', 'gain', 'rise', 'bullish', 'recovery', 'optimism', 'boost', 'jump', 'climb', 'strong', 'higher', 'hausse', 'rebond', 'progression'];
  const bearishWords = ['crash', 'selloff', 'fear', 'decline', 'bearish', 'recession', 'slump', 'tumble', 'plunge', 'drop', 'fall', 'weak', 'lower', 'baisse', 'chute', 'recul'];

  let bullScore = 0;
  let bearScore = 0;
  bullishWords.forEach(w => { const matches = text.match(new RegExp(w, 'gi')); if (matches) bullScore += matches.length; });
  bearishWords.forEach(w => { const matches = text.match(new RegExp(w, 'gi')); if (matches) bearScore += matches.length; });

  const isBullish = bullScore > bearScore * 1.3;
  const isBearish = bearScore > bullScore * 1.3;

  // Build summary
  const direction = isBullish
    ? (isFr ? 'haussière' : 'bullish')
    : isBearish
    ? (isFr ? 'baissière' : 'bearish')
    : (isFr ? 'neutre' : 'neutral');

  const summary = isFr
    ? `Le marché présente une tendance ${direction} ${isWeek ? 'cette semaine' : "aujourd'hui"}. ${rssItems.length > 0 ? `Basé sur ${rssItems.length} actualités récentes, ${isBullish ? "l'appétit pour le risque domine" : isBearish ? "l'aversion au risque prévaut" : "les signaux sont mitigés"}.` : "Données limitées disponibles."}`
    : `The market shows a ${direction} trend ${isWeek ? 'this week' : 'today'}. ${rssItems.length > 0 ? `Based on ${rssItems.length} recent news items, ${isBullish ? "risk appetite dominates" : isBearish ? "risk aversion prevails" : "signals are mixed"}.` : "Limited data available."}`;

  // Build Asian session summary
  const asia = asianItems.length > 0
    ? isFr
      ? `Session asiatique : ${asianItems.slice(0, 3).map(i => i.title).join('. ')}.`
      : `Asian session: ${asianItems.slice(0, 3).map(i => i.title).join('. ')}.`
    : (isFr ? 'Session asiatique : données limitées disponibles.' : 'Asian session: limited data available.');

  // Today's outlook
  const today = isFr
    ? `Événements clés : ${isBullish ? "Dynamique positive sur les marchés" : isBearish ? "Pression vendeuse observée" : "Marché en attente de catalyseurs"}. Surveillez les données économiques et les décisions de politique monétaire.`
    : `Key events: ${isBullish ? "Positive market dynamics" : isBearish ? "Selling pressure observed" : "Market awaiting catalysts"}. Watch for economic data and monetary policy decisions.`;

  // Key levels (estimated from context) — fully translated
  const keyLevels = isFr
    ? [
        'EUR/USD: Support 1.0800 / Résistance 1.0950',
        'Or (XAUUSD): Support 2 300 / Résistance 2 400',
        'S&P 500: Support 5 200 / Résistance 5 400',
        'DXY: Support 104.00 / Résistance 105.50',
      ]
    : [
        'EUR/USD: Support 1.0800 / Resistance 1.0950',
        'Gold (XAUUSD): Support 2300 / Resistance 2400',
        'S&P 500: Support 5200 / Resistance 5400',
        'DXY: Support 104.00 / Resistance 105.50',
      ];

  // Scenarios based on sentiment
  const bullProb = isBullish ? 45 : isBearish ? 25 : 33;
  const bearProb = isBearish ? 45 : isBullish ? 25 : 33;
  const neutralProb = 100 - bullProb - bearProb;

  const scenarios = [
    {
      name: isFr ? 'Haussier' : 'Bullish',
      probability: bullProb,
      description: isFr
        ? `${isBullish ? "Les données actuelles soutiennent ce scénario" : "Ce scénario nécessite des catalyseurs positifs"}. Dynamique d'achat soutenue par les flux institutionnels.`
        : `${isBullish ? "Current data supports this scenario" : "This scenario requires positive catalysts"}. Buying dynamics supported by institutional flows.`,
    },
    {
      name: isFr ? 'Neutre' : 'Neutral',
      probability: neutralProb,
      description: isFr
        ? 'Range latéral probable. Les marchés attendent des données ou des annonces pour choisir une direction.'
        : 'Sideways range likely. Markets await data or announcements for directional cues.',
    },
    {
      name: isFr ? 'Baissier' : 'Bearish',
      probability: bearProb,
      description: isFr
        ? `${isBearish ? "La pression vendeuse domine actuellement" : "Risque de correction si les données déçoivent"}. Prudence recommandée sur les positions longues.`
        : `${isBearish ? "Selling pressure currently dominates" : "Correction risk if data disappoints"}. Caution recommended on long positions.`,
    },
  ];

  // Risk events from news — ensure French when lang=fr
  const riskEvents = rssItems
    .filter(i => {
      const t = i.title.toLowerCase();
      return ['fed', 'ecb', 'boe', 'rate', 'cpi', 'nfp', 'gdp', 'pmi', 'decision', 'speech', 'jobs', 'employment'].some(kw => t.includes(kw));
    })
    .slice(0, 5)
    .map(i => {
      let title = i.title;
      if (title.length > 80) title = title.substring(0, 80) + '...';
      return title;
    });

  if (riskEvents.length === 0) {
    riskEvents.push(
      isFr ? 'Surveillez les annonces de la Fed et les données économiques US' : 'Watch for Fed announcements and US economic data',
      isFr ? 'Calendrier économique : IPC, emploi, PIB' : 'Economic calendar: CPI, employment, GDP'
    );
  }

  return {
    summary,
    asia,
    today,
    keyLevels,
    scenarios,
    riskEvents,
    updatedAt: new Date().toISOString(),
  };
}

async function fetchBriefingRSS(): Promise<{ title: string; snippet: string; date: string }[]> {
  const items: { title: string; snippet: string; date: string }[] = [];

  const feedResults = await Promise.allSettled(
    BRIEFING_RSS_FEEDS.map(feed =>
      fetch(`https://www.investing.com/rss/news_${feed.id}.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DONCIEL-TM/1.0)' },
        signal: AbortSignal.timeout(10000),
      }).then(res => {
        if (!res.ok) return [];
        return res.text().then(xml => {
          const parsed = parser.parse(xml);
          const feedItems = parsed?.rss?.channel?.item;
          const list = Array.isArray(feedItems) ? feedItems : feedItems ? [feedItems] : [];
          return list
            .filter((item: any) => {
              const title = (item.title || '').toLowerCase();
              return feed.keywords.some(kw => title.includes(kw));
            })
            .map((item: any) => ({
              title: item.title || '',
              snippet: item.title || '',
              date: item.pubDate || '',
            }));
        });
      }).catch(() => [])
    )
  );

  for (const result of feedResults) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      items.push(...result.value);
    }
  }

  // Deduplicate by title
  const seen = new Set<string>();
  return items.filter(item => {
    const key = item.title.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ──────────────────────────────────────────────────────
// ZAI SDK-powered fetch (primary)
// ──────────────────────────────────────────────────────

const BRIEFING_SYSTEM_PROMPT_FR = `Tu es DONCIEL-AI™, un analyste de marché matinal expert. Tu génères des briefings matinaux complets pour les traders avec des scénarios probabilistes.

RÈGLES STRICTES :
1. Le briefing doit couvrir la session asiatique, le résumé overnight, et les attentes pour la journée
2. Les scénarios doivent être réalistes et basés sur les données factuelles
3. Les probabilités des 3 scénarios doivent totaliser 100%
4. Les niveaux clés doivent inclure des niveaux de support/résistance concrets
5. Les événements à risque doivent lister les événements économiques du jour avec heure
6. Le style doit être professionnel, concis et actionnable
7. Inclure des données chiffrées quand disponibles
8. TOUS les textes doivent être en français

Tu réponds TOUJOURS au format JSON demandé, sans texte additionnel.`;

const BRIEFING_SYSTEM_PROMPT_EN = `You are DONCIEL-AI™, an expert morning market analyst. You generate comprehensive morning briefings for traders with probabilistic scenarios.

STRICT RULES:
1. The briefing must cover the Asian session, overnight summary, and expectations for the day
2. Scenarios must be realistic and based on factual data
3. The probabilities of the 3 scenarios must total 100%
4. Key levels must include concrete support/resistance levels
5. Risk events must list the day's economic events with times
6. The style must be professional, concise and actionable
7. Include numerical data when available

You ALWAYS respond in the requested JSON format, with no additional text.`;

async function fetchBriefingWithZAI(lang: string, period: string): Promise<{
  summary: string;
  asia: string;
  today: string;
  keyLevels: string[];
  scenarios: { name: string; probability: number; description: string }[];
  riskEvents: string[];
  updatedAt: string;
  error?: string;
} | null> {
  const isFr = lang === 'fr';

  const fallbackResult = {
    summary: isFr ? 'Données temporairement indisponibles.' : 'Data temporarily unavailable.',
    asia: isFr ? 'Session asiatique : données non disponibles.' : 'Asian session: data unavailable.',
    today: isFr ? 'Événements : données non disponibles.' : 'Events: data unavailable.',
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

    const [overnightResult, outlookResult, technicalResult] = await Promise.allSettled([
      zai.functions.invoke('web_search', {
        query: isFr
          ? (isWeek ? 'marchés asiatiques cette semaine Nikkei Hang Seng Shanghai' : "marchés asiatiques aujourd'hui Nikkei Hang Seng overnight Wall Street futures")
          : (isWeek ? 'Asian markets this week Nikkei Hang Seng Shanghai' : 'Asian markets today Nikkei Hang Seng overnight Wall Street futures'),
        num: 6,
        recency_days: recencyDays,
      }).catch(() => null),

      zai.functions.invoke('web_search', {
        query: isFr
          ? (isWeek ? 'prévisions marché cette semaine forex indices' : "prévisions marché aujourd'hui forex indices événements")
          : (isWeek ? 'market outlook this week forex indices' : 'market outlook today forex indices economic events'),
        num: 6,
        recency_days: recencyDays,
      }).catch(() => null),

      zai.functions.invoke('web_search', {
        query: isFr
          ? (isWeek ? 'niveaux clés support résistance EURUSD gold S&P 500 cette semaine' : "niveaux clés support résistance EURUSD gold S&P 500 aujourd'hui")
          : (isWeek ? 'key support resistance levels EURUSD gold S&P 500 this week' : 'key support resistance levels EURUSD gold S&P 500 today'),
        num: 5,
        recency_days: recencyDays,
      }).catch(() => null),
    ]);

    const extractData = (result: PromiseSettledResult<any>) => {
      if (result.status === 'fulfilled' && result.value && Array.isArray(result.value)) {
        return result.value
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
      return '';
    };

    const overnightData = extractData(overnightResult);
    const outlookData = extractData(outlookResult);
    const technicalData = extractData(technicalResult);

    const allData = [overnightData, outlookData, technicalData].filter(Boolean);
    if (allData.length === 0) {
      return null; // Trigger fallback
    }

    const systemPrompt = isFr ? BRIEFING_SYSTEM_PROMPT_FR : BRIEFING_SYSTEM_PROMPT_EN;
    const combinedData = [
      overnightData ? `=== SESSION ASIATIQUE / OVERNIGHT ===\n${overnightData}` : '',
      outlookData ? `=== PRÉVISIONS / ÉVÉNEMENTS DU JOUR ===\n${outlookData}` : '',
      technicalData ? `=== NIVEAUX CLÉS / TECHNIQUE ===\n${technicalData}` : '',
    ].filter(Boolean).join('\n\n');

    const todayDate = new Date();
    const dayNames = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayName = isFr ? dayNames[todayDate.getDay()] : dayNamesEn[todayDate.getDay()];

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: isFr
            ? `Génère le briefing${isWeek ? ' hebdomadaire' : ' matinal'} DONCIEL™ pour ${dayName} ${todayDate.toLocaleDateString('fr-FR')}.

DONNÉES COLLECTÉES:
${combinedData}

Réponds au format JSON suivant:
{
  "summary": "Résumé en 3-4 phrases avec données chiffrées",
  "asia": "Résumé session asiatique en 2-3 phrases",
  "today": "Événements clés attendus en 2-3 phrases",
  "keyLevels": ["EUR/USD: Support / Résistance", "Or: Support / Résistance", "S&P 500: Support / Résistance"],
  "scenarios": [
    { "name": "Haussier", "probability": pourcentage, "description": "Conditions en 2 phrases" },
    { "name": "Neutre", "probability": pourcentage, "description": "Conditions en 2 phrases" },
    { "name": "Baissier", "probability": pourcentage, "description": "Conditions en 2 phrases" }
  ],
  "riskEvents": ["Événement économique avec heure", "..."]
}`
            : `Generate the ${isWeek ? 'weekly' : 'morning'} DONCIEL™ briefing for ${dayName} ${todayDate.toLocaleDateString('en-US')}.

COLLECTED DATA:
${combinedData}

Respond in the following JSON format:
{
  "summary": "3-4 sentence summary with numerical data",
  "asia": "2-3 sentence Asian session summary",
  "today": "2-3 sentence key events expected",
  "keyLevels": ["EUR/USD: Support / Resistance", "Gold: Support / Resistance", "S&P 500: Support / Resistance"],
  "scenarios": [
    { "name": "Bullish", "probability": percentage, "description": "Conditions in 2 sentences" },
    { "name": "Neutral", "probability": percentage, "description": "Conditions in 2 sentences" },
    { "name": "Bearish", "probability": percentage, "description": "Conditions in 2 sentences" }
  ],
  "riskEvents": ["Economic event with time", "..."]
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
    console.error('Briefing ZAI error:', error instanceof Error ? error.message : 'Unknown error');
    return null; // Trigger fallback
  }
}

// ──────────────────────────────────────────────────────
// Main fetch with fallback chain: ZAI SDK → RSS
// ──────────────────────────────────────────────────────

async function fetchBriefingData(lang: string, period: string = 'today', asset?: string): Promise<{
  summary: string;
  asia: string;
  today: string;
  keyLevels: string[];
  scenarios: { name: string; probability: number; description: string }[];
  riskEvents: string[];
  assetBriefing?: { keyLevels: string[]; scenarioAdjustment: string; riskEvents: string[] };
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

  // Helper to determine sentiment for asset briefing
  const getSentiment = (data: any): 'bullish' | 'bearish' | 'neutral' => {
    if (data.overallSentiment === 'RISK-ON') return 'bullish';
    if (data.overallSentiment === 'RISK-OFF') return 'bearish';
    return 'neutral';
  };

  // 1. Try ZAI SDK first
  const zaiResult = await fetchBriefingWithZAI(lang, period);
  if (zaiResult) {
    const result: any = { ...zaiResult };
    // Add asset-specific briefing if requested
    if (asset) {
      try {
        const rssItems = await fetchBriefingRSS();
        const sentiment = getSentiment(zaiResult);
        result.assetBriefing = generateAssetBriefing(asset, sentiment, lang, rssItems);
      } catch {}
    }
    return result;
  }

  // 2. Fallback: RSS feeds + keyword analysis
  console.log('Briefing: ZAI SDK unavailable, falling back to RSS');
  try {
    const rssItems = await fetchBriefingRSS();
    if (rssItems.length > 0) {
      const result: any = generateBriefingFromRSS(rssItems, lang, period);
      // Add asset-specific briefing if requested
      if (asset) {
        const text = rssItems.map(i => i.title.toLowerCase()).join(' ');
        const bullWords = ['rally', 'surge', 'gain', 'rise', 'bullish', 'recovery', 'optimism', 'boost'];
        const bearWords = ['crash', 'selloff', 'fear', 'decline', 'bearish', 'recession', 'slump', 'plunge'];
        let bs = 0;
        let brs = 0;
        bullWords.forEach(w => { const m = text.match(new RegExp(w, 'gi')); if (m) bs += m.length; });
        bearWords.forEach(w => { const m = text.match(new RegExp(w, 'gi')); if (m) brs += m.length; });
        const sentiment: 'bullish' | 'bearish' | 'neutral' = bs > brs * 1.3 ? 'bullish' : brs > bs * 1.3 ? 'bearish' : 'neutral';
        result.assetBriefing = generateAssetBriefing(asset, sentiment, lang, rssItems);
      }
      return result;
    }
  } catch (error) {
    console.error('Briefing RSS fallback error:', error instanceof Error ? error.message : 'Unknown error');
  }

  // 3. Both failed
  const failResult: any = { ...fallbackResult, error: isFr ? 'Aucune donnée de marché disponible' : 'No market data available' };
  if (asset) {
    failResult.assetBriefing = generateAssetBriefing(asset, 'neutral', lang, []);
  }
  return failResult;
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
    const asset = searchParams.get('asset') || undefined;

    // Check cache
    const cacheKey = `briefing-${lang}-${period}${asset ? `-${asset}` : ''}`;
    const cached = cache.get(cacheKey);
    const cacheDuration = period === 'week' ? CACHE_DURATION_WEEK : CACHE_DURATION;
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchBriefingData(lang, period, asset);

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Briefing route error:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération du briefing',
        summary: 'Briefing temporairement indisponible.',
        asia: 'Données non disponibles.',
        today: 'Données non disponibles.',
        keyLevels: [],
        scenarios: [
          { name: 'Haussier', probability: 33, description: 'Données insuffisantes' },
          { name: 'Neutre', probability: 34, description: 'Données insuffisantes' },
          { name: 'Baissier', probability: 33, description: 'Données insuffisantes' },
        ],
        riskEvents: [],
        updatedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
