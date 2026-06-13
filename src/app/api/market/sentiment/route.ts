import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

// In-memory cache
interface CacheEntry { data: any; timestamp: number; }
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// System prompts for LLM
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

Tu réponds TOUJOURS au format JSON demandé, sans texte additionnel.`;

const SENTIMENT_SYSTEM_PROMPT_EN = `You are DONCIEL-AI™, an expert market sentiment analyst. You interpret market sentiment data and provide insightful contrarian analysis.

STRICT RULES:
1. Base your interpretations on the factual data retrieved
2. Fear & Greed Index is measured from 0 (extreme fear) to 100 (extreme greed)
3. VIX above 25 = high volatility, above 30 = significant fear
4. Contrarian approach: when retail is very directional, the opposite direction is probable
5. "smartMoney" reflects institutional positioning (COT, flows)
6. "retail" reflects retail trader sentiment
7. The contrarian signal is most important when retail and smart money diverge
8. overallSentiment must be one of: "RISK-ON", "RISK-OFF", "NEUTRAL"
9. Provide a comprehensive and actionable interpretation

You ALWAYS respond in the requested JSON format, with no additional text.`;

async function fetchSentimentData(lang: string): Promise<{
  fearGreed: { value: number; label: string; trend: string };
  vix: { value: number; trend: string; interpretation: string };
  smartMoney: { direction: string; confidence: string };
  retail: { direction: string; confidence: string };
  contrarianSignal: string;
  overallSentiment: string;
  interpretation: string;
  updatedAt: string;
  error?: string;
}> {
  const isFr = lang === 'fr';

  const fallbackResult = {
    fearGreed: { value: 50, label: isFr ? 'Neutre' : 'Neutral', trend: 'stable' },
    vix: { value: 0, trend: 'stable', interpretation: isFr ? 'Données non disponibles' : 'Data unavailable' },
    smartMoney: { direction: 'NEUTRAL', confidence: 'low' },
    retail: { direction: 'NEUTRAL', confidence: 'low' },
    contrarianSignal: isFr ? 'Données insuffisantes pour un signal contrarien' : 'Insufficient data for contrarian signal',
    overallSentiment: 'NEUTRAL',
    interpretation: isFr ? 'Données de sentiment temporairement indisponibles. Veuillez réessayer dans quelques minutes.' : 'Sentiment data temporarily unavailable. Please try again in a few minutes.',
    updatedAt: new Date().toISOString(),
  };

  try {
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    // 1. Search for Fear & Greed Index
    let fearGreedData = '';
    try {
      const fgResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? 'CNN Fear and Greed Index valeur actuelle aujourd\'hui'
          : 'CNN Fear and Greed Index current value today',
        num: 5,
        recency_days: 1,
      });
      if (Array.isArray(fgResults)) {
        fearGreedData = fgResults
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Sentiment Fear&Greed search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 2. Search for VIX and market volatility
    let vixData = '';
    try {
      const vixResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? 'VIX index volatilité valeur actuelle marché aujourd\'hui'
          : 'VIX volatility index current value today market',
        num: 5,
        recency_days: 1,
      });
      if (Array.isArray(vixResults)) {
        vixData = vixResults
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Sentiment VIX search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 3. Search for Put/Call ratio and smart money data
    let smartMoneySearchData = '';
    try {
      const smResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? 'put call ratio COT rapport smart money institutionnels positions marché'
          : 'put call ratio COT report smart money institutional positioning market sentiment',
        num: 5,
        recency_days: 3,
      });
      if (Array.isArray(smResults)) {
        smartMoneySearchData = smResults
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Sentiment smart money search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // 4. Search for retail sentiment
    let retailData = '';
    try {
      const retailResults = await zai.functions.invoke('web_search', {
        query: isFr
          ? 'sentiment traders particuliers retail forex positions aujourd\'hui'
          : 'retail trader sentiment forex positioning today dailyfx',
        num: 5,
        recency_days: 1,
      });
      if (Array.isArray(retailResults)) {
        retailData = retailResults
          .map((r: any) => `${r.title || ''}: ${r.snippet || r.description || ''}`)
          .join('\n');
      }
    } catch (error) {
      console.error('Sentiment retail search error:', error instanceof Error ? error.message : 'Unknown error');
    }

    // Check if we have any data at all
    const allData = [fearGreedData, vixData, smartMoneySearchData, retailData].filter(Boolean);
    if (allData.length === 0) {
      return { ...fallbackResult, error: isFr ? 'Aucune donnée de sentiment disponible' : 'No sentiment data available' };
    }

    // 5. Use LLM to interpret the data
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
  "fearGreed": { "value": nombre 0-100, "label": "Extreme Fear|Fear|Neutral|Greed|Extreme Greed", "trend": "rising|declining|stable" },
  "vix": { "value": nombre, "trend": "rising|declining|stable", "interpretation": "interprétation courte" },
  "smartMoney": { "direction": "LONG [ASSET]|SHORT [ASSET]|NEUTRAL", "confidence": "high|medium|low" },
  "retail": { "direction": "LONG [ASSET]|SHORT [ASSET]|NEUTRAL", "confidence": "high|medium|low" },
  "contrarianSignal": "Signal contrarien basé sur la divergence retail vs smart money",
  "overallSentiment": "RISK-ON|RISK-OFF|NEUTRAL",
  "interpretation": "Interprétation complète de 4-5 phrases avec recommandation actionnable pour un trader"
}`
            : `Analyze the following market sentiment data and provide a complete interpretation.

COLLECTED DATA:
${combinedData}

Respond in the following JSON format:
{
  "fearGreed": { "value": number 0-100, "label": "Extreme Fear|Fear|Neutral|Greed|Extreme Greed", "trend": "rising|declining|stable" },
  "vix": { "value": number, "trend": "rising|declining|stable", "interpretation": "short interpretation" },
  "smartMoney": { "direction": "LONG [ASSET]|SHORT [ASSET]|NEUTRAL", "confidence": "high|medium|low" },
  "retail": { "direction": "LONG [ASSET]|SHORT [ASSET]|NEUTRAL", "confidence": "high|medium|low" },
  "contrarianSignal": "Contrarian signal based on retail vs smart money divergence",
  "overallSentiment": "RISK-ON|RISK-OFF|NEUTRAL",
  "interpretation": "Complete 4-5 sentence interpretation with actionable recommendation for a trader"
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
    console.error('Sentiment API error:', error instanceof Error ? error.message : 'Unknown error');
    return { ...fallbackResult, error: isFr ? 'Service temporairement indisponible' : 'Service temporarily unavailable' };
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
    const cacheKey = `sentiment-${lang}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    const data = await fetchSentimentData(lang);

    cache.set(cacheKey, { data, timestamp: Date.now() });
    return NextResponse.json(data);
  } catch (error) {
    console.error('Sentiment route error:', error);
    return NextResponse.json(
      {
        error: 'Erreur lors de la récupération du sentiment',
        fearGreed: { value: 50, label: 'Neutral', trend: 'stable' },
        vix: { value: 0, trend: 'stable', interpretation: 'Unavailable' },
        smartMoney: { direction: 'NEUTRAL', confidence: 'low' },
        retail: { direction: 'NEUTRAL', confidence: 'low' },
        contrarianSignal: 'Unavailable',
        overallSentiment: 'NEUTRAL',
        interpretation: 'Sentiment data temporarily unavailable.',
        updatedAt: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
