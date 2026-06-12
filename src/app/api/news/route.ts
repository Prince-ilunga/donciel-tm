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

// Try AI analysis with ZAI SDK - completely optional
async function analyzeWithAI(asset: Asset, newsItems: any[], language: string, period: string): Promise<any | null> {
  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    const newsSummary = newsItems
      .slice(0, 8)
      .map((item: any, i: number) => `${i + 1}. ${item.title}`)
      .join('\n');

    if (!newsSummary.trim()) return null;

    const lang = language === 'fr' ? 'français' : 'English';
    const assetLabel = language === 'fr' ? ASSET_LABELS[asset].fr : ASSET_LABELS[asset].en;
    const periodLabel = period === 'today'
      ? (language === 'fr' ? "d'aujourd'hui" : "for today")
      : (language === 'fr' ? "de cette semaine" : "for this week");

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Tu es un analyste fondamental professionnel du marché Forex et des indices boursiers. Tu analyses les news économiques et fournis une interprétation claire et concise. Réponds en ${lang}.`,
        },
        {
          role: 'user',
          content: `Analyse les news ${periodLabel} pour l'actif ${asset} (${assetLabel}) et fournis :

1. **Résumé fondamental** : 2-3 phrases résumant le contexte économique actuel pour cet actif
2. **Direction probable** : indique clairement HAUSSIER, BAISSIER ou NEUTRE avec un niveau de confiance (élevé/moyen/faible)
3. **Facteurs clés** : liste de 3-4 facteurs qui influencent la direction
4. **Niveau d'impact** : IMPACT ÉLEVÉ, IMPACT MODÉRÉ ou IMPACT FAIBLE
5. **Recommandation trading** : une phrase de conseil pratique pour un day trader

News ${periodLabel} :
${newsSummary}

Réponds au format JSON exact :
{
  "summary": "résumé fondamental",
  "direction": "HAUSSIER|BAISSIER|NEUTRE",
  "confidence": "élevé|moyen|faible",
  "impact": "IMPACT ÉLEVÉ|IMPACT MODÉRÉ|IMPACT FAIBLE",
  "keyFactors": ["facteur 1", "facteur 2", "facteur 3"],
  "recommendation": "recommandation"
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
    console.error('AI analysis unavailable:', error instanceof Error ? error.message : 'Unknown error');
    return null;
  }
}

// Generate basic analysis from news titles when AI is unavailable
function generateBasicAnalysis(asset: Asset, newsItems: any[], language: string): any {
  if (newsItems.length === 0) return null;

  const titles = newsItems.slice(0, 5).map(n => n.title.toLowerCase()).join(' ');

  // Simple keyword-based direction detection
  const bullishWords = ['rise', 'gain', 'rally', 'surge', 'climb', 'bullish', 'support', 'up', 'high', 'strong', 'hausse', 'monte', 'soutien', 'boost', 'jump', 'soar', 'recover'];
  const bearishWords = ['fall', 'drop', 'slide', 'slip', 'decline', 'bearish', 'pressure', 'down', 'low', 'weak', 'baisse', 'chute', 'recul', 'slump', 'tumble', 'plunge', 'fear'];

  let bullScore = 0;
  let bearScore = 0;
  bullishWords.forEach(w => { if (titles.includes(w)) bullScore++; });
  bearishWords.forEach(w => { if (titles.includes(w)) bearScore++; });

  const direction = bullScore > bearScore ? 'HAUSSIER' : bearScore > bullScore ? 'BAISSIER' : 'NEUTRE';
  const confidence = Math.abs(bullScore - bearScore) >= 3 ? 'élevé' : Math.abs(bullScore - bearScore) >= 1 ? 'moyen' : 'faible';

  return {
    summary: language === 'fr'
      ? `Analyse basée sur ${newsItems.length} news récentes pour ${asset}. ${direction === 'HAUSSIER' ? 'Les indicateurs suggèrent une pression acheteuse.' : direction === 'BAISSIER' ? 'Les indicateurs suggèrent une pression vendeuse.' : 'Les signaux sont mitigés.'}`
      : `Analysis based on ${newsItems.length} recent news for ${asset}. ${direction === 'HAUSSIER' ? 'Indicators suggest buying pressure.' : direction === 'BAISSIER' ? 'Indicators suggest selling pressure.' : 'Mixed signals.'}`,
    direction,
    confidence,
    impact: newsItems.length >= 5 ? 'IMPACT MODÉRÉ' : 'IMPACT FAIBLE',
    keyFactors: newsItems.slice(0, 3).map(n => n.title.length > 80 ? n.title.substring(0, 80) + '...' : n.title),
    recommendation: language === 'fr'
      ? 'Consultez les news détaillées pour une analyse complète avant de trader.'
      : 'Review detailed news for complete analysis before trading.',
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
  // Generate upcoming dates for the rest of the week
  const currentDay = now.getDay(); // 0=Sun, 1=Mon, etc.
  let dayOffset = 1;
  
  for (const evt of assetEvents) {
    // Distribute events across the upcoming days of the week
    const eventDate = new Date(now);
    eventDate.setDate(now.getDate() + dayOffset);
    // Skip weekends
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

    // Fetch from RSS feeds with keyword filtering
    const feedConfigs = ASSET_RSS[asset].feeds;
    const allFeedResults = await Promise.all(
      feedConfigs.map(fc => fetchRSSFeed(fc.id, fc.keywords))
    );

    let allResults = allFeedResults.flat().sort((a, b) => {
      return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
    });

    // If keyword filtering returns too few results, use broad news as fallback
    if (allResults.length < 3) {
      const broadResults = await Promise.all(
        feedConfigs.map(fc => fetchBroadNews(fc.id))
      );
      const broadFlat = broadResults.flat().sort((a, b) => {
        return new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime();
      });
      // Merge: prefer keyword-filtered, then fill with broad results
      const existingUrls = new Set(allResults.map((r: any) => r.url));
      const additional = broadFlat.filter((r: any) => !existingUrls.has(r.url));
      allResults = [...allResults, ...additional];
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

    // Try AI analysis first, fallback to basic keyword analysis
    let analysis: any = null;
    try {
      analysis = await analyzeWithAI(asset, filteredNews, language, period);
    } catch {
      // AI completely unavailable
    }
    if (!analysis) {
      analysis = generateBasicAnalysis(asset, filteredNews, language);
    }

    // Generate upcoming events
    const upcomingEvents = generateUpcomingEvents(asset, language);

    const responseData = {
      asset,
      assetLabel: ASSET_LABELS[asset],
      period,
      news: filteredNews.slice(0, 15),
      upcomingEvents,
      dailyCounts,
      analysis,
      updatedAt: new Date().toISOString(),
    };

    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });
    return NextResponse.json(responseData);
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json({ error: 'Erreur lors de la récupération des news' }, { status: 500 });
  }
}
