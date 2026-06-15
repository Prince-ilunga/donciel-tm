import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { XMLParser } from 'fast-xml-parser';

// In-memory cache — very short cache for live data (30 seconds)
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 30 * 1000; // 30 seconds for live data

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ──────────────────────────────────────────────────────
// French translations for live status
// ──────────────────────────────────────────────────────
const STATUS_FR: Record<string, string> = {
  'UPCOMING': 'À VENIR',
  'IN_PROGRESS': 'EN COURS',
  'COMPLETED': 'TERMINÉ',
  'LIVE': 'EN DIRECT',
};

// ──────────────────────────────────────────────────────
// Time helpers
// ──────────────────────────────────────────────────────
function getWeekBounds() {
  const now = new Date();
  const dayOfWeek = now.getDay();
  const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 5);
  return { monday, friday };
}

// ──────────────────────────────────────────────────────
// RSS fetching for live news
// ──────────────────────────────────────────────────────
const FEED_IDS = [1, 14, 11];

const HIGH_IMPACT_KEYWORDS = [
  'fed', 'fomc', 'interest rate', 'non-farm', 'nonfarm', 'nfp', 'cpi', 'gdp',
  'ecb', 'boe', 'rate decision', 'employment', 'inflation', 'consumer price',
];

const CURRENCY_MAP: Record<string, string> = {
  'us dollar': 'USD', 'dollar': 'USD', 'usd': 'USD', 'fed': 'USD', 'fomc': 'USD',
  'euro': 'EUR', 'eur': 'EUR', 'ecb': 'EUR', 'german': 'EUR',
  'pound': 'GBP', 'gbp': 'GBP', 'boe': 'GBP', 'uk ': 'GBP', 'british': 'GBP',
  'yen': 'JPY', 'jpy': 'JPY', 'boj': 'JPY', 'japan': 'JPY',
  'franc': 'CHF', 'chf': 'CHF', 'swiss': 'CHF', 'snb': 'CHF',
  'aussie': 'AUD', 'aud': 'AUD', 'rba': 'AUD', 'australia': 'AUD',
  'loonie': 'CAD', 'cad': 'CAD', 'boc': 'CAD', 'canada': 'CAD',
  'kiwi': 'NZD', 'nzd': 'NZD', 'rbnz': 'NZD', 'new zealand': 'NZD',
  'yuan': 'CNY', 'cny': 'CNY', 'pboc': 'CNY', 'china': 'CNY',
};

function detectCurrency(title: string): string {
  const lower = title.toLowerCase();
  const sortedKeys = Object.keys(CURRENCY_MAP).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) return CURRENCY_MAP[key];
  }
  return 'USD';
}

function isHighImpact(title: string): boolean {
  const lower = title.toLowerCase();
  return HIGH_IMPACT_KEYWORDS.some(kw => lower.includes(kw));
}

const COUNTRY_FLAGS: Record<string, string> = {
  'USD': '🇺🇸', 'EUR': '🇪🇺', 'GBP': '🇬🇧', 'JPY': '🇯🇵',
  'CHF': '🇨🇭', 'AUD': '🇦🇺', 'CAD': '🇨🇦', 'NZD': '🇳🇿', 'CNY': '🇨🇳',
};

