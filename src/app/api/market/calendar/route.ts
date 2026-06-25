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
// French translation map for common economic terms
// ──────────────────────────────────────────────────────
const FRENCH_EVENT_TRANSLATIONS: Record<string, string> = {
  'consumer price index': 'Indice des Prix à la Consommation',
  'non-farm payrolls': 'Emploi Non-Agricole',
  'nonfarm payrolls': 'Emploi Non-Agricole',
  'federal open market committee': 'Comité Federal Open Market',
  'gross domestic product': 'Produit Intérieur Brut',
  'purchasing managers index': 'Indice des Directeurs d\'Achat',
  'jobless claims': 'Demandes d\'Allocation Chômage',
  'producer price index': 'Indice des Prix à la Production',
  'consumer confidence': 'Confiance des Consommateurs',
  'housing starts': 'Mises en Chantier',
  'building permits': 'Permis de Construire',
  'industrial production': 'Production Industrielle',
  'retail sales': 'Ventes au Détail',
  'trade balance': 'Balance Commerciale',
  'interest rate decision': 'Décision sur les Taux d\'Intérêt',
  'cpi': 'IPC',
  'nfp': 'Emploi Non-Agricole',
  'fomc': 'FOMC',
  'gdp': 'PIB',
  'pmi': 'IDA',
  'ppi': 'IPP',
  'ism': 'ISM',
  'ecb': 'BCE',
  'boe': 'BdA',
  'fed': 'Fed',
  'unemployment rate': 'Taux de Chômage',
  'inflation rate': 'Taux d\'Inflation',
  'interest rate': 'Taux d\'Intérêt',
  'employment change': 'Variation de l\'Emploi',
  'manufacturing pmi': 'IDA Manufacturier',
  'services pmi': 'IDA Services',
  'core cpi': 'IPC Sous-jacent',
  'core ppi': 'IPP Sous-jacent',
  'crude oil inventories': 'Stocks de Pétrole Brut',
  'initial jobless claims': 'Demandes Initiales de Chômage',
  'continuing claims': 'Demandes Prolongées de Chômage',
  'durable goods orders': 'Commandes de Biens Durables',
  'existing home sales': 'Ventes de Logements Existants',
  'new home sales': 'Ventes de Logements Neufs',
  'factory orders': 'Commandes Industrielles',
  'current account': 'Balance des Paiements Courants',
  'retail sales ex autos': 'Ventes au Détail hors Automobile',
  'wage growth': 'Croissance des Salaires',
  'average earnings': 'Revenus Moyens',
};

function translateEventName(title: string, lang: string): string {
  if (lang !== 'fr') return title;
  const lower = title.toLowerCase();
  // Try longest matches first
  const sortedKeys = Object.keys(FRENCH_EVENT_TRANSLATIONS).sort((a, b) => b.length - a.length);
  let result = title;
  for (const en of sortedKeys) {
    if (lower.includes(en)) {
      // Case-insensitive replace
      const regex = new RegExp(en, 'gi');
      result = result.replace(regex, FRENCH_EVENT_TRANSLATIONS[en]);
    }
  }
  return result;
}

// ──────────────────────────────────────────────────────
// Event interpretation / direction / impacted pairs logic
// ──────────────────────────────────────────────────────

