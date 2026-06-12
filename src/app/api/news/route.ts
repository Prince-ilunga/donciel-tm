import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { XMLParser } from 'fast-xml-parser';

const ASSETS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'US30', 'US100'] as const;
type Asset = (typeof ASSETS)[number];

const ASSET_LABELS: Record<Asset, { fr: string; en: string; emoji: string }> = {
  XAUUSD: { fr: 'Or / Dollar', en: 'Gold / Dollar', emoji: '🥇' },
  EURUSD: { fr: 'Euro / Dollar', en: 'Euro / Dollar', emoji: '🇪🇺' },
  GBPUSD: { fr: 'Livre / Dollar', en: 'Pound / Dollar', emoji: '🇬🇧' },
  US30: { fr: 'Dow Jones 30', en: 'Dow Jones 30', emoji: '🏭' },
  US100: { fr: 'Nasdaq 100', en: 'Nasdaq 100', emoji: '💻' },
};

// Asset-specific context for AI analysis
const ASSET_CONTEXT: Record<Asset, { sectors: string; drivers: string; correlations: string }> = {
  XAUUSD: {
    sectors: 'precious metals, commodities, mining',
    drivers: 'Fed interest rates, US dollar strength, inflation data (CPI/PCE), geopolitical risk, central bank gold reserves, real yields',
    correlations: 'inversely correlated with US Dollar Index (DXY) and real yields; positively with inflation expectations and risk aversion',
  },
  EURUSD: {
    sectors: 'Eurozone sovereign bonds, European equities, FX',
    drivers: 'ECB monetary policy, Fed policy differential, Eurozone inflation/GDP, German manufacturing PMI, energy prices, Italian spread',
    correlations: 'positively with risk appetite and Eurozone growth; inversely with DXY and energy prices',
  },
  GBPUSD: {
    sectors: 'UK gilts, FTSE 100, FX',
    drivers: 'Bank of England policy, UK inflation (CPI/RPI), Brexit-related trade data, UK employment, housing market, services PMI',
    correlations: 'positively with risk sentiment and UK data surprises; inversely with DXY',
  },
  US30: {
    sectors: 'US large-cap equities, Dow Jones Industrial Average',
    drivers: 'Fed policy, US employment (NFP), corporate earnings, consumer confidence, ISM manufacturing, trade policy, Treasury yields',
    correlations: 'inversely with real yields and VIX; positively with earnings growth and risk appetite',
  },
  US100: {
    sectors: 'US technology equities, Nasdaq 100, growth stocks',
    drivers: 'Fed policy (especially rate outlook), AI/semiconductor cycle, mega-cap tech earnings, venture funding, regulatory risk, Treasury yields',
    correlations: 'inversely with real yields and regulatory risk; positively with AI capex cycle, risk appetite, and earnings revisions',
  },
};