// ──────────────────────────────────────────────────────
// Fetch RSS feeds
// ──────────────────────────────────────────────────────
async function fetchRSSFeeds(): Promise<any[]> {
  const allItems: any[] = [];

  for (const id of FEED_IDS) {
    try {
      const res = await fetch(`https://www.investing.com/rss/news_${id}.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DoncielBot/1.0)' },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) continue;
      const xml = await res.text();
      const parsed = parser.parse(xml);
      const items = parsed?.rss?.channel?.item || [];
      const list = Array.isArray(items) ? items : [items];
      for (const item of list) {
        allItems.push({
          title: item.title || '',
          link: item.link || '',
          pubDate: item.pubDate || '',
          description: item.description || '',
          category: id === 1 ? 'forex' : id === 14 ? 'economy' : 'central_banks',
        });
      }
    } catch {
      // skip failed feeds
    }
  }

  return allItems;
}

// ──────────────────────────────────────────────────────
// Generate live events from RSS
// ──────────────────────────────────────────────────────
function generateLiveEvents(items: any[], lang: string) {
  const now = new Date();
  const events: any[] = [];

  for (const item of items.slice(0, 40)) {
    const title = item.title || '';
    const currency = detectCurrency(title);
    const highImpact = isHighImpact(title);
    const pubDate = item.pubDate ? new Date(item.pubDate) : now;

    // Determine event time — estimate from pubDate or assign a recent time
    let eventTime: Date;
    if (!isNaN(pubDate.getTime())) {
      eventTime = pubDate;
    } else {
      // Assign a time distributed throughout today
      const hours = Math.floor(Math.random() * 12) + 6; // 6am-6pm
      const mins = Math.floor(Math.random() * 60);
      eventTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hours, mins);
    }

    const timeDiff = now.getTime() - eventTime.getTime();
    const isPast = timeDiff > 30 * 60 * 1000; // More than 30 min ago
    const isInProgress = timeDiff >= 0 && timeDiff <= 30 * 60 * 1000; // Within last 30 min
    const isUpcoming = timeDiff < 0;

    events.push({
      title,
      currency,
      country: COUNTRY_FLAGS[currency] || '🌍',
      impact: highImpact ? 'HIGH' : 'MEDIUM',
      time: eventTime.toISOString(),
      status: isInProgress ? 'IN_PROGRESS' : isPast ? 'COMPLETED' : 'UPCOMING',
      isHighImpact: highImpact,
    });
  }

  // Sort: IN_PROGRESS first, then UPCOMING by time, then COMPLETED
  const statusOrder: Record<string, number> = { 'IN_PROGRESS': 0, 'UPCOMING': 1, 'COMPLETED': 2 };
  events.sort((a, b) => {
    const so = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
    if (so !== 0) return so;
    return new Date(a.time).getTime() - new Date(b.time).getTime();
  });

  return events;
}

// ──────────────────────────────────────────────────────
// Try ZAI SDK for live data
// ──────────────────────────────────────────────────────
async function fetchLiveWithZAI(lang: string): Promise<any | null> {
  try {
    const zai = await import('z-ai-web-dev-sdk');
    const { web_search, llm } = zai;
    const isFr = lang === 'fr';

    // Search for today's economic events
    const searchResults = await web_search(
      isFr
        ? 'calendrier économique aujourd\'hui événements à fort impact forex'
        : 'economic calendar today high impact events forex',
      { count: 5 }
    );

    if (!searchResults?.length) return null;

    const contextText = searchResults.map((r: any, i: number) =>
      `Source ${i + 1}: ${r.title || ''} - ${r.snippet || r.content || ''}`
    ).join('\n');

    const prompt = isFr
      ? `Tu es un analyste de marché en direct. À partir des données suivantes, génère un résumé LIVE du marché.

Données de recherche:
${contextText}

Heure actuelle: ${new Date().toISOString()}

Réponds en JSON avec cette structure:
{
  "marketStatus": "OUVERT" | "FERMÉ" | "PRÉ-OUVERTURE",
  "nextEvent": { "title": "nom", "time": "HH:MM", "currency": "USD", "impact": "HIGH" },
  "recentEvents": [{ "title": "nom", "time": "HH:MM", "currency": "USD", "result": "description" }],
  "upcomingEvents": [{ "title": "nom", "time": "HH:MM", "currency": "USD", "impact": "HIGH" }],
  "liveAlert": "alerte importante en cours ou null",
  "marketMood": "HAUSSIER" | "BAISSIER" | "NEUTRE"
}`
      : `You are a live market analyst. Based on the following data, generate a LIVE market summary.

Search data:
${contextText}

Current time: ${new Date().toISOString()}

Respond in JSON with this structure:
{
  "marketStatus": "OPEN" | "CLOSED" | "PRE-MARKET",
  "nextEvent": { "title": "name", "time": "HH:MM", "currency": "USD", "impact": "HIGH" },
  "recentEvents": [{ "title": "name", "time": "HH:MM", "currency": "USD", "result": "description" }],
  "upcomingEvents": [{ "title": "name", "time": "HH:MM", "currency": "USD", "impact": "HIGH" }],
  "liveAlert": "important ongoing alert or null",
  "marketMood": "BULLISH" | "BEARISH" | "NEUTRAL"
}`;

    const response = await llm(prompt);
    const jsonMatch = response.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    return null;
  } catch {
    return null;
  }
}

// ──────────────────────────────────────────────────────
// Main handler
// ──────────────────────────────────────────────────────
export async function GET(request: NextRequest) {
  try {
    const user = await getAuthUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const lang = searchParams.get('lang') || 'fr';
    const period = searchParams.get('period') || 'today';
    const asset = searchParams.get('asset') || null;
    const isFr = lang === 'fr';

    // Check cache
    const cacheKey = `live-${lang}-${period}-${asset || 'all'}`;
    const cached = cache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const now = new Date();

    // Try ZAI SDK first
    let zaiData = await fetchLiveWithZAI(lang);

    // Fetch RSS feeds
    const rssItems = await fetchRSSFeeds();
    const liveEvents = generateLiveEvents(rssItems, lang);

    // Separate events by status
    const inProgressEvents = liveEvents.filter(e => e.status === 'IN_PROGRESS');
    const upcomingEvents = liveEvents.filter(e => e.status === 'UPCOMING').slice(0, 10);
    const completedEvents = liveEvents.filter(e => e.status === 'COMPLETED').slice(0, 5);

    // Determine market status based on current time (UTC)
    const utcHour = now.getUTCHours();
    let marketStatus: string;
    let marketStatusFr: string;
    if (utcHour >= 0 && utcHour < 7) {
      marketStatus = 'ASIAN_SESSION';
      marketStatusFr = 'SESSION ASIATIQUE';
    } else if (utcHour >= 7 && utcHour < 8) {
      marketStatus = 'PRE_EUROPE';
      marketStatusFr = 'PRÉ-OUVERTURE EUROPÉENNE';
    } else if (utcHour >= 8 && utcHour < 13) {
      marketStatus = 'EUROPEAN_SESSION';
      marketStatusFr = 'SESSION EUROPÉENNE';
    } else if (utcHour >= 13 && utcHour < 14) {
      marketStatus = 'US_PRE_MARKET';
      marketStatusFr = 'PRÉ-OUVERTURE US';
    } else if (utcHour >= 14 && utcHour < 21) {
      marketStatus = 'US_SESSION';
      marketStatusFr = 'SESSION AMÉRICAINE';
    } else {
      marketStatus = 'OFF_HOURS';
      marketStatusFr = 'HORS SESSION';
    }

    // Next upcoming high-impact event
    const nextHighImpact = upcomingEvents.find(e => e.isHighImpact) || upcomingEvents[0] || null;

    // Filter by asset if specified
    const ASSET_CURRENCIES: Record<string, string[]> = {
      'XAUUSD': ['USD', 'XAU'],
      'EURUSD': ['EUR', 'USD'],
      'GBPUSD': ['GBP', 'USD'],
      'US30': ['USD'],
      'US100': ['USD'],
    };

    let filteredInProgress = inProgressEvents;
    let filteredUpcoming = upcomingEvents;
    let filteredCompleted = completedEvents;

    if (asset && ASSET_CURRENCIES[asset]) {
      const currencies = ASSET_CURRENCIES[asset];
      filteredInProgress = inProgressEvents.filter(e => currencies.includes(e.currency));
      filteredUpcoming = upcomingEvents.filter(e => currencies.includes(e.currency));
      filteredCompleted = completedEvents.filter(e => currencies.includes(e.currency));
    }

    // Build response
    const liveData = {
      timestamp: now.toISOString(),
      marketStatus: isFr ? marketStatusFr : marketStatus,
      marketStatusRaw: marketStatus,
      nextHighImpact: nextHighImpact ? {
        ...nextHighImpact,
        statusLabel: isFr ? STATUS_FR[nextHighImpact.status] || nextHighImpact.status : nextHighImpact.status,
        countdownMs: new Date(nextHighImpact.time).getTime() - now.getTime(),
      } : null,
      inProgressEvents: filteredInProgress.map(e => ({
        ...e,
        statusLabel: isFr ? STATUS_FR[e.status] || e.status : e.status,
      })),
      upcomingEvents: filteredUpcoming.map(e => ({
        ...e,
        statusLabel: isFr ? STATUS_FR[e.status] || e.status : e.status,
        countdownMs: new Date(e.time).getTime() - now.getTime(),
      })),
      completedEvents: filteredCompleted.map(e => ({
        ...e,
        statusLabel: isFr ? STATUS_FR[e.status] || e.status : e.status,
        elapsedMs: now.getTime() - new Date(e.time).getTime(),
      })),
      liveAlert: zaiData?.liveAlert || null,
      marketMood: zaiData?.marketMood || 'NEUTRE',
      zaiEnhanced: !!zaiData,
    };

    // Cache result
    cache.set(cacheKey, { data: liveData, timestamp: Date.now() });

    return NextResponse.json(liveData);
  } catch (error) {
    console.error('[/api/market/live] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
