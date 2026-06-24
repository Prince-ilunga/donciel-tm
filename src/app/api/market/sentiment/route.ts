import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { XMLParser } from 'fast-xml-parser';

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes (today)
const CACHE_DURATION_WEEK = 10 * 60 * 1000; // 10 minutes (week - changes less)

const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '@_' });

// ──────────────────────────────────────────────────────
// Asset-specific sentiment keyword maps
// ──────────────────────────────────────────────────────

const ASSET_KEYWORD_MAP: Record<string, { bullish: string[]; bearish: string[]; keywords: string[] }> = {
  XAUUSD: {
    bullish: ['gold rally', 'gold surge', 'gold rise', 'safe haven', 'inflation hedge', 'gold bullish', 'gold support', 'gold climb'],
    bearish: ['gold drop', 'gold fall', 'gold decline', 'gold selloff', 'gold bearish', 'dollar strength', 'rate hike', 'higher rates', 'gold plunge'],
    keywords: ['gold', 'xau', 'fed', 'inflation', 'dollar', 'rate', 'safe haven', 'treasury', 'yields'],
  },
};

function computeAssetSentiment(text: string, asset: string, lang: string): {
  direction: string;
  confidence: string;
  interpretation: string;
} | null {
  const isFr = lang === 'fr';
  const map = ASSET_KEYWORD_MAP[asset.toUpperCase()];
  if (!map) return null;

  const lowerText = text.toLowerCase();

  let bullScore = 0;
  let bearScore = 0;
  map.bullish.forEach(w => { const matches = lowerText.match(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')); if (matches) bullScore += matches.length * 2; });
  map.bearish.forEach(w => { const matches = lowerText.match(new RegExp(w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')); if (matches) bearScore += matches.length * 2; });

  // Also count general bullish/bearish words when asset keywords are present nearby
  const generalBullish = ['rally', 'surge', 'gain', 'rise', 'bullish', 'recovery', 'optimism', 'boost', 'jump', 'climb', 'strong', 'higher'];
  const generalBearish = ['crash', 'selloff', 'fear', 'decline', 'bearish', 'recession', 'slump', 'tumble', 'plunge', 'drop', 'fall', 'weak', 'lower'];

  // Check if any asset keyword is present
  const hasAssetKeyword = map.keywords.some(kw => lowerText.includes(kw));
  if (hasAssetKeyword) {
    generalBullish.forEach(w => { const matches = lowerText.match(new RegExp(w, 'gi')); if (matches) bullScore += matches.length; });
    generalBearish.forEach(w => { const matches = lowerText.match(new RegExp(w, 'gi')); if (matches) bearScore += matches.length; });
  }

  const totalSignals = bullScore + bearScore;
  const direction = bullScore > bearScore * 1.3 ? 'LONG' : bearScore > bullScore * 1.3 ? 'SHORT' : 'NEUTRE';
  const confidence = totalSignals > 8 ? (isFr ? 'élevée' : 'high') : totalSignals > 4 ? (isFr ? 'moyenne' : 'medium') : (isFr ? 'faible' : 'low');

  const dirLabel = direction === 'LONG'
    ? (isFr ? 'haussier' : 'bullish')
    : direction === 'SHORT'
    ? (isFr ? 'baissier' : 'bearish')
    : (isFr ? 'neutre' : 'neutral');

  const interpretation = totalSignals === 0
    ? (isFr ? `Données insuffisantes pour déterminer le sentiment sur ${asset}.` : `Insufficient data to determine sentiment for ${asset}.`)
    : isFr
    ? `Le sentiment sur ${asset} est ${dirLabel} avec une confiance ${confidence}. ${direction === 'LONG' ? "Les signaux d'achat dominent." : direction === 'SHORT' ? "Les signaux de vente dominent." : "Les signaux sont équilibrés."} (${bullScore} signaux haussiers, ${bearScore} signaux baissiers)`
    : `Sentiment on ${asset} is ${dirLabel} with ${confidence} confidence. ${direction === 'LONG' ? 'Buying signals dominate.' : direction === 'SHORT' ? 'Selling signals dominate.' : 'Signals are balanced.'} (${bullScore} bullish, ${bearScore} bearish signals)`;

  return { direction, confidence, interpretation };
}

// ──────────────────────────────────────────────────────
// RSS fallback (works without ZAI SDK)
// ──────────────────────────────────────────────────────

const SENTIMENT_RSS_FEEDS = [
  { id: 1, name: 'Top News', keywords: ['fear', 'greed', 'vix', 'volatility', 'sentiment', 'risk', 'bull', 'bear', 'rally', 'crash', 'market', 'fed', 'rate', 'inflation', 'recession', 'peur', 'cupidité', 'volatilité', 'risque'] },
  { id: 14, name: 'Economy', keywords: ['fear', 'greed', 'vix', 'sentiment', 'fed', 'rate', 'inflation', 'recession', 'economy', 'gdp', 'employment', 'consumer', 'confidence'] },
  { id: 25, name: 'Stock Market', keywords: ['fear', 'greed', 'vix', 'sentiment', 'rally', 'selloff', 'crash', 'bull', 'bear', 'market', 'sp', 'nasdaq', 'dow'] },
];

// Analyze sentiment from news titles using keyword scoring
function analyzeSentimentFromNews(titles: string[], lang: string): {
  fearGreed: { value: number; label: string; trend: string };
  vix: { value: number; trend: string; interpretation: string };
  smartMoney: { direction: string; confidence: string };
  retail: { direction: string; confidence: string };
  contrarianSignal: string;
  overallSentiment: string;
  interpretation: string;
} {
  const isFr = lang === 'fr';
  const text = titles.join(' ').toLowerCase();

  // Score sentiment from keywords
  const bullishWords = ['rally', 'surge', 'gain', 'rise', 'bullish', 'recovery', 'optimism', 'support', 'boost', 'jump', 'soar', 'climb', 'strong', 'higher', 'hausse', 'optimisme', 'soutien', 'progression', 'rebond'];
  const bearishWords = ['crash', 'selloff', 'fear', 'decline', 'bearish', 'recession', 'risk-off', 'slump', 'tumble', 'plunge', 'drop', 'fall', 'slide', 'weak', 'lower', 'baisse', 'chute', 'recul', 'crainte', 'récession'];

  let bullScore = 0;
  let bearScore = 0;
  bullishWords.forEach(w => { const matches = text.match(new RegExp(w, 'gi')); if (matches) bullScore += matches.length; });
  bearishWords.forEach(w => { const matches = text.match(new RegExp(w, 'gi')); if (matches) bearScore += matches.length; });

  // Calculate Fear & Greed value
  const totalSignals = bullScore + bearScore;
  let fearGreedValue = 50; // neutral
  let fearGreedLabel = isFr ? 'Neutre' : 'Neutral';
  let fearGreedTrend = 'stable';

  if (totalSignals > 0) {
    fearGreedValue = Math.round(30 + (bullScore / totalSignals) * 40); // Range 30-70
    if (fearGreedValue >= 70) fearGreedLabel = isFr ? 'Cupidité' : 'Greed';
    else if (fearGreedValue >= 55) fearGreedLabel = isFr ? 'Cupidité Modérée' : 'Moderate Greed';
    else if (fearGreedValue <= 30) fearGreedLabel = isFr ? 'Peur Extrême' : 'Extreme Fear';
    else if (fearGreedValue <= 45) fearGreedLabel = isFr ? 'Peur' : 'Fear';
    fearGreedTrend = bullScore > bearScore * 1.5 ? 'rising' : bearScore > bullScore * 1.5 ? 'declining' : 'stable';
  }

  // VIX estimation
  let vixValue = 18; // default neutral
  let vixTrend: 'rising' | 'declining' | 'stable' = 'stable';
  const vixMention = text.match(/vix\s*(?:at|is|around|near|above|below)?\s*(\d+(?:\.\d+)?)/i);
  if (vixMention) vixValue = parseFloat(vixMention[1]);
  else if (bearScore > bullScore * 2) vixValue = 25;
  else if (bullScore > bearScore * 2) vixValue = 14;

  vixTrend = bearScore > bullScore * 1.3 ? 'rising' : bullScore > bearScore * 1.3 ? 'declining' : 'stable';

  const vixInterpretation = vixValue > 25
    ? (isFr ? 'Volatilité élevée — les marchés sont sous pression' : 'High volatility — markets under pressure')
    : vixValue > 20
    ? (isFr ? 'Volatilité modérée — prudence recommandée' : 'Moderate volatility — caution recommended')
    : (isFr ? 'Volatilité basse — marché calme' : 'Low volatility — calm market');

  // Smart money vs retail estimation — use French labels when lang=fr
  const smartMoneyDirRaw = bullScore > bearScore * 1.3 ? 'LONG' : bearScore > bullScore * 1.3 ? 'SHORT' : 'NEUTRAL';
  const retailDirRaw = bullScore > bearScore * 1.5 ? 'LONG' : bearScore > bullScore * 1.5 ? 'SHORT' : 'NEUTRAL';
  const smartMoneyConf = totalSignals > 8 ? (isFr ? 'élevée' : 'high') : totalSignals > 4 ? (isFr ? 'moyenne' : 'medium') : (isFr ? 'faible' : 'low');
  const retailConf = totalSignals > 10 ? (isFr ? 'élevée' : 'high') : totalSignals > 5 ? (isFr ? 'moyenne' : 'medium') : (isFr ? 'faible' : 'low');

  // Use French direction labels when lang=fr
  const smartMoneyDir = smartMoneyDirRaw === 'NEUTRAL' && isFr ? 'NEUTRE' : smartMoneyDirRaw;
  const retailDir = retailDirRaw === 'NEUTRAL' && isFr ? 'NEUTRE' : retailDirRaw;

  // Contrarian signal — always fully in the requested language
  let contrarianSignal: string;
  if (smartMoneyDir !== retailDir && smartMoneyDirRaw !== 'NEUTRAL' && retailDirRaw !== 'NEUTRAL') {
    contrarianSignal = isFr
      ? `Divergence détectée : Smart Money ${smartMoneyDir} vs Retail ${retailDir} — le suivi Smart Money est recommandé`
      : `Divergence detected: Smart Money ${smartMoneyDirRaw} vs Retail ${retailDirRaw} — following Smart Money is recommended`;
  } else if (retailDirRaw === 'LONG' && fearGreedValue > 65) {
    contrarianSignal = isFr
      ? 'Cupidité excessive détectée — prudence, correction possible'
      : 'Excessive greed detected — caution, correction possible';
  } else if (retailDirRaw === 'SHORT' && fearGreedValue < 35) {
    contrarianSignal = isFr
      ? 'Peur excessive détectée — opportunité d\'achat potentielle'
      : 'Excessive fear detected — potential buying opportunity';
  } else {
    contrarianSignal = isFr
      ? 'Données insuffisantes pour un signal contrarien fiable'
      : 'Insufficient data for a reliable contrarian signal';
  }

  // Overall sentiment
  let overallSentiment: string;
  if (fearGreedValue >= 60 && bullScore > bearScore) overallSentiment = 'RISK-ON';
  else if (fearGreedValue <= 40 && bearScore > bullScore) overallSentiment = 'RISK-OFF';
  else overallSentiment = 'NEUTRAL';

  // Interpretation
  const direction = overallSentiment === 'RISK-ON'
    ? (isFr ? 'haussier' : 'bullish')
    : overallSentiment === 'RISK-OFF'
    ? (isFr ? 'baissier' : 'bearish')
    : (isFr ? 'neutre' : 'neutral');

  const smartMoneyConfLabel = smartMoneyConf; // Already in correct language
  const noContrarianFr = 'Aucun signal contrarien significatif détecté.';
  const noContrarianEn = 'No significant contrarian signal detected.';

  const interpretation = isFr
    ? `Le sentiment de marché est actuellement ${direction} avec un Fear & Greed Index à ${fearGreedValue}/100. ${fearGreedValue >= 55 ? "L'appétit pour le risque est présent" : fearGreedValue <= 45 ? "L'aversion au risque domine" : "Le marché est dans une zone d'incertitude"}. Le VIX est estimé à ${vixValue}, indiquant ${vixValue > 25 ? "une volatilité élevée" : vixValue > 20 ? "une volatilité modérée" : "des conditions calmes"}. ${smartMoneyDirRaw !== 'NEUTRAL' ? `Les institutionnels sont positionnés ${smartMoneyDir} avec une confiance ${smartMoneyConfLabel}` : "Les positions institutionnelles sont neutres"}. ${contrarianSignal !== 'Données insuffisantes pour un signal contrarien fiable' ? contrarianSignal : noContrarianFr}`
    : `Market sentiment is currently ${direction} with a Fear & Greed Index at ${fearGreedValue}/100. ${fearGreedValue >= 55 ? "Risk appetite is present" : fearGreedValue <= 45 ? "Risk aversion dominates" : "The market is in a zone of uncertainty"}. VIX is estimated at ${vixValue}, indicating ${vixValue > 25 ? "high volatility" : vixValue > 20 ? "moderate volatility" : "calm conditions"}. ${smartMoneyDirRaw !== 'NEUTRAL' ? `Institutionals are positioned ${smartMoneyDirRaw} with ${smartMoneyConf} confidence` : "Institutional positions are neutral"}. ${contrarianSignal !== 'Insufficient data for a reliable contrarian signal' ? contrarianSignal : noContrarianEn}`;

  return {
    fearGreed: { value: fearGreedValue, label: fearGreedLabel, trend: fearGreedTrend },
    vix: { value: vixValue, trend: vixTrend, interpretation: vixInterpretation },
    smartMoney: { direction: smartMoneyDir, confidence: smartMoneyConf },
    retail: { direction: retailDir, confidence: retailConf },
    contrarianSignal,
    overallSentiment,
    interpretation,
  };
}

async function fetchSentimentRSS(): Promise<string[]> {
  const titles: string[] = [];

  const feedResults = await Promise.allSettled(
    SENTIMENT_RSS_FEEDS.map(feed =>
      fetch(`https://www.investing.com/rss/news_${feed.id}.rss`, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; DONCIEL-TM/1.0)' },
        signal: AbortSignal.timeout(10000),
      }).then(res => {
        if (!res.ok) return [];
        return res.text().then(xml => {
          const parsed = parser.parse(xml);
          const items = parsed?.rss?.channel?.item;
          const list = Array.isArray(items) ? items : items ? [items] : [];
          return list
            .filter((item: any) => {
              const title = (item.title || '').toLowerCase();
              return feed.keywords.some(kw => title.includes(kw));
            })
            .map((item: any) => item.title || '');
        });
      }).catch(() => [])
    )
  );

  for (const result of feedResults) {
    if (result.status === 'fulfilled' && Array.isArray(result.value)) {
      titles.push(...result.value);
    }
  }

  // Deduplicate
  return [...new Set(titles)];
}

// ──────────────────────────────────────────────────────
// ZAI SDK-powered fetch (primary)
// ──────────────────────────────────────────────────────

const SENTIMENT_SYSTEM_PROMPT_FR = `Tu es DONCIEL-AI™, un analyste de sentiment de marché expert. Tu interprètes les données de sentiment de marché et fournis une analyse contrarienne éclairée.

RÈGLES STRICTES :
1. Base tes interprétations sur les données factuelles récupérées
2. Le Fear & Greed Index est mesuré de 0 (peur extrême) à 100 (cupidité extrême)
3. VIX au-dessus de 25 = volatilité élevée, au-dessus de 30 = peur significative
4. L'approche contrarienne : quand le retail est très directionnel, la direction opposée est probable
5. "smartMoney" reflète les positions institutionnelles (COT, flows)
6. "retail" reflète le sentiment des traders particuliers
7. Le signal contrarien est le plus important quand retail et smart money divergent
8. overallSentiment doit être un des : "RISK-ON", "RISK-OFF", "NEUTRAL"
9. Fournis une interprétation complète et actionnable
10. Les champs direction doivent utiliser "LONG", "SHORT" ou "NEUTRE" (en français)
11. Les champs confidence doivent être en français : "élevée", "moyenne", "faible"

Tu réponds TOUJOURS au format JSON demandé, sans texte additionnel.`;

const SENTIMENT_SYSTEM_PROMPT_EN = `You are DONCIEL-AI™, an expert market sentiment analyst. You interpret market sentiment data and provide insightful contrarian analysis.

STRICT RULES:
1. Base your interpretations on the factual data retrieved
2. Fear & Greed Index is measured from 0 (extreme fear) to 100 (extreme greed)
3. VIX above 25 = high volatility, above 30 = significant fear
4. Contrarian approach: when retail is very directional, the opposite direction is probable
5. "smartMoney" reflects institutional positioning (COT, flows)
6. "retail" reflects retail trader sentiment
7. The contrarian signal is most important when retail and smart money divergent
8. overallSentiment must be one of: "RISK-ON", "RISK-OFF", "NEUTRAL"
9. Provide a comprehensive and actionable interpretation

You ALWAYS respond in the requested JSON format, with no additional text.`;

async function fetchSentimentWithZAI(lang: string, period: string): Promise<{
  fearGreed: { value: number; label: string; trend: string };
  vix: { value: number; trend: string; interpretation: string };
  smartMoney: { direction: string; confidence: string };
  retail: { direction: string; confidence: string };
  contrarianSignal: string;
  overallSentiment: string;
  interpretation: string;
  updatedAt: string;
  error?: string;
} | null> {
  const isFr = lang === 'fr';

  const fallbackResult = {
    fearGreed: { value: 50, label: isFr ? 'Neutre' : 'Neutral', trend: 'stable' },
    vix: { value: 0, trend: 'stable', interpretation: isFr ? 'Données non disponibles' : 'Data unavailable' },
    smartMoney: { direction: isFr ? 'NEUTRE' : 'NEUTRAL', confidence: isFr ? 'faible' : 'low' },
    retail: { direction: isFr ? 'NEUTRE' : 'NEUTRAL', confidence: isFr ? 'faible' : 'low' },
    contrarianSignal: isFr ? 'Données insuffisantes' : 'Insufficient data',
    overallSentiment: 'NEUTRAL',
    interpretation: isFr ? 'Données temporairement indisponibles.' : 'Data temporarily unavailable.',
    updatedAt: new Date().toISOString(),
  };

  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    const isWeek = period === 'week';
    const recencyDays = isWeek ? 7 : 1;

    const [fearGreedResult, vixResult, smartMoneyResult, retailResult] = await Promise.allSettled([
      zai.functions.invoke('web_search', {
        query: isFr ? 'CNN Fear and Greed Index valeur actuelle' : 'CNN Fear and Greed Index current value today',
        num: 5,
        recency_days: recencyDays,
      }).catch(() => null),

      zai.functions.invoke('web_search', {
        query: isFr ? 'VIX index volatilité valeur actuelle' : 'VIX volatility index current value today',
        num: 5,
        recency_days: recencyDays,
      }).catch(() => null),

      zai.functions.invoke('web_search', {
        query: isFr ? 'put call ratio COT smart money institutionnels positions' : 'put call ratio COT report smart money institutional positioning',
        num: 5,
        recency_days: isWeek ? 7 : 3,
      }).catch(() => null),

      zai.functions.invoke('web_search', {
        query: isFr ? 'sentiment traders particuliers retail forex positions' : 'retail trader sentiment forex positioning today dailyfx',
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

    const fearGreedData = extractData(fearGreedResult);
    const vixData = extractData(vixResult);
    const smartMoneySearchData = extractData(smartMoneyResult);
    const retailData = extractData(retailResult);

    const allData = [fearGreedData, vixData, smartMoneySearchData, retailData].filter(Boolean);
    if (allData.length === 0) {
      return null; // Trigger fallback
    }

    const systemPrompt = isFr ? SENTIMENT_SYSTEM_PROMPT_FR : SENTIMENT_SYSTEM_PROMPT_EN;
    const combinedData = [
      fearGreedData ? `=== FEAR & GREED INDEX ===\n${fearGreedData}` : '',
      vixData ? `=== VIX / VOLATILITÉ ===\n${vixData}` : '',
      smartMoneySearchData ? `=== SMART MONEY / COT / PUT-CALL ===\n${smartMoneySearchData}` : '',
      retailData ? `=== SENTIMENT RETAIL ===\n${retailData}` : '',
    ].filter(Boolean).join('\n\n');

    const completion = await zai.chat.completions.create({
      messages: [
        { role: 'assistant', content: systemPrompt },
        {
          role: 'user',
          content: isFr
            ? `Analyse les données de sentiment de marché suivantes et fournis une interprétation complète.

DONNÉES COLLECTÉES:
${combinedData}

Réponds au format JSON suivant:
{
  "fearGreed": { "value": nombre 0-100, "label": "Peur Extrême|Peur|Neutre|Cupidité Modérée|Cupidité", "trend": "rising|declining|stable" },
  "vix": { "value": nombre, "trend": "rising|declining|stable", "interpretation": "interprétation courte en français" },
  "smartMoney": { "direction": "LONG|SHORT|NEUTRE", "confidence": "élevée|moyenne|faible" },
  "retail": { "direction": "LONG|SHORT|NEUTRE", "confidence": "élevée|moyenne|faible" },
  "contrarianSignal": "Signal contrarien en français",
  "overallSentiment": "RISK-ON|RISK-OFF|NEUTRAL",
  "interpretation": "Interprétation complète en français"
}`
            : `Analyze the following market sentiment data and provide a complete interpretation.

COLLECTED DATA:
${combinedData}

Respond in the following JSON format:
{
  "fearGreed": { "value": number 0-100, "label": "Extreme Fear|Fear|Neutral|Greed|Extreme Greed", "trend": "rising|declining|stable" },
  "vix": { "value": number, "trend": "rising|declining|stable", "interpretation": "short interpretation" },
  "smartMoney": { "direction": "LONG|SHORT|NEUTRAL", "confidence": "high|medium|low" },
  "retail": { "direction": "LONG|SHORT|NEUTRAL", "confidence": "high|medium|low" },
  "contrarianSignal": "Contrarian signal",
  "overallSentiment": "RISK-ON|RISK-OFF|NEUTRAL",
  "interpretation": "Complete interpretation"
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
          fearGreed: parsed.fearGreed || fallbackResult.fearGreed,
          vix: parsed.vix || fallbackResult.vix,
          smartMoney: parsed.smartMoney || fallbackResult.smartMoney,
          retail: parsed.retail || fallbackResult.retail,
          contrarianSignal: parsed.contrarianSignal || fallbackResult.contrarianSignal,
          overallSentiment: parsed.overallSentiment || 'NEUTRAL',
          interpretation: parsed.interpretation || fallbackResult.interpretation,
          updatedAt: new Date().toISOString(),
        };
      }
    } catch {}

    return fallbackResult;
  } catch (error) {
    console.error('Sentiment ZAI error:', error instanceof Error ? error.message : 'Unknown error');
    return null; // Trigger fallback
  }
}

// ──────────────────────────────────────────────────────
// Main fetch with fallback chain: ZAI SDK → RSS
// ──────────────────────────────────────────────────────

async function fetchSentimentData(lang: string, period: string = 'today', asset?: string): Promise<{
  fearGreed: { value: number; label: string; trend: string };
  vix: { value: number; trend: string; interpretation: string };
  smartMoney: { direction: string; confidence: string };
  retail: { direction: string; confidence: string };
  contrarianSignal: string;
  overallSentiment: string;
  interpretation: string;
  assetSentiment?: { direction: string; confidence: string; interpretation: string };
  updatedAt: string;
  error?: string;
}> {
  const isFr = lang === 'fr';

  const fallbackResult = {
    fearGreed: { value: 50, label: isFr ? 'Neutre' : 'Neutral', trend: 'stable' },
    vix: { value: 0, trend: 'stable', interpretation: isFr ? 'Données non disponibles' : 'Data unavailable' },
    smartMoney: { direction: isFr ? 'NEUTRE' : 'NEUTRAL', confidence: isFr ? 'faible' : 'low' },
    retail: { direction: isFr ? 'NEUTRE' : 'NEUTRAL', confidence: isFr ? 'faible' : 'low' },
    contrarianSignal: isFr ? 'Données insuffisantes pour un signal contrarien' : 'Insufficient data for contrarian signal',
    overallSentiment: 'NEUTRAL',
    interpretation: isFr ? 'Données de sentiment temporairement indisponibles. Veuillez réessayer dans quelques minutes.' : 'Sentiment data temporarily unavailable. Please try again in a few minutes.',
    updatedAt: new Date().toISOString(),
  };

  // 1. Try ZAI SDK first
  const zaiResult = await fetchSentimentWithZAI(lang, period);
  if (zaiResult) {
    const result: any = { ...zaiResult };
    // Compute asset-specific sentiment if asset is provided
    if (asset) {
      // Fetch RSS titles for asset-specific analysis
      try {
        const titles = await fetchSentimentRSS();
        if (titles.length > 0) {
          result.assetSentiment = computeAssetSentiment(titles.join(' '), asset, lang);
        }
      } catch {}
    }
    return result;
  }

  // 2. Fallback: RSS feeds + keyword analysis
  console.log('Sentiment: ZAI SDK unavailable, falling back to RSS');
  try {
    const titles = await fetchSentimentRSS();
    if (titles.length > 0) {
      const analysis = analyzeSentimentFromNews(titles, lang);
      const result: any = {
        ...analysis,
        updatedAt: new Date().toISOString(),
      };
      // Add asset-specific sentiment if requested
      if (asset) {
        result.assetSentiment = computeAssetSentiment(titles.join(' '), asset, lang);
      }
      return result;
    }
  } catch (error) {
    console.error('Sentiment RSS fallback error:', error instanceof Error ? error.message : 'Unknown error');
  }

  // 3. Both failed
  const failResult: any = { ...fallbackResult, error: isFr ? 'Aucune donnée de sentiment disponible' : 'No sentiment data available' };
  if (asset) {
    failResult.assetSentiment = {
      direction: isFr ? 'NEUTRE' : 'NEUTRAL',
      confidence: isFr ? 'faible' : 'low',
      interpretation: isFr ? `Données insuffisantes pour ${asset}.` : `Insufficient data for ${asset}.`,
    };
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
    const cacheKey = `sentiment-${lang}-${period}${asset ? `-${asset}` : ''}`;
    const cached = cache.get(cacheKey);
    const cacheDuration = period === 'week' ? CACHE_DURATION_WEEK : CACHE_DURATION;
    if (cached && Date.now() - cached.timestamp < cacheDuration) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchSentimentData(lang, period, asset);

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Sentiment route error:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération du sentiment',
        fearGreed: { value: 50, label: 'Neutre', trend: 'stable' },
        vix: { value: 0, trend: 'stable', interpretation: 'Non disponible' },
        smartMoney: { direction: 'NEUTRE', confidence: 'faible' },
        retail: { direction: 'NEUTRE', confidence: 'faible' },
        contrarianSignal: 'Non disponible',
        overallSentiment: 'NEUTRAL',
        interpretation: 'Données de sentiment temporairement indisponibles.',
        updatedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
