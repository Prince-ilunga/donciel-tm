import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (today)
const CACHE_DURATION_WEEK = 15 * 60 * 1000; // 15 minutes (week - changes less)

// System prompts for LLM
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

async function fetchCalendarData(lang: string, period: string = 'today'): Promise<{
  events: any[];
  highImpactCount: number;
  nextHighImpact: any | null;
  updatedAt: string;
  error?: string;
}> {
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

    // Compute date range for the week
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon, ...
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    const friday = new Date(monday);
    friday.setDate(monday.getDate() + 4);

    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const weekRangeStr = `${formatDate(monday)} to ${formatDate(friday)}`;

    // 1. Web search for economic events
    let searchData = '';
    try {
      const searchResults = await zai.functions.invoke('web_search', {
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

      if (Array.isArray(searchResults)) {
        searchData = searchResults
          .map((r: any) => `Title: ${r.title || r.name || ''}\nSnippet: ${r.snippet || r.description || ''}\nURL: ${r.url || r.link || ''}`)
          .join('\n\n');
      }
    } catch (error) {
      console.error('Calendar web search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 2. Second search with different terms for more coverage (especially for weekly)
    let searchData2 = '';
    if (isWeek) {
      try {
        const searchResults2 = await zai.functions.invoke('web_search', {
          query: isFr
            ? `événements économiques cette semaine CPI NFP FOMC GDP PMI ${now.getFullYear()}`
            : `this week economic events CPI NFP FOMC GDP PMI schedule ${now.getFullYear()}`,
          num: 8,
          recency_days: 7,
        });

        if (Array.isArray(searchResults2)) {
          searchData2 = searchResults2
            .map((r: any) => `Title: ${r.title || r.name || ''}\nSnippet: ${r.snippet || r.description || ''}\nURL: ${r.url || r.link || ''}`)
            .join('\n\n');
        }
      } catch (error) {
        console.error('Calendar web search 2 error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // 2b. Third search - targeted query with month name for better weekly results
    let searchData3 = '';
    if (isWeek) {
      try {
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthName = monthNames[monday.getMonth()];
        const searchResults3 = await zai.functions.invoke('web_search', {
          query: isFr
            ? `calendrier économique ${monthName} ${monday.getFullYear()} semaine ${formatDate(monday)} ${formatDate(friday)} forex investing`
            : `economic calendar ${monthName} ${monday.getFullYear()} week of ${formatDate(monday)} forex investing.com events`,
          num: 8,
          recency_days: 7,
        });

        if (Array.isArray(searchResults3)) {
          searchData3 = searchResults3
            .map((r: any) => `Title: ${r.title || r.name || ''}\nSnippet: ${r.snippet || r.description || ''}\nURL: ${r.url || r.link || ''}`)
            .join('\n\n');
        }
      } catch (error) {
        console.error('Calendar web search 3 error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // 3. Try to read ForexFactory calendar page
    let pageData = '';
    try {
      const pageResult = await zai.functions.invoke('page_reader', {
        url: 'https://www.forexfactory.com/calendar',
      });

      if (pageResult?.data) {
        const html = pageResult.data.html || '';
        const title = pageResult.data.title || '';
        const textContent = html
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .substring(0, 8000);
        pageData = `Page: ${title}\n\n${textContent}`;
      }
    } catch (error) {
      console.error('Calendar page reader error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 4. Try to read investing.com calendar for weekly data
    let investingData = '';
    if (isWeek) {
      try {
        const investingResult = await zai.functions.invoke('page_reader', {
          url: 'https://www.investing.com/economic-calendar/',
        });

        if (investingResult?.data) {
          const html = investingResult.data.html || '';
          const title = investingResult.data.title || '';
          const textContent = html
            .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
            .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 6000);
          investingData = `Page: ${title}\n\n${textContent}`;
        }
      } catch (error) {
        console.error('Calendar investing.com reader error:', error instanceof Error ? error.message : 'Unknown error');
      }
    }

    // 5. Use LLM to parse and structure the events
    const allRawData = [
      searchData ? `=== WEB SEARCH RESULTS ===\n${searchData}` : '',
      searchData2 ? `=== ADDITIONAL SEARCH RESULTS ===\n${searchData2}` : '',
      searchData3 ? `=== WEEKLY SEARCH RESULTS ===\n${searchData3}` : '',
      pageData ? `=== FOREXFACTORY CALENDAR PAGE ===\n${pageData}` : '',
      investingData ? `=== INVESTING.COM CALENDAR ===\n${investingData}` : '',
    ].filter(Boolean).join('\n\n');

    // For weekly: also build a search-only dataset (without page reader noise) as fallback
    const searchOnlyData = [
      searchData ? `=== WEB SEARCH RESULTS ===\n${searchData}` : '',
      searchData2 ? `=== ADDITIONAL SEARCH RESULTS ===\n${searchData2}` : '',
      searchData3 ? `=== WEEKLY SEARCH RESULTS ===\n${searchData3}` : '',
    ].filter(Boolean).join('\n\n');

    if (!allRawData) {
      return { ...emptyResult, error: isFr ? 'Aucune donnée disponible' : 'No data available' };
    }

    const systemPrompt = isFr ? CALENDAR_SYSTEM_PROMPT_FR : CALENDAR_SYSTEM_PROMPT_EN;
    const today = formatDate(now);

    // Helper to call LLM with given data
    async function parseWithLLM(rawData: string): Promise<any[]> {
      const completion = await zai.chat.completions.create({
        messages: [
          { role: 'assistant', content: systemPrompt },
          {
            role: 'user',
            content: isFr
              ? `Date d'aujourd'hui: ${today}
Semaine en cours: ${weekRangeStr}
${isWeek ? `Période demandée: CETTE SEMAINE (${weekRangeStr}). Extrait TOUS les événements économiques du lundi ${formatDate(monday)} au vendredi ${formatDate(friday)}, Y COMPRIS les événements déjà passés cette semaine. Même si c'est le week-end, il y a eu des événements cette semaine.` : "Période demandée: AUJOURD'HUI (extrait uniquement les événements du jour)"}

Extrait les événements économiques${isWeek ? ' de la semaine du lundi au vendredi' : ' du jour'} à partir des données ci-dessous. Structure-les au format JSON.
${isWeek ? '\nIMPORTANT: Inclus la date (champ "date") pour CHAQUE événement au format YYYY-MM-DD. Les dates doivent être entre ' + formatDate(monday) + ' et ' + formatDate(friday) + '. Ne laisse AUCUN événement sans date.' : ''}

DONNÉES BRUTES:
${rawData}

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
${isWeek ? `Requested period: THIS WEEK (${weekRangeStr}). Extract ALL economic events from Monday ${formatDate(monday)} to Friday ${formatDate(friday)}, INCLUDING past events that already occurred this week. Even though it may be the weekend, there were events this week.` : 'Requested period: TODAY (extract only today\'s events)'}

Extract ${isWeek ? 'this week\'s' : 'today\'s'} economic events from the data below. Structure them in JSON format.
${isWeek ? '\nIMPORTANT: Include the date (field "date") for EVERY event in YYYY-MM-DD format. Dates must be between ' + formatDate(monday) + ' and ' + formatDate(friday) + '. Do NOT leave any event without a date.' : ''}

RAW DATA:
${rawData}

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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return Array.isArray(parsed.events) ? parsed.events : [];
      }
      return [];
    }

    // First attempt: use all data (search + page readers)
    let events: any[] = [];
    try {
      events = await parseWithLLM(allRawData);
    } catch {}

    // Retry for weekly: if first attempt returns 0 events, try with search-only data (less noise)
    if (isWeek && events.length === 0 && searchOnlyData) {
      console.log('Calendar: First LLM attempt returned 0 events for weekly, retrying with search-only data...');
      try {
        events = await parseWithLLM(searchOnlyData);
      } catch {}
    }

    // Compute derived fields
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
    console.error('Calendar API error:', error instanceof Error ? error.message : 'Unknown error');
    return { ...emptyResult, error: isFr ? 'Service temporairement indisponible' : 'Service temporarily unavailable' };
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
