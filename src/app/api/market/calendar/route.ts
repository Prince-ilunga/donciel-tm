import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

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

You ALWAYS respond in the requested JSON format, with no additional text.`;

async function fetchCalendarData(lang: string): Promise<{
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

    // 1. Web search for today's and this week's economic events
    let searchData = '';
    try {
      const searchResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? 'calendrier économique aujourd\'hui cette semaine forex factory investing.com événements'
          : 'economic calendar today this week forex factory investing.com events',
        num: 8,
        recency_days: 1,
      });

      if (Array.isArray(searchResults)) {
        searchData = searchResults
          .map((r: any) => `Title: ${r.title || r.name || ''}\nSnippet: ${r.snippet || r.description || ''}\nURL: ${r.url || r.link || ''}`)
          .join('\n\n');
      }
    } catch (error) {
      console.error('Calendar web search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 2. Try to read ForexFactory calendar page
    let pageData = '';
    try {
      const pageResult = await zai.functions.invoke('page_reader', {
        url: 'https://www.forexfactory.com/calendar',
      });

      if (pageResult?.data) {
        // Extract text content from HTML - just get the text, not raw HTML
        const html = pageResult.data.html || '';
        const title = pageResult.data.title || '';
        // Strip HTML tags for a cleaner LLM input (limit size)
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

    // 3. Use LLM to parse and structure the events
    if (!searchData && !pageData) {
      return { ...emptyResult, error: isFr ? 'Aucune donnée disponible' : 'No data available' };
    }

    const systemPrompt = isFr ? CALENDAR_SYSTEM_PROMPT_FR : CALENDAR_SYSTEM_PROMPT_EN;
    const today = new Date().toISOString().split('T')[0];

    const rawData = [
      searchData ? `=== WEB SEARCH RESULTS ===\n${searchData}` : '',
      pageData ? `=== FOREXFACTORY CALENDAR PAGE ===\n${pageData}` : '',
    ].filter(Boolean).join('\n\n');

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: isFr
            ? `Date d'aujourd'hui: ${today}

Extrait les événements économiques du jour et de cette semaine à partir des données ci-dessous. Structure-les au format JSON.

DONNÉES BRUTES:
${rawData}

Réponds au format JSON suivant:
{
  "events": [
    {
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

Extract today's and this week's economic events from the data below. Structure them in JSON format.

RAW DATA:
${rawData}

Respond in the following JSON format:
{
  "events": [
    {
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
    try {
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return {
          events: Array.isArray(parsed.events) ? parsed.events : [],
          highImpactCount: parsed.highImpactCount || 0,
          nextHighImpact: parsed.nextHighImpact || null,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch {}

    return emptyResult;
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

    // Check cache
    const cacheKey = `calendar-${lang}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchCalendarData(lang);

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