function getEventInterpretation(title: string, lang: string): string {
  const t = title.toLowerCase();
  const isFr = lang === 'fr';

  if (t.includes('cpi') || t.includes('consumer price') || t.includes('inflation') || t.includes('ipc')) {
    return isFr
      ? 'L\'inflation influence les décisions de politique monétaire. Un CPI supérieur aux attentes renforce la devise en favorisant un resserrement monétaire.'
      : 'Inflation influences monetary policy decisions. CPI above expectations strengthens the currency by supporting tighter policy.';
  }
  if (t.includes('nfp') || t.includes('non-farm') || t.includes('nonfarm') || t.includes('employment change') || t.includes('emploi')) {
    return isFr
      ? 'L\'emploi est un indicateur clé de santé économique. Un NFP supérieur aux attentes renforce le dollar et pèse sur les actifs en USD.'
      : 'Employment is a key economic health indicator. NFP above expectations strengthens the dollar and weighs on USD-priced assets.';
  }
  if (t.includes('fomc') || t.includes('rate decision') || t.includes('interest rate') || t.includes('taux')) {
    return isFr
      ? 'Les décisions de la Fed sur les taux ont un impact majeur sur tous les marchés. Un hausse de taux renforce le dollar, une baisse le fragilise.'
      : 'Fed rate decisions have major impact on all markets. A rate hike strengthens the dollar, a cut weakens it.';
  }
  if (t.includes('gdp') || t.includes('gross domestic') || t.includes('pib')) {
    return isFr
      ? 'Le PIB mesure la croissance économique. Un PIB robuste soutient la devise et les marchés actions.'
      : 'GDP measures economic growth. Robust GDP supports the currency and equity markets.';
  }
  if (t.includes('pmi') || t.includes('purchasing managers') || t.includes('ism') || t.includes('ida')) {
    return isFr
      ? 'Le PMI reflète l\'activité sectorielle. Un PMI au-dessus de 50 indique une expansion, en dessous une contraction.'
      : 'PMI reflects sector activity. PMI above 50 indicates expansion, below indicates contraction.';
  }
  if (t.includes('ppi') || t.includes('producer price') || t.includes('ipp')) {
    return isFr
      ? 'L\'IPP est un indicateur avancé de l\'inflation consommateur. Une hausse anticipe une hausse du CPI.'
      : 'PPI is a leading indicator of consumer inflation. A rise anticipates higher CPI.';
  }
  if (t.includes('jobless') || t.includes('claims') || t.includes('chômage')) {
    return isFr
      ? 'Les demandes de chômage mesurent la santé du marché du travail. Des demandes en baisse signalent un marché du travail robuste.'
      : 'Jobless claims measure labor market health. Declining claims signal a robust labor market.';
  }
  if (t.includes('ecb') || t.includes('bce')) {
    return isFr
      ? 'La BCE fixe la politique monétaire de la zone euro. Ses décisions impactent directement l\'EUR et les marchés européens.'
      : 'The ECB sets eurozone monetary policy. Its decisions directly impact EUR and European markets.';
  }
  if (t.includes('boe') || t.includes('bda') || t.includes('bank of england')) {
    return isFr
      ? 'La Banque d\'Angleterre fixe les taux britanniques. Ses décisions impactent la livre sterling.'
      : 'The Bank of England sets UK rates. Its decisions impact the British pound.';
  }
  if (t.includes('retail sales') || t.includes('ventes au détail')) {
    return isFr
      ? 'Les ventes au détail mesurent la consommation. Une hausse soutient la devise et les marchés actions.'
      : 'Retail sales measure consumption. An increase supports the currency and equity markets.';
  }
  if (t.includes('consumer confidence') || t.includes('confiance')) {
    return isFr
      ? 'La confiance des consommateurs préfigure la consommation future. Une hausse est positive pour l\'économie.'
      : 'Consumer confidence foreshadows future spending. A rise is positive for the economy.';
  }
  if (t.includes('housing') || t.includes('home') || t.includes('logement') || t.includes('chantier') || t.includes('permis')) {
    return isFr
      ? 'Les données immobilières reflètent la santé du secteur du logement, indicateur avancé de l\'économie.'
      : 'Housing data reflects the health of the housing sector, a leading economic indicator.';
  }
  if (t.includes('trade balance') || t.includes('balance commerciale')) {
    return isFr
      ? 'La balance commerciale mesure les exportations nettes. Un excédent soutient la devise.'
      : 'Trade balance measures net exports. A surplus supports the currency.';
  }
  if (t.includes('gold') || t.includes('oil') || t.includes('crude')) {
    return isFr
      ? 'Les matières premières sont sensibles au dollar et à la demande mondiale. Un dollar fort pèse sur les prix.'
      : 'Commodities are sensitive to the dollar and global demand. A strong dollar weighs on prices.';
  }
  return isFr
    ? 'Événement économique à surveiller pouvant impacter la volatilité des marchés.'
    : 'Economic event to watch that may impact market volatility.';
}

