import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const ASSETS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'US30', 'US100'] as const;
type Asset = (typeof ASSETS)[number];

const ASSET_QUERIES: Record<Asset, { today: string[]; week: string[]; calendar: string[] }> = {
  XAUUSD: {
    today: ['gold price news today forex XAUUSD', 'XAUUSD analysis today forecast'],
    week: ['gold XAUUSD news this week analysis', 'gold market forecast weekly Federal Reserve'],
    calendar: ['gold XAUUSD economic calendar events this week'],
  },
  EURUSD: {
    today: ['EURUSD news today forex euro dollar', 'EURUSD analysis today forecast'],
    week: ['EURUSD euro dollar news this week analysis', 'ECB interest rate news this week'],
    calendar: ['EURUSD economic calendar events euro zone this week'],
  },
  GBPUSD: {
    today: ['GBPUSD news today forex pound dollar', 'GBPUSD analysis today forecast'],
    week: ['GBPUSD pound dollar news this week analysis', 'Bank of England interest rate news this week'],
    calendar: ['GBPUSD economic calendar events UK this week'],
  },
  US30: {
    today: ['Dow Jones US30 news today stock market', 'US30 index analysis today forecast'],
    week: ['US30 Dow Jones news this week analysis', 'US stock market weekly forecast Federal Reserve'],
    calendar: ['US30 Dow Jones economic calendar events this week'],
  },
  US100: {
    today: ['Nasdaq US100 news today tech stocks', 'US100 index analysis today forecast'],
    week: ['US100 Nasdaq news this week analysis', 'Nasdaq tech stocks weekly forecast'],
    calendar: ['Nasdaq US100 economic calendar events this week'],
  },
};

const ASSET_LABELS: Record<Asset, { fr: string; en: string; emoji: string }> = {
  XAUUSD: { fr: 'Or / Dollar', en: 'Gold / Dollar', emoji: '🥇' },
  EURUSD: { fr: 'Euro / Dollar', en: 'Euro / Dollar', emoji: '🇪🇺' },
  GBPUSD: { fr: 'Livre / Dollar', en: 'Pound / Dollar', emoji: '🇬🇧' },
  US30: { fr: 'Dow Jones 30', en: 'Dow Jones 30', emoji: '🏭' },
  US100: { fr: 'Nasdaq 100', en: 'Nasdaq 100', emoji: '💻' },
};

// In-memory cache
interface CacheEntry {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function searchWeb(query: string, num = 8, recencyDays = 7) {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    const results = await zai.functions.invoke('web_search', {
      query,
      num,
      recency_days: recencyDays,
    });
    return Array.isArray(results) ? results : [];
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

async function analyzeWithAI(asset: Asset, newsItems: any[], language: string, period: string) {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const newsSummary = newsItems
      .slice(0, 8)
      .map((item: any, i: number) => `${i + 1}. ${item.name}\n   ${item.snippet}`)
      .join('\n\n');

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
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch {}
    return null;
  } catch (error) {
    console.error('AI analysis error:', error);
    return null;
  }
}

// Parse news and group by day of the week
function groupNewsByDay(newsItems: any[]) {
  const days: Record<string, any[]> = {
    Mon: [], Tue: [], Wed: [], Thu: [], Fri: [], Sat: [], Sun: [],
  };
  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  newsItems.forEach((item: any) => {
    if (item.date) {
      try {
        const d = new Date(item.date);
        if (!isNaN(d.getTime())) {
          const dayKey = dayNames[d.getDay()];
          days[dayKey].push(item);
          return;
        }
      } catch {}
    }
    // If no valid date, put in today
    const todayKey = dayNames[new Date().getDay()];
    days[todayKey].push(item);
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
    const period = searchParams.get('period') || 'week'; // 'today' or 'week'

    if (!ASSETS.includes(asset)) {
      return NextResponse.json({ error: 'Actif invalide' }, { status: 400 });
    }

    // Check cache
    const cacheKey = `${asset}-${language}-${period}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const queries = ASSET_QUERIES[asset];
    const recencyDays = period === 'today' ? 1 : 7;

    // Search for news based on period
    const [results1, results2, calendarResults] = await Promise.all([
      searchWeb(queries[period][0], 6, recencyDays),
      searchWeb(queries[period][1], 4, recencyDays),
      period === 'week' ? searchWeb(queries.calendar[0], 5, 7) : Promise.resolve([]),
    ]);

    const allResults = [...(results1 || []), ...(results2 || [])]
      .filter((item: any) => item.name && item.snippet)
      .sort((a: any, b: any) => new Date(b.date || 0).getTime() - new Date(a.date || 0).getTime());

    // Deduplicate by name similarity
    const seen = new Set<string>();
    const uniqueResults = allResults.filter((item: any) => {
      const key = item.name.toLowerCase().substring(0, 40);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Calendar/upcoming events
    const upcomingEvents = (calendarResults || [])
      .filter((item: any) => item.name && item.snippet)
      .slice(0, 5)
      .map((item: any) => ({
        title: item.name,
        snippet: item.snippet,
        url: item.url,
        source: item.host_name,
        date: item.date || null,
      }));

    // Group news by day of week for bar chart
    const newsByDay = groupNewsByDay(uniqueResults);

    // Count news per day
    const dailyCounts = Object.entries(newsByDay).map(([day, items]) => ({
      day,
      count: items.length,
    }));

    // AI Analysis
    const analysis = await analyzeWithAI(asset, uniqueResults, language, period);

    const responseData = {
      asset,
      assetLabel: ASSET_LABELS[asset],
      period,
      news: uniqueResults.slice(0, 12).map((item: any) => ({
        title: item.name,
        snippet: item.snippet,
        url: item.url,
        source: item.host_name,
        date: item.date || null,
        favicon: item.favicon || null,
      })),
      upcomingEvents,
      dailyCounts,
      analysis,
      updatedAt: new Date().toISOString(),
    };

    // Cache the result
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    return NextResponse.json(responseData);
  } catch (error) {
    console.error('News API error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des news' },
      { status: 500 }
    );
  }
}