// RSS feeds - each asset maps to multiple feed IDs
const ASSET_RSS: Record<Asset, { feeds: { id: number; keywords: string[] }[] }> = {
  XAUUSD: {
    feeds: [
      { id: 11, keywords: ['gold', 'xau', 'precious', 'commodit', 'fed', 'inflation', 'dollar', 'oil', 'energy', 'mining', 'metal', 'rate'] },
      { id: 1, keywords: ['gold', 'dollar', 'fed', 'inflation', 'rate', 'cpi', 'jobs', 'gdp'] },
    ],
  },
  EURUSD: {
    feeds: [
      { id: 1, keywords: ['euro', 'eur', 'ecb', 'eurozone', 'dollar', 'fed', 'rate', 'inflation', 'german'] },
      { id: 14, keywords: ['ecb', 'eurozone', 'europe', 'rate', 'inflation', 'pound', 'boe'] },
    ],
  },
  GBPUSD: {
    feeds: [
      { id: 1, keywords: ['pound', 'sterling', 'gbp', 'boe', 'uk', 'britain', 'dollar', 'fed', 'rate'] },
      { id: 14, keywords: ['boe', 'uk', 'britain', 'rate', 'inflation', 'euro', 'ecb'] },
    ],
  },
  US30: {
    feeds: [
      { id: 25, keywords: ['dow', 'us30', 'wall street', 'stock', 'market', 'fed', 'jobs', 'inflation', 'rate', 'nasdaq', 's&p', 'earnings'] },
      { id: 14, keywords: ['fed', 'us economy', 'jobs', 'gdp', 'inflation', 'rate', 'treasury'] },
    ],
  },
  US100: {
    feeds: [
      { id: 25, keywords: ['nasdaq', 'us100', 'tech', 'ai', 'chip', 'semiconductor', 'stock', 'magnificent', 'earnings'] },
      { id: 14, keywords: ['fed', 'tech', 'ai', 'rate', 'inflation', 'treasury'] },
    ],
  },
};

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000;

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// Fetch and parse RSS feed from Investing.com
async function fetchRSSFeed(feedId: number, keywords: string[]): Promise<any[]> {
  try {
    const url = `https://www.investing.com/rss/news_${feedId}.rss`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DONCIEL-TM/1.0; +https://donciel-trading.vercel.app)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];

    return list
      .map((item: any) => ({
        title: item.title || '',
        snippet: item.title || '',
        url: item.link || '',
        source: item.author || 'Investing.com',
        date: item.pubDate || null,
      }))
      .filter((item: any) => {
        if (!item.title || !item.url) return false;
        const text = item.title.toLowerCase();
        return keywords.some(kw => text.includes(kw));
      });
  } catch (error) {
    console.error(`RSS feed ${feedId} error:`, error);
    return [];
  }
}

// Fetch broader news without keyword filtering for fallback
async function fetchBroadNews(feedId: number): Promise<any[]> {
  try {
    const url = `https://www.investing.com/rss/news_${feedId}.rss`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DONCIEL-TM/1.0; +https://donciel-trading.vercel.app)' },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) return [];

    const xml = await response.text();
    const parsed = parser.parse(xml);
    const items = parsed?.rss?.channel?.item;
    if (!items) return [];

    const list = Array.isArray(items) ? items : [items];

    return list.map((item: any) => ({
      title: item.title || '',
      snippet: item.title || '',
      url: item.link || '',
      source: item.author || 'Investing.com',
      date: item.pubDate || null,
    })).filter((item: any) => item.title && item.url);
  } catch (error) {
    console.error(`Broad RSS feed ${feedId} error:`, error);
    return [];
  }
}

// ============================================================
// SPECIALIZED FINANCE AI — CFA-level analysis engine
// ============================================================

const FINANCE_AI_SYSTEM_PROMPT_FR = `Tu es DONCIEL-AI™, un analyste financier quantitatif de niveau CFA avec 20 ans d'expérience sur les marchés Forex, indices boursiers et matières premières. Tu es spécialisé en analyse fondamentale en temps réel.

Tes compétences clés :
- Interprétation experte des indicateurs macroéconomiques (IPC, PCE, NFP, PMI, PIB, etc.)
- Analyse des décisions de politique monétaire (Fed, BCE, BoE, BoJ)
- Corrélation croisée entre marchés (taux, devises, matières premières, actions)
- Évaluation de l'impact des événements géopolitiques sur les marchés
- Détermination de la direction probable basée sur des données réelles

RÈGLES STRICTES :
1. Base TOUJOURS tes conclusions sur les données factuelles des news fournies
2. Indique clairement le niveau de confiance et les risques
3. Fournis des niveaux de prix cibles quand c'est pertinent
4. Distingue l'impact court terme (intraday) vs moyen terme (swing)
5. Ne spéculer JAMAIS sans fondement factuel

Tu réponds TOUJOURS au format JSON demandé, sans texte additionnel.`;

const FINANCE_AI_SYSTEM_PROMPT_EN = `You are DONCIEL-AI™, a CFA-level quantitative financial analyst with 20 years of experience in Forex, equity indices, and commodities markets. You specialize in real-time fundamental analysis.

Your core expertise:
- Expert interpretation of macroeconomic indicators (CPI, PCE, NFP, PMI, GDP, etc.)
- Analysis of monetary policy decisions (Fed, ECB, BoE, BoJ)
- Cross-market correlation analysis (rates, currencies, commodities, equities)
- Assessment of geopolitical event impact on markets
- Determination of probable direction based on real data

STRICT RULES:
1. ALWAYS base your conclusions on the factual data from the provided news
2. Clearly indicate confidence level and risks
3. Provide target price levels when relevant
4. Distinguish short-term (intraday) vs medium-term (swing) impact
5. NEVER speculate without factual basis

You ALWAYS respond in the requested JSON format, with no additional text.`;