function getEventDirection(title: string): string {
  const t = title.toLowerCase();
  // These are "if stronger than expected" directions
  if (t.includes('cpi') || t.includes('consumer price') || t.includes('inflation') || t.includes('ppi') || t.includes('producer price')) {
    return 'BAISSIER'; // Higher inflation → bad for risk assets initially
  }
  if (t.includes('nfp') || t.includes('non-farm') || t.includes('nonfarm') || t.includes('employment') || t.includes('gdp') || t.includes('gross domestic') || t.includes('retail sales')) {
    return 'HAUSSIER'; // Strong data → good for currency/risk
  }
  if (t.includes('fomc') || t.includes('rate decision') || t.includes('interest rate')) {
    return 'NEUTRE'; // Depends on context
  }
  if (t.includes('pmi') || t.includes('ism') || t.includes('consumer confidence') || t.includes('housing')) {
    return 'NEUTRE'; // Varies by context
  }
  return 'NEUTRE';
}

function getImpactedPairs(title: string): string[] {
  const t = title.toLowerCase();
  const pairs: string[] = [];

  // The system only supports XAUUSD — only XAU/USD is returned as an impacted pair.
  // XAU/USD is impacted by USD macro events, gold/commodities, and broad risk themes.
  if (t.includes('usd') || t.includes('dollar') || t.includes('fed') || t.includes('fomc') || t.includes('nfp') || t.includes('non-farm') || t.includes('nonfarm') || t.includes('cpi') || t.includes('consumer price') || t.includes('gdp') || t.includes('rate decision') || t.includes('interest rate') || t.includes('jobless') || t.includes('claims') || t.includes('ppi') || t.includes('retail sales') || t.includes('consumer confidence') || t.includes('ism')) {
    pairs.push('XAU/USD');
  }
  if (t.includes('gold') || t.includes('xau') || t.includes('oil') || t.includes('crude') || t.includes('commodit')) {
    if (!pairs.includes('XAU/USD')) pairs.push('XAU/USD');
  }

  // Pure non-USD currency / equity index events (no USD or gold context) are not
  // relevant to XAUUSD and are left empty so they get filtered out when asset=XAUUSD.
  if (pairs.length === 0) {
    const isPureOther = t.includes('eur') || t.includes('euro') || t.includes('ecb') || t.includes('bce') ||
      t.includes('gbp') || t.includes('pound') || t.includes('boe') || t.includes('bda') || t.includes('bank of england') ||
      t.includes('jpy') || t.includes('yen') || t.includes('boj') || t.includes('japan') || t.includes('nikkei') ||
      t.includes('stock') || t.includes('dow') || t.includes('sp ') || t.includes('s&p') || t.includes('earnings') ||
      t.includes('nasdaq') || t.includes('tech') || t.includes('ai ');
    if (!isPureOther) {
      pairs.push('XAU/USD');
    }
  }

  return [...new Set(pairs)]; // Deduplicate
}

// ──────────────────────────────────────────────────────
// Asset-specific event filtering
// ──────────────────────────────────────────────────────

const ASSET_PAIR_MAP: Record<string, string[]> = {
  'XAUUSD': ['XAU/USD'],
};

