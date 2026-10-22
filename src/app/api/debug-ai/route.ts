import { NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/debug-ai — DIAGNOSTIC ADMIN uniquement.
 * Sonde la chaîne IA (proxy sandbox → ZAI) et retourne le détail
 * des erreurs pour chaque URL candidate. À utiliser quand le coach
 * ou l'analyse vision renvoient une erreur.
 */
export async function POST() {
  const auth = await getAuthUser();
  if (auth.error || !auth.user) {
    return NextResponse.json({ error: auth.error || 'Non autorisé' }, { status: 401 });
  }
  if (!isAdmin(auth.user)) {
    return NextResponse.json({ error: 'Réservé à l\'administrateur' }, { status: 403 });
  }

  const { proxyBaseUrls, callOpenAICompat, openAICompatModel } = await import('@/lib/zai');
  const bases = proxyBaseUrls();

  // ─── Sonde du provider public OpenAI-compatible (si configuré) ───
  const compatBase = process.env.OPENAI_COMPAT_BASE_URL || null;
  let compatProbe: Record<string, unknown> | null = null;
  if (compatBase && process.env.OPENAI_COMPAT_API_KEY) {
    const start = Date.now();
    try {
      const completion = await callOpenAICompat(
        [{ role: 'user', content: 'Réponds uniquement: PING' }],
        60000
      );
      compatProbe = {
        base: compatBase,
        model: openAICompatModel(),
        ok: true,
        ms: Date.now() - start,
        content: String(completion?.choices?.[0]?.message?.content || '').slice(0, 80),
      };
    } catch (e: any) {
      compatProbe = {
        base: compatBase,
        ok: false,
        ms: Date.now() - start,
        error: `${e?.name || 'Error'}: ${e?.message || String(e)}`,
      };
    }
  }

  const probes = await Promise.all(
    bases.map(async (base) => {
      const start = Date.now();
      try {
        const res = await fetch(`${base}/api/llm-proxy`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            messages: [{ role: 'user', content: 'Réponds uniquement: PING' }],
            thinking: { type: 'disabled' },
          }),
          signal: AbortSignal.timeout(60000),
        });
        const ms = Date.now() - start;
        if (!res.ok) {
          const body = await res.text();
          return { base, ok: false, ms, error: `HTTP ${res.status}: ${body.slice(0, 300)}` };
        }
        const data = await res.json();
        return {
          base,
          ok: true,
          ms,
          model: data?.model || 'inconnu',
          content: String(data?.choices?.[0]?.message?.content || '').slice(0, 80),
        };
      } catch (e: any) {
        return {
          base,
          ok: false,
          ms: Date.now() - start,
          error: `${e?.name || 'Error'}: ${e?.message || String(e)}`,
        };
      }
    })
  );

  const allProbes = [...(compatProbe ? [compatProbe] : []), ...probes];

  return NextResponse.json({
    zaiProxyUrlEnv: process.env.ZAI_PROXY_URL || null,
    openaiCompatConfigured: Boolean(compatBase && process.env.OPENAI_COMPAT_API_KEY),
    isVercel: Boolean(process.env.VERCEL),
    probes: allProbes,
    verdict: allProbes.some((p) => p.ok)
      ? '✅ La chaîne IA fonctionne (au moins une URL répond)'
      : '❌ Aucune IA accessible — configure OPENAI_COMPAT_BASE_URL / OPENAI_COMPAT_API_KEY / OPENAI_COMPAT_MODEL dans Vercel (clé Gemini gratuite recommandée)',
  });
}
