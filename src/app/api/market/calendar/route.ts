import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { XMLParser } from 'fast-xml-parser';

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (today)
const CACHE_DURATION_WEEK = 15 * 60 * 1000; // 15 minutes (week - changes less)

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ──────────────────────────────────────────────────────
// RSS fallback (works without ZAI SDK)
// ──────────────────────────────────────────────────────

const ECONOMIC_CALENDAR_FEEDS = [
  { id: 1, name: 'Top News', keywords: ['rate', 'fed', 'cpi', 'nfp', 'gdp', 'pmi', 'employment', 'inflation', 'interest', 'fomc', 'ecb', 'boe', 'jobless', 'retail sales', 'consumer', 'housing', 'ppi', 'manufacturing', 'decision', 'speech', 'taux', 'emploi', 'inflation', 'chômage'] },
  { id: 14, name: 'Forex & Economy', keywords: ['rate', 'fed', 'ecb', 'boe', 'cpi', 'gdp', 'nfp', 'pmi', 'employment', 'inflation', 'interest', 'jobless', 'retail', 'consumer', 'housing', 'ppi', 'manufacturing'] },
  { id: 11, name: 'Commodities & Fed', keywords: ['fed', 'rate', 'cpi', 'inflation', 'gold', 'oil', 'nfp', 'gdp', 'interest', 'pmi', 'employment'] },
];

// Impact classification keywords
const HIGH_IMPACT_KEYWORDS = ['nfp', 'non-farm', 'nonfarm', 'cpi', 'consumer price', 'fomc', 'rate decision', 'gdp', 'gross domestic', 'retail sales', 'pmi manufacturing', 'employment change', 'ipc', 'décision de taux', 'chômage', 'emploi'];
const MEDIUM_IMPACT_KEYWORDS = ['jobless claims', 'ppi', 'producer price', 'consumer confidence', 'housing starts', 'building permits', 'ism', 'industrial production', 'trade balance', 'current account', 'revendications', 'confiance', 'logement', 'production industrielle'];
const CURRENCY_MAP: Record<string, { currency: string; flag: string }> = {
  'us': { currency: 'USD', flag: '🇺🇸' },
  'united states': { currency: 'USD', flag: '🇺🇸' },
  'euro': { currency: 'EUR', flag: '🇪🇺' },
  'eurozone': { currency: 'EUR', flag: '🇪🇺' },
  'germany': { currency: 'EUR', flag: '🇩🇪' },
  'france': { currency: 'EUR', flag: '🇫🇷' },
  'uk': { currency: 'GBP', flag: '🇬🇧' },
  'britain': { currency: 'GBP', flag: '🇬🇧' },
  'japan': { currency: 'JPY', flag: '🇯🇵' },
  'china': { currency: 'CNY', flag: '🇨🇳' },
  'canada': { currency: 'CAD', flag: '🇨🇦' },
  'australia': { currency: 'AUD', flag: '🇦🇺' },
  'switzerland': { currency: 'CHF', flag: '🇨🇭' },
  'new zealand': { currency: 'NZD', flag: '🇳🇿' },
};

function classifyImpact(title: string): string {
  const t = title.toLowerCase();
  for (const kw of HIGH_IMPACT_KEYWORDS) {
    if (t.includes(kw)) return 'high';
  }
  for (const kw of MEDIUM_IMPACT_KEYWORDS) {
    if (t.includes(kw)) return 'medium';
  }
  return 'low';
}

function detectCurrency(title: string): { currency: string; flag: string } {
  const t = title.toLowerCase();
  for (const [key, val] of Object.entries(CURRENCY_MAP)) {
    if (t.includes(key)) return val;
  }
  // Check for currency codes directly
  if (t.includes('usd') || t.includes('dollar') || t.includes('fed')) return { currency: 'USD', flag: '🇺🇸' };
  if (t.includes('eur') || t.includes('euro') || t.includes('ecb')) return { currency: 'EUR', flag: '🇪🇺' };
  if (t.includes('gbp') || t.includes('pound') || t.includes('boe')) return { currency: 'GBP', flag: '🇬🇧' };
  if (t.includes('jpy') || t.includes('yen') || t.includes('boj')) return { currency: 'JPY', flag: '🇯🇵' };
  return { currency: 'USD', flag: '🇺🇸' };
}