function filterEventsForAsset(events: any[], asset: string): any[] {
  const relevantPairs = ASSET_PAIR_MAP[asset.toUpperCase()];
  if (!relevantPairs) return events;
  return events.filter((evt: any) => {
    const pairs: string[] = evt.impactedPairs || [];
    return pairs.some((p: string) => relevantPairs.some(rp => p.includes(rp.replace('/', '')) || rp.includes(p.replace('/', '')) || p === rp));
  });
}

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

      const eventName = translateEventName(title, lang);

      return {
        date: eventDate.toISOString().split('T')[0],
        time: eventDate.toISOString().split('T')[1]?.substring(0, 5) || '',
        currency,
        impact,
        event: eventName,
        actual: null,
        forecast: null,
        previous: null,
        country: flag,
        interpretation: getEventInterpretation(title, lang),
        direction: getEventDirection(title),
        impactedPairs: getImpactedPairs(title),
      };
    })
    .filter((evt: any) => {
      // Filter by period
      if (!isWeek) {
        return evt.date === now.toISOString().split('T')[0];
      }
      // Week: for RSS, include ALL events without strict date filtering
      // since RSS feeds mostly return recent/current events anyway
      // But still broaden the range to include the whole current week
      const dayOfWeek = now.getDay();
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(now);
      monday.setDate(now.getDate() + mondayOffset);
      monday.setHours(0, 0, 0, 0);
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      sunday.setHours(23, 59, 59, 999);
      const evtDate = new Date(evt.date);

      // Include events from the current week OR events without a specific date match
      // (RSS dates can be approximate, so include anything within a generous range)
      if (evtDate >= monday && evtDate <= sunday) return true;
      // Also include recent events (within last 2 days and next 7 days) for RSS week view
      const twoDaysAgo = new Date(now);
      twoDaysAgo.setDate(now.getDate() - 2);
      const nextWeek = new Date(now);
      nextWeek.setDate(now.getDate() + 7);
      return evtDate >= twoDaysAgo && evtDate <= nextWeek;
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
10. Pour chaque événement, fournis une interpretation (en français), une direction ("HAUSSIER", "BAISSIER" ou "NEUTRE") et les paires impactées

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
10. For each event, provide an interpretation (in English), a direction ("HAUSSIER", "BAISSIER" or "NEUTRE") and the impacted pairs

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
      "country": "🇺🇸",
      "interpretation": "Explication de l'impact de cet événement sur les marchés",
      "direction": "HAUSSIER|BAISSIER|NEUTRE",
      "impactedPairs": ["XAU/USD"]
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
      "country": "🇺🇸",
      "interpretation": "Explanation of this event's market impact",
      "direction": "HAUSSIER|BAISSIER|NEUTRE",
      "impactedPairs": ["XAU/USD"]
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

    // Ensure each event has interpretation, direction, impactedPairs.
    // The system only supports XAUUSD — sanitize AI-returned pairs to keep only XAU/USD.
    events = events.map((e: any) => {
      const rawPairs: string[] = Array.isArray(e.impactedPairs) ? e.impactedPairs : [];
      const filtered = rawPairs.filter((p: string) => /XAU|GOLD/i.test(p));
      return {
        ...e,
        interpretation: e.interpretation || getEventInterpretation(e.event || '', lang),
        direction: e.direction || getEventDirection(e.event || ''),
        impactedPairs: filtered.length > 0 ? filtered : getImpactedPairs(e.event || ''),
      };
    });

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

async function fetchCalendarData(lang: string, period: string = 'today', asset?: string): Promise<{
  events: any[];
  assetEvents?: any[];
  highImpactCount: number;
  nextHighImpact: any | null;
  updatedAt: string;
  error?: string;
}> {
  const isFr = lang === 'fr';

  // 1. Try ZAI SDK first
  const zaiResult = await fetchCalendarWithZAI(lang, period);
  if (zaiResult && zaiResult.events.length > 0) {
    const result: any = { ...zaiResult };
    if (asset) {
      result.assetEvents = filterEventsForAsset(zaiResult.events, asset);
    }
    return result;
  }

  // 2. Fallback: RSS feeds from investing.com
  console.log('Calendar: ZAI SDK unavailable or no results, falling back to RSS');
  try {
    const rssItems = await fetchCalendarRSS();
    if (rssItems.length > 0) {
      const result: any = parseCalendarFromRSS(rssItems, lang, period);
      if (asset) {
        result.assetEvents = filterEventsForAsset(result.events, asset);
      }
      return result;
    }
  } catch (error) {
    console.error('Calendar RSS fallback error:', error instanceof Error ? error.message : 'Unknown error');
  }

  // 3. Both failed
  return {
    events: [],
    assetEvents: asset ? [] : undefined,
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
    const asset = searchParams.get('asset') || undefined;

    // Check cache
    const cacheKey = `calendar-${lang}-${period}${asset ? `-${asset}` : ''}`;
    const cached = cache.get(cacheKey);
    const cacheDuration = period === 'week' ? CACHE_DURATION_WEEK : CACHE_DURATION;
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchCalendarData(lang, period, asset);

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