async function analyzeWithFinanceAI(asset: Asset, newsItems: any[], language: string, period: string): Promise<any | null> {
  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    const newsSummary = newsItems
      .slice(0, 15)
      .map((item: any, i: number) => `${i + 1}. [${item.source || 'Source'}] ${item.title} (${item.date || 'récent'})`)
      .join('\n');

    if (!newsSummary.trim()) return null;

    const lang = language === 'fr' ? 'fr' : 'en';
    const assetLabel = ASSET_LABELS[asset][lang === 'fr' ? 'fr' : 'en'];
    const context = ASSET_CONTEXT[asset];
    const periodLabel = period === 'today'
      ? (lang === 'fr' ? "d'aujourd'hui" : "for today")
      : (lang === 'fr' ? "de cette semaine" : "for this week");

    const systemPrompt = lang === 'fr' ? FINANCE_AI_SYSTEM_PROMPT_FR : FINANCE_AI_SYSTEM_PROMPT_EN;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: `Analyse experte ${periodLabel} pour ${asset} (${assetLabel}).

CONTEXTE ACTIF :
- Secteurs : ${context.sectors}
- Drivers principaux : ${context.drivers}
- Corrélations clés : ${context.correlations}

NEWS EN TEMPS RÉEL ${periodLabel} :
${newsSummary}

Fournis une analyse complète au format JSON suivant :
{
  "summary": "Résumé fondamental de 3-4 phrases avec données chiffrées si disponibles",
  "direction": "HAUSSIER|BAISSIER|NEUTRE",
  "confidence": "élevé|moyen|faible",
  "impact": "IMPACT ÉLEVÉ|IMPACT MODÉRÉ|IMPACT FAIBLE",
  "keyFactors": ["facteur 1 avec détail", "facteur 2 avec détail", "facteur 3 avec détail", "facteur 4 avec détail"],
  "recommendation": "Recommandation concise et actionnable pour un day trader",
  "sentiment": "très haussier|haussier|neutre|baissier|très baissier",
  "shortTerm": "perspective intraday avec niveau clé",
  "mediumTerm": "perspective swing (semaine) avec direction probable",
  "riskWarning": "risque principal à surveiller",
  "newsInterpretations": [
    {"index": 1, "direction": "HAUSSIER|BAISSIER|NEUTRE", "reason": "raison courte de l'impact sur l'actif"},
    {"index": 2, "direction": "HAUSSIER|BAISSIER|NEUTRE", "reason": "raison courte de l'impact sur l'actif"}
  ]
}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices[0]?.message?.content || '';
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
    } catch {}
    return null;
  } catch (error) {
    console.error('Finance AI unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Also search the web for the latest market data for this asset
async function searchLatestMarketData(asset: Asset, language: string): Promise<any[]> {
  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    const searchQueries: Record<Asset, string> = {
      XAUUSD: 'gold price today XAUUSD market analysis',
      EURUSD: 'EURUSD exchange rate today euro dollar analysis',
      GBPUSD: 'GBPUSD exchange rate today pound dollar analysis',
      US30: 'Dow Jones US30 index today market analysis',
      US100: 'Nasdaq 100 US100 index today tech market analysis',
    };

    const results = await zai.functions.invoke('web_search', {
      query: searchQueries[asset],
      num: 5,
      recency_days: 1,
    });

    if (!Array.isArray(results)) return [];

    return results.map((r: any) => ({
      title: r.title || r.name || '',
      snippet: r.snippet || r.description || '',
      url: r.url || r.link || '',
      source: r.source || 'Web Search',
      date: r.date || r.publishedTime || null,
    })).filter((r: any) => r.title);
  } catch (error) {
    console.error('Web search unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return [];
  }
}

// Generate basic analysis from news titles when AI is unavailable
function generateBasicAnalysis(asset: Asset, newsItems: any[], language: string): any {
  if (newsItems.length === 0) return null;

  const titles = newsItems.slice(0, 5).map(n => n.title.toLowerCase()).join(' ');

  const bullishWords = ['rise', 'gain', 'rally', 'surge', 'climb', 'bullish', 'support', 'up', 'high', 'strong', 'hausse', 'monte', 'soutien', 'boost', 'jump', 'soar', 'recover'];
  const bearishWords = ['fall', 'drop', 'slide', 'slip', 'decline', 'bearish', 'pressure', 'down', 'low', 'weak', 'baisse', 'chute', 'recul', 'slump', 'tumble', 'plunge', 'fear'];

  let bullScore = 0;
  let bearScore = 0;
  bullishWords.forEach(w => { if (titles.includes(w)) bullScore++; });
  bearishWords.forEach(w => { if (titles.includes(w)) bearScore++; });

  const direction = bullScore > bearScore ? 'HAUSSIER' : bearScore > bullScore ? 'BAISSIER' : 'NEUTRE';
  const confidence = Math.abs(bullScore - bearScore) >= 3 ? 'élevé' : Math.abs(bullScore - bearScore) >= 1 ? 'moyen' : 'faible';
  const sentiment = bullScore > bearScore + 2 ? 'très haussier' : bullScore > bearScore ? 'haussier' : bearScore > bullScore + 2 ? 'très baissier' : bearScore > bullScore ? 'baissier' : 'neutre';

  const isFr = language === 'fr';

  return {
    summary: isFr
      ? `Analyse basée sur ${newsItems.length} news récentes pour ${asset}. ${direction === 'HAUSSIER' ? 'Les indicateurs suggèrent une pression acheteuse.' : direction === 'BAISSIER' ? 'Les indicateurs suggèrent une pression vendeuse.' : 'Les signaux sont mitigés.'}`
      : `Analysis based on ${newsItems.length} recent news for ${asset}. ${direction === 'HAUSSIER' ? 'Indicators suggest buying pressure.' : direction === 'BAISSIER' ? 'Indicators suggest selling pressure.' : 'Mixed signals.'}`,
    direction,
    confidence,
    impact: newsItems.length >= 5 ? 'IMPACT MODÉRÉ' : 'IMPACT FAIBLE',
    keyFactors: newsItems.slice(0, 4).map(n => n.title.length > 80 ? n.title.substring(0, 80) + '...' : n.title),
    recommendation: isFr
      ? 'Consultez les news détaillées pour une analyse complète avant de trader.'
      : 'Review detailed news for complete analysis before trading.',
    sentiment,
    shortTerm: isFr ? 'Données insuffisantes pour une analyse intraday approfondie' : 'Insufficient data for detailed intraday analysis',
    mediumTerm: isFr ? 'Direction ' + direction.toLowerCase() + ' suggérée par les indicateurs actuels' : direction.toLowerCase() + ' direction suggested by current indicators',
    riskWarning: isFr ? 'Analyse basée sur mots-clés — l\'IA spécialisée est indisponible' : 'Keyword-based analysis — specialized AI is unavailable',
    newsInterpretations: newsItems.slice(0, 5).map((item: any, i: number) => {
      const t = item.title.toLowerCase();
      const b = bullishWords.some(w => t.includes(w));
      const be = bearishWords.some(w => t.includes(w));
      return {
        index: i + 1,
        direction: b && !be ? 'HAUSSIER' : be && !b ? 'BAISSIER' : 'NEUTRE',
        reason: isFr ? 'Interprétation automatique basée sur mots-clés' : 'Auto-interpretation based on keywords',
      };
    }),
  };
}

// Generate upcoming economic events based on typical weekly calendar
function generateUpcomingEvents(asset: Asset, language: string): any[] {
  const now = new Date();
  const events: any[] = [];

  const commonEvents: Record<string, { title_fr: string; title_en: string; impact: string }[]> = {
    XAUUSD: [
      { title_fr: 'IPC (Indice des Prix à la Consommation) US', title_en: 'US CPI (Consumer Price Index)', impact: 'HIGH' },
      { title_fr: 'Décision de la FED sur les taux', title_en: 'FOMC Rate Decision', impact: 'HIGH' },
      { title_fr: 'Discours du Président de la Fed', title_en: 'Fed Chair Speech', impact: 'MEDIUM' },
      { title_fr: 'Emploi non-agricole US (NFP)', title_en: 'US Non-Farm Payrolls', impact: 'HIGH' },
      { title_fr: 'Revendications chômage US', title_en: 'US Jobless Claims', impact: 'MEDIUM' },
    ],
    EURUSD: [
      { title_fr: 'Décision de taux de la BCE', title_en: 'ECB Rate Decision', impact: 'HIGH' },
      { title_fr: 'Conférence de presse BCE', title_en: 'ECB Press Conference', impact: 'HIGH' },
      { title_fr: 'PMI Manufacturing Eurozone', title_en: 'Eurozone Manufacturing PMI', impact: 'MEDIUM' },
      { title_fr: 'IPC Zone Euro', title_en: 'Eurozone CPI', impact: 'HIGH' },
      { title_fr: 'PIB Zone Euro', title_en: 'Eurozone GDP', impact: 'MEDIUM' },
    ],
    GBPUSD: [
      { title_fr: 'Décision de taux de la BoE', title_en: 'BoE Rate Decision', impact: 'HIGH' },
      { title_fr: 'IPC Royaume-Uni', title_en: 'UK CPI', impact: 'HIGH' },
      { title_fr: 'PMI Manufacturing UK', title_en: 'UK Manufacturing PMI', impact: 'MEDIUM' },
      { title_fr: 'Emploi UK', title_en: 'UK Employment', impact: 'MEDIUM' },
      { title_fr: 'PIB Royaume-Uni', title_en: 'UK GDP', impact: 'MEDIUM' },
    ],
    US30: [
      { title_fr: 'Emploi non-agricole US (NFP)', title_en: 'US Non-Farm Payrolls', impact: 'HIGH' },
      { title_fr: 'Décision de la FED sur les taux', title_en: 'FOMC Rate Decision', impact: 'HIGH' },
      { title_fr: 'Résultats entreprises Dow Jones', title_en: 'Dow Jones Earnings Reports', impact: 'MEDIUM' },
      { title_fr: 'IPC US', title_en: 'US CPI', impact: 'HIGH' },
      { title_fr: 'Confiance des consommateurs US', title_en: 'US Consumer Confidence', impact: 'MEDIUM' },
    ],
    US100: [
      { title_fr: 'Résultats entreprises Tech', title_en: 'Tech Earnings Reports', impact: 'HIGH' },
      { title_fr: 'Décision de la FED sur les taux', title_en: 'FOMC Rate Decision', impact: 'HIGH' },
      { title_fr: 'IPC US', title_en: 'US CPI', impact: 'HIGH' },
      { title_fr: 'Emploi non-agricole US (NFP)', title_en: 'US Non-Farm Payrolls', impact: 'MEDIUM' },
      { title_fr: 'Ventes au détail US', title_en: 'US Retail Sales', impact: 'MEDIUM' },
    ],
  };

  const assetEvents = commonEvents[asset] || [];
  let dayOffset = 1;

  for (const evt of assetEvents) {
    const eventDate = new Date(now);
    eventDate.setDate(now.getDate() + dayOffset);
    if (eventDate.getDay() === 0) eventDate.setDate(eventDate.getDate() + 1);
    if (eventDate.getDay() === 6) eventDate.setDate(eventDate.getDate() + 2);

    events.push({
      title: language === 'fr' ? evt.title_fr : evt.title_en,
      snippet: `${evt.impact === 'HIGH' ? '🔴' : '🟡'} ${evt.impact === 'HIGH' ? (language === 'fr' ? 'Impact Élevé' : 'High Impact') : (language === 'fr' ? 'Impact Modéré' : 'Medium Impact')}`,
      url: 'https://www.investing.com/economic-calendar/',
      date: eventDate.toISOString(),
      impact: evt.impact,
    });
    dayOffset = (dayOffset % 5) + 1;
  }

  return events;
}

function groupNewsByDay(newsItems: any[]) {
  const days: Record<string, any[]> = { Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [] };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  newsItems.forEach((item: any) => {
    if (item.date) {
      try {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          days[dayNames[d.getDay()]].push(item);
          return;
        }
      } catch {}
    }
    days[dayNames[new Date().getDay()]].push(item);
  });

  return days;
}

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const asset = searchParams.get('asset') as Asset || 'XAUUSD';
    const language = searchParams.get('lang') || 'fr';
    const period = searchParams.get('period') || 'week';

    if (!ASSETS.includes(asset)) {
      return NextResponse.json({ error: 'Actif invalide' }, { status: 400 });
    }

    // Check cache
    const cacheKey = `${asset}-${language}-${period}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // 1. Fetch from RSS feeds with keyword filtering
    const feedConfigs = ASSET_RSS[asset].feeds;
    const allFeedResults = await Promise.all(
      feedConfigs.map(fc => fetchRSSFeed(fc.id, fc.keywords))
    );

    let allResults = allFeedResults.flat().sort((a, b) => {
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });

    // 2. If keyword filtering returns too few results, use broad news as fallback
    if (allResults.length < 3) {
      const broadResults = await Promise.all(
        feedConfigs.map(fc => fetchBroadNews(fc.id))
      );
      const broadFlat = broadResults.flat().sort((a, b) => {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });
      const existingUrls = new Set(allResults.map((r: any) => r.url));
      const additional = broadFlat.filter((r: any) => !existingUrls.has(r.url));
      allResults = [...allResults, ...additional];
    }

    // 3. Try web search for latest market data (runs in parallel with RSS)
    let webSearchResults: any[] = [];
    try {
      webSearchResults = await searchLatestMarketData(asset, language);
    } catch {
      // Web search is optional
    }

    // Merge web search results with RSS results
    if (webSearchResults.length > 0) {
      const existingUrls = new Set(allResults.map((r: any) => r.url));
      const newResults = webSearchResults.filter((r: any) => !existingUrls.has(r.url));
      allResults = [...newResults, ...allResults];
    }

    // Deduplicate
    const seen = new Set<string>();
    const uniqueResults = allResults.filter((item: any) => {
      const key = item.title.toLowerCase().substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter by period
    const now = new Date();
    const periodStart = period === 'today'
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
      : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const filteredNews = uniqueResults.filter((item: any) => {
      if (!item.date) return true;
      try { return new Date(item.date) >= periodStart; } catch { return true; }
    });

    // Daily counts for bar chart
    const newsByDay = groupNewsByDay(filteredNews);
    const dailyCounts = Object.entries(newsByDay).map(([day, items]) => ({ day, count: items.length }));

    // 4. Try Finance AI analysis first, fallback to basic keyword analysis
    let analysis: any = null;
    try {
      analysis = await analyzeWithFinanceAI(asset, filteredNews, language, period);
    } catch {
      // AI completely unavailable
    }
    if (!analysis) {
      analysis = generateBasicAnalysis(asset, filteredNews, language);
    }

    // Merge AI per-news interpretations back into news items
    const interpretationMap = new Map<number, { direction: string; reason: string }>();
    if (analysis?.newsInterpretations) {
      analysis.newsInterpretations.forEach((interp: any) => {
        interpretationMap.set(interp.index, { direction: interp.direction, reason: interp.reason });
      });
    }

    const enrichedNews = filteredNews.slice(0, 15).map((item: any, i: number) => ({
      ...item,
      aiDirection: interpretationMap.get(i + 1)?.direction || null,
      aiReason: interpretationMap.get(i + 1)?.reason || null,
    }));

    // Generate upcoming events
    const upcomingEvents = generateUpcomingEvents(asset, language);

    const responseData = {
      asset,
      assetLabel: ASSET_LABELS[asset],
      period,
      news: enrichedNews,
      upcomingEvents,
      dailyCounts,
      analysis,
      aiPowered: analysis?.newsInterpretations !== undefined, // true if AI worked
      updatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des news' }, { status: 500 });
  }
}