function isEconomicEvent(title: string): boolean {
  const t = title.toLowerCase();
  const eventKeywords = ['rate', 'fed', 'cpi', 'nfp', 'gdp', 'pmi', 'employment', 'inflation', 'interest', 'fomc', 'ecb', 'boe', 'jobless', 'retail', 'consumer', 'housing', 'ppi', 'manufacturing', 'decision', 'speech', 'claim', 'index', 'balance', 'production', 'confidence', 'permits', 'starts', 'sales', 'report', 'data', 'release', 'taux', 'emploi', 'inflation', 'chômage', 'indice', 'confiance', 'production'];
  return eventKeywords.some(kw => t.includes(kw));
}

async function fetchCalendarRSS(): Promise<any[]> {
  const results: any[] = [];

  const feedResults = await Promise.allSettled(
    ECONOMIC_CALENDAR_FEEDS.map(feed =>
      fetch(`https://www.investing.com/rss/news_${feed.id}.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DONCIEL-TM/1.0)' },
        signal: AbortSignal.timeout(10000),
      }).then(res => {
        if (!res.ok) return [];
        return res.text().then(xml => {
          const parsed = parser.parse(xml);
          const items = parsed?.rss?.channel?.item;
          const list = Array.isArray(items) ? items : items ? [items] : [];
          return list.filter((item: any) => {
            const title = (item.title || '').toLowerCase();
            return feed.keywords.some(kw => title.includes(kw)) && isEconomicEvent(title);
          }).map((item: any) => ({ item, feed }));
        });
      }).catch(() => [])
    )
  );

  for (const result of feedResults) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      results.push(...result.value);
    }
  }

  return results;
}

function parseCalendarFromRSS(rssItems: any[], lang: string, period: string): {
  events: any[];
  highImpactCount: number;
  nextHighImpact: any | null;
  updatedAt: string;
} {
  const isFr = lang === 'fr';
  const now = new Date();
  const isWeek = period === 'week';

  const events = rssItems
    .map(({ item }: any) => {
      const title = item.title || '';
      const pubDate = item.pubDate || '';
      const impact = classifyImpact(title);
      const { currency, flag } = detectCurrency(title);

      // Try to extract date from pubDate
      let eventDate: Date | null = null;
      if (pubDate) {
        try {
          const d = new Date(pubDate);
          if (!isNaN(d.getTime())) eventDate = d;
        } catch {}
      }
      if (!eventDate) eventDate = now;

      return {
        date: eventDate.toISOString().split('T')[0],
        time: eventDate.toISOString().split('T')[1]?.substring(0, 5) || '',
        currency,
        impact,
        event: title,
        actual: null,
        forecast: null,
        previous: null,
        country: flag,
      };
    })
    .filter((evt: any) => {
      // Filter by period
      if (!isWeek) {
        return evt.date === now.toISOString().split('T')[0];
      }
      // Week: include events from Monday to Friday
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      const friday = new Date(monday);
      friday.setDate(monday.getDate() + 4);
      const evtDate = new Date(evt.date);
      return evtDate >= monday && evtDate <= friday;
    });

  // Deduplicate by title
  const seen = new Set<string>();
  const uniqueEvents = events.filter((evt: any) => {
    const key = evt.event.toLowerCase().substring(0, 50);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  const highImpactEvents = uniqueEvents.filter((e: any) => e.impact === 'high');
  const nextHighImpact = highImpactEvents.find((e: any) => new Date(e.date) > now) || null;

  return {
    events: uniqueEvents,
    highImpactCount: highImpactEvents.length,
    nextHighImpact,
    updatedAt: new Date().toISOString(),
  };
}

// ──────────────────────────────────────────────────────
// ZAI SDK-powered fetch (primary)
// ──────────────────────────────────────────────────────

const CALENDAR_SYSTEM_PROMPT_FR = `Tu es DONCIEL-AI™, un analyste de calendrier économique spécialisé. Tu extrais et structures les événements économiques à partir de données brutes du web.

RÈGLES STRICTES :
1. Extrais UNIQUEMENT les événements économiques réels (indicateurs, décisions de taux, discours)
2. Classe l'impact comme "high", "medium" ou "low" selon l'importance typique de l'événement
3. Les événements "high" impact incluent : NFP, CPI, FOMC, GDP, Retail Sales, PMI majeurs
4. Les événements "medium" incluent : Jobless Claims, PPI, Consumer Confidence, Housing Data
5. Les événements "low" incluent : discours mineurs, données secondaires
6. Associe le bon pays/drapeau à chaque événement
7. Si des valeurs actual/forecast/previous sont disponibles, inclus-les
8. Format de l'heure en HH:MM (heure de publication, généralement EST/ET)
9. IMPORTANT: Inclus la date de chaque événement au format YYYY-MM-DD

Tu réponds TOUJOURS au format JSON demandé, sans texte additionnel.`;

const CALENDAR_SYSTEM_PROMPT_EN = `You are DONCIEL-AI™, a specialized economic calendar analyst. You extract and structure economic events from raw web data.

STRICT RULES:
1. Extract ONLY real economic events (indicators, rate decisions, speeches)
2. Classify impact as "high", "medium" or "low" based on typical event importance
3. "high" impact events include: NFP, CPI, FOMC, GDP, Retail Sales, major PMIs
4. "medium" events include: Jobless Claims, PPI, Consumer Confidence, Housing Data
5. "low" events include: minor speeches, secondary data
6. Associate the correct country/flag with each event
7. If actual/forecast/previous values are available, include them
8. Time format in HH:MM (release time, typically EST/ET)
9. IMPORTANT: Include the date of each event in YYYY-MM-DD format

You ALWAYS respond in the requested JSON format, with no additional text.`;

async function fetchCalendarWithZAI(lang: string, period: string): Promise<{
  events: any[];
  highImpactCount: number;
  nextHighImpact: any | null;
  updatedAt: string;
  error?: string;
} | null> {
  const isFr = lang === 'fr';
  const emptyResult = {
    events: [],
    highImpactCount: 0,
    nextHighImpact: null,
    updatedAt: new Date().toISOString(),
  };

  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    const isWeek = period === 'week';
    const recencyDays = isWeek ? 7 : 2;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const weekRangeStr = `${formatDate(monday)} to ${formatDate(friday)}`;

    const searchQueries: { query: string; num: number; recency_days: number }[] = [];

    searchQueries.push({
      query: isFr
        ? isWeek
          ? `calendrier économique semaine ${weekRangeStr} forex factory événements indicateurs`
          : 'calendrier économique aujourd\'hui forex factory investing.com événements'
        : isWeek
          ? `economic calendar week ${weekRangeStr} forex factory investing.com events schedule`
          : 'economic calendar today forex factory investing.com events',
      num: 10,
      recency_days: recencyDays,
    });

    if (isWeek) {
      searchQueries.push({
        query: isFr
          ? `événements économiques cette semaine CPI NFP FOMC GDP PMI ${now.getFullYear()}`
          : `this week economic events CPI NFP FOMC GDP PMI schedule ${now.getFullYear()}`,
        num: 8,
        recency_days: 7,
      });

      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
      const monthName = monthNames[monday.getMonth()];
      searchQueries.push({
        query: isFr
          ? `calendrier économique ${monthName} ${monday.getFullYear()} semaine ${formatDate(monday)} ${formatDate(friday)} forex investing`
          : `economic calendar ${monthName} ${monday.getFullYear()} week of ${formatDate(monday)} forex investing.com events`,
        num: 8,
        recency_days: 7,
      });
    }

    const searchResults = await Promise.allSettled(
      searchQueries.map(q =>
        zai.functions.invoke('web_search', {
          query: q.query,
          num: q.num,
          recency_days: q.recency_days,
        }).catch(err => {
          console.error('Calendar web search error:', err instanceof Error ? err.message : 'Unknown error');
          return null;
        })
      )
    );

    const searchDataList: string[] = [];
    searchResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value && Array.isArray(result.value)) {
        const data = result.value
          .map((r: any) => `Title: ${r.title || r.name || ''}\nSnippet: ${r.snippet || r.description || ''}\nURL: ${r.url || r.link || ''}`)
          .join('\n\n');
        if (data) searchDataList.push(data);
      }
    });

    const allRawData = searchDataList.length > 0
      ? searchDataList.map((d, i) => `=== SEARCH RESULT ${i + 1} ===\n${d}`).join('\n\n')
      : '';

    if (!allRawData) {
      return null; // Trigger fallback
    }

    const systemPrompt = isFr ? CALENDAR_SYSTEM_PROMPT_FR : CALENDAR_SYSTEM_PROMPT_EN;
    const today = formatDate(now);

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: isFr
            ? `Date d'aujourd'hui: ${today}
Semaine en cours: ${weekRangeStr}
${isWeek ? `Période demandée: CETTE SEMAINE (${weekRangeStr}). Extrait TOUS les événements économiques du lundi ${formatDate(monday)} au vendredi ${formatDate(friday)}, Y COMPRIS les événements déjà passés cette semaine.` : "Période demandée: AUJOURD'HUI (extrait uniquement les événements du jour)"}

Extrait les événements économiques${isWeek ? ' de la semaine du lundi au vendredi' : ' du jour'} à partir des données ci-dessous. Structure-les au format JSON.
${isWeek ? '\nIMPORTANT: Inclus la date (champ "date") pour CHAQUE événement au format YYYY-MM-DD.' : ''}

DONNÉES BRUTES:
${allRawData}

Réponds au format JSON suivant:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "currency": "USD",
      "impact": "high|medium|low",
      "event": "Nom de l'événement",
      "actual": null ou "valeur",
      "forecast": null ou "valeur",
      "previous": null ou "valeur",
      "country": "🇺🇸"
    }
  ],
  "highImpactCount": nombre,
  "nextHighImpact": { prochain événement high impact } ou null
}`
            : `Today's date: ${today}
Current week: ${weekRangeStr}
${isWeek ? `Requested period: THIS WEEK (${weekRangeStr}). Extract ALL economic events from Monday ${formatDate(monday)} to Friday ${formatDate(friday)}.` : 'Requested period: TODAY (extract only today\'s events)'}

Extract ${isWeek ? 'this week\'s' : 'today\'s'} economic events from the data below. Structure them in JSON format.
${isWeek ? '\nIMPORTANT: Include the date (field "date") for EVERY event in YYYY-MM-DD format.' : ''}

RAW DATA:
${allRawData}

Respond in the following JSON format:
{
  "events": [
    {
      "date": "YYYY-MM-DD",
      "time": "HH:MM",
      "currency": "USD",
      "impact": "high|medium|low",
      "event": "Event name",
      "actual": null or "value",
      "forecast": null or "value",
      "previous": null or "value",
      "country": "🇺🇸"
    }
  ],
  "highImpactCount": number,
  "nextHighImpact": { next high impact event } or null
}`,
        },
      ],
      thinking: { type: 'disabled' },
    });

    const content = completion.choices[0]?.message?.content || '';
    let events: any[] = [];
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        events = Array.isArray(parsed.events) ? parsed.events : [];
      }
    } catch {}

    const highImpactEvents = events.filter((e: any) => (e.impact || '').toLowerCase() === 'high');
    const highImpactCount = highImpactEvents.length;
    const nextHighImpact = highImpactEvents.find((e: any) => {
      if (!e.date) return false;
      return new Date(e.date) > now;
    }) || null;

    return {
      events,
      highImpactCount,
      nextHighImpact,
      updatedAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Calendar ZAI error:', error instanceof Error ? error.message : 'Unknown error');
    return null; // Trigger fallback
  }
}

// ──────────────────────────────────────────────────────
// Main fetch with fallback chain: ZAI SDK → RSS
// ──────────────────────────────────────────────────────

async function fetchCalendarData(lang: string, period: string = 'today'): Promise<{
  events: any[];
  highImpactCount: number;
  nextHighImpact: any | null;
  updatedAt: string;
  error?: string;
}> {
  const isFr = lang === 'fr';

  // 1. Try ZAI SDK first
  const zaiResult = await fetchCalendarWithZAI(lang, period);
  if (zaiResult && zaiResult.events.length > 0) {
    return zaiResult;
  }

  // 2. Fallback: RSS feeds from investing.com
  console.log('Calendar: ZAI SDK unavailable or no results, falling back to RSS');
  try {
    const rssItems = await fetchCalendarRSS();
    if (rssItems.length > 0) {
      return parseCalendarFromRSS(rssItems, lang, period);
    }
  } catch (error) {
    console.error('Calendar RSS fallback error:', error instanceof Error ? error.message : 'Unknown error');
  }

  // 3. Both failed
  return {
    events: [],
    highImpactCount: 0,
    nextHighImpact: null,
    updatedAt: new Date().toISOString(),
    error: isFr ? 'Aucune donnée disponible' : 'No data available',
  };
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
    const cacheKey = `calendar-${lang}-${period}`;
    const cached = cache.get(cacheKey);
    const cacheDuration = period === 'week' ? CACHE_DURATION_WEEK : CACHE_DURATION;
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchCalendarData(lang, period);

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Calendar route error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du calendrier', events: [], highImpactCount: 0, nextHighImpact: null, updatedAt: new Date().toISOString() },
      { status: 500 }
    );
  }
}
