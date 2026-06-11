import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';

const ASSETS = ['XAUUSD', 'EURUSD', 'GBPUSD', 'US30', 'US100'] as const;
type Asset = (typeof ASSETS)[number];

const ASSET_QUERIES: Record<Asset, string[]> = {
  XAUUSD: ['gold price news today forex', 'XAUUSD analysis forecast', 'gold market news Federal Reserve'],
  EURUSD: ['EURUSD news today forex', 'euro dollar analysis forecast', 'ECB interest rate news'],
  GBPUSD: ['GBPUSD news today forex', 'pound dollar analysis forecast', 'Bank of England interest rate news'],
  US30: ['US30 Dow Jones news today', 'US30 index analysis forecast', 'US stock market news Federal Reserve'],
  US100: ['US100 Nasdaq news today', 'US100 index analysis forecast', 'Nasdaq tech stocks news'],
};

const ASSET_LABELS: Record<Asset, { fr: string; en: string; emoji: string }> = {
  XAUUSD: { fr: 'Or / Dollar', en: 'Gold / Dollar', emoji: '🥇' },
  EURUSD: { fr: 'Euro / Dollar', en: 'Euro / Dollar', emoji: '🇪🇺' },
  GBPUSD: { fr: 'Livre / Dollar', en: 'Pound / Dollar', emoji: '🇬🇧' },
  US30: { fr: 'Dow Jones 30', en: 'Dow Jones 30', emoji: '🏭' },
  US100: { fr: 'Nasdaq 100', en: 'Nasdaq 100', emoji: '💻' },
};

// In-memory cache (5 minutes)
interface CacheEntry {
  data: any;
  timestamp: number;
}
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

async function searchWeb(query: string, num = 8) {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();
    return await zai.functions.invoke('web_search', {
      query,
      num,
      recency_days: 1,
    });
  } catch (error) {
    console.error('Web search error:', error);
    return [];
  }
}

async function analyzeWithAI(asset: Asset, newsItems: any[], language: string) {
  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;
    const zai = await ZAI.create();

    const newsSummary = newsItems
      .slice(0, 8)
      .map((item: any, i: number) => `${i + 1}. ${item.name}\n   ${item.snippet}`)
      .join('\n\n');

    const lang = language === 'fr' ? 'français' : 'English';
    const assetLabel = language === 'fr' ? ASSET_LABELS[asset].fr : ASSET_LABELS[asset].en;

    const completion = await zai.chat.completions.create({
      messages: [
        {
          role: 'assistant',
          content: `Tu es un analyste fondamental professionnel du marché Forex et des indices boursiers. Tu analyses les news économiques et fournis une interprétation claire et concise. Réponds en ${lang}.`,
        },
        {
          role: 'user',
          content: `Analyse les news suivantes pour l'actif ${asset} (${assetLabel}) et fournis :

1. **Résumé fondamental** : 2-3 phrases résumant le contexte économique actuel pour cet actif
2. **Direction probable** : indique clairement HAUSSIER, BAISSIER ou NEUTRE avec un niveau de confiance (élevé/moyen/faible)
3. **Facteurs clés** : liste de 3-4 facteurs qui influencent la direction
4. **Niveau d'impact** : IMPACT ÉLEVÉ, IMPACT MODÉRÉ ou IMPACT FAIBLE
5. **Recommandation trading** : une phrase de conseil pratique pour un day trader

News récentes :
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
    // Try to parse JSON from the response
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

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const asset = searchParams.get('asset') as Asset || 'XAUUSD';
    const language = searchParams.get('lang') || 'fr';

    if (!ASSETS.includes(asset)) {
      return NextResponse.json({ error: 'Actif invalide' }, { status: 400 });
    }

    // Check cache
    const cacheKey = `${asset}-${language}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return NextResponse.json(cached.data);
    }

    // Search for news for this asset
    const queries = ASSET_QUERIES[asset];
    const [results1, results2] = await Promise.all([
      searchWeb(queries[0], 6),
      searchWeb(queries[1], 4),
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

    // AI Analysis
    const analysis = await analyzeWithAI(asset, uniqueResults, language);

    const responseData = {
      asset,
      assetLabel: ASSET_LABELS[asset],
      news: uniqueResults.slice(0, 10).map((item: any) => ({
        title: item.name,
        snippet: item.snippet,
        url: item.url,
        source: item.host_name,
        date: item.date || null,
        favicon: item.favicon || null,
      })),
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
