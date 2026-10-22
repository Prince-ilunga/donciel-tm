// Helper to initialize ZAI SDK with environment-aware configuration
//
// On the sandbox: ZAI.create() reads .z-ai-config → internal-api.z.ai (private IPs, reachable)
// On Vercel:      Uses ZAI_PROXY_URL env var to call sandbox's /api/llm-proxy endpoint
//                 The sandbox's Next.js server proxies the request to internal-api.z.ai
// Fallback:       Hardcoded config with internal-api.z.ai (only works on sandbox/private network)

let _zaiInstance: any = null;

const FALLBACK_CONFIG = {
  baseUrl: 'https://internal-api.z.ai/v1',
  apiKey: 'Z.ai',
  chatId: 'chat-37d327cb-5893-4e17-a4a9-e4098be752b9',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMjYxODEzODMtNzcwOS00YjY1LWJkZjctMDQ3MGM3NTdhYWM0IiwiY2hhdF9pZCI6ImNoYXQtMzdkMzI3Y2ItNTg5My00ZTE3LWE0YTktZTQwOThiZTc1MmI5IiwicGxhdGZvcm0iOiJ6YWkifQ.Y0FAcnkiB6qvQ5dPZgGdL7npfip_pYCxx_wYhwMAocw',
  userId: '26181383-7709-4b65-bdf7-0470c757aac4',
};

/** Returns true if running on Vercel (public cloud) where internal-api.z.ai is unreachable */
export function isVercel(): boolean {
  return !!process.env.VERCEL;
}

export async function getZAI() {
  if (_zaiInstance) return _zaiInstance;

  try {
    const ZAI = (await import('z-ai-web-dev-sdk')).default;

    // Strategy 1: Try env vars (for Vercel with env vars configured)
    if (process.env.ZAI_BASE_URL && process.env.ZAI_API_KEY) {
      console.log('[ZAI] Using env var config');
      _zaiInstance = new ZAI({
        baseUrl: process.env.ZAI_BASE_URL,
        apiKey: process.env.ZAI_API_KEY,
        chatId: process.env.ZAI_CHAT_ID || '',
        token: process.env.ZAI_TOKEN || '',
        userId: process.env.ZAI_USER_ID || '',
      });
      return _zaiInstance;
    }

    // Strategy 2: On Vercel, we cannot use the SDK directly (internal-api unreachable)
    // The caller should use callSandboxProxy() instead
    if (process.env.VERCEL) {
      console.log('[ZAI] Vercel detected — SDK cannot reach internal-api.z.ai, use callSandboxProxy()');
      // Return a dummy instance that will fail — caller must handle this
      // by falling back to callSandboxProxy()
      _zaiInstance = null;
      return null;
    }

    // Strategy 3: Try file-based config (local dev / sandbox)
    try {
      _zaiInstance = await ZAI.create();
      return _zaiInstance;
    } catch {}

    // Strategy 4: Use hardcoded fallback config
    _zaiInstance = new ZAI(FALLBACK_CONFIG);
    return _zaiInstance;
  } catch (error) {
    console.error('ZAI SDK init error:', error);
    throw error;
  }
}

/**
 * Call the ZAI LLM API through the sandbox proxy.
 *
 * On Vercel, internal-api.z.ai is unreachable (private IPs).
 * The sandbox runs a Next.js server with /api/llm-proxy that
 * forwards requests to internal-api.z.ai using the ZAI SDK.
 *
 * This function calls that proxy endpoint through the Caddy gateway.
 *
 * Required env var: ZAI_PROXY_URL (e.g., http://8.212.10.159:81)
 */
// Passerelle publique du sandbox (stable d'une session à l'autre).
// Utilisée en secours si ZAI_PROXY_URL est absent ou injoignable.
const SANDBOX_GATEWAY_FALLBACK = 'http://8.212.10.159:81';

/** Liste ordonnée des URLs de proxy à essayer. */
export function proxyBaseUrls(): string[] {
  const urls: string[] = [];
  const env = process.env.ZAI_PROXY_URL?.replace(/\/+$/, '');
  if (env) urls.push(env);
  if (!env || env !== SANDBOX_GATEWAY_FALLBACK) urls.push(SANDBOX_GATEWAY_FALLBACK);
  return urls;
}

/**
 * Appel unifié du proxy sandbox avec basculement automatique :
 * essaie chaque URL candidate jusqu'à la première qui répond.
 */
async function proxyFetchLLM(body: Record<string, unknown>, timeoutMs = 180000): Promise<any> {
  let lastError: any = null;
  for (const base of proxyBaseUrls()) {
    try {
      const response = await fetch(`${base}/api/llm-proxy`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Proxy ${base} → HTTP ${response.status}: ${errorBody.slice(0, 200)}`);
      }
      return await response.json();
    } catch (e: any) {
      lastError = e;
      console.error(`[ZAI Proxy] échec ${base}:`, e?.message);
    }
  }
  throw lastError ?? new Error('Aucune URL de proxy disponible');
}

/**
 * Call the ZAI LLM API through the sandbox proxy (avec fallback).
 *
 * On Vercel, internal-api.z.ai est injoignable (IPs privées) :
 * on relaie via la passerelle sandbox. Si ZAI_PROXY_URL échoue,
 * la passerelle publique par défaut est essayée automatiquement.
 */
export async function callSandboxProxy(messages: { role: string; content: string }[]): Promise<any> {
  return proxyFetchLLM({
    messages,
    thinking: { type: 'disabled' },
  });
}

// ─── Strategy 0 : provider public OpenAI-compatible ─────────
// (Gemini API gratuite, Groq, OpenRouter…) — fonctionne
// PARTOUT (Vercel inclus), sans dépendance au sandbox.
// Env vars :
//  - OPENAI_COMPAT_BASE_URL  ex: https://generativelanguage.googleapis.com/v1beta/openai
//  - OPENAI_COMPAT_API_KEY   la clé API
//  - OPENAI_COMPAT_MODEL     ex: gemini-3.8-flash (vision OK)
const DEFAULT_COMPAT_MODEL = 'gemini-3.8-flash';
// Replis essayés automatiquement quand le modèle configuré n'est
// plus disponible (ex: gemini-2.0-flash retiré par Google).
const FALLBACK_COMPAT_MODELS = ['gemini-3.8-flash', 'gemini-2.5-flash'];
// Dernier modèle ayant répondu (mémoire par instance serverless)
let lastWorkingCompatModel: string | null = null;

/** Modèle effectivement utilisé (env → dernier qui marche → défaut) */
export function openAICompatModel(): string {
  return process.env.OPENAI_COMPAT_MODEL || lastWorkingCompatModel || DEFAULT_COMPAT_MODEL;
}

export async function callOpenAICompat(
  messages: unknown[],
  timeoutMs = 180000
): Promise<any | null> {
  const base = process.env.OPENAI_COMPAT_BASE_URL?.replace(/\/+$/, '');
  const key = process.env.OPENAI_COMPAT_API_KEY;
  if (!base || !key) return null; // non configuré → stratégie suivante

  // Candidats : dernier qui marchait → modèle configuré → replis
  const candidates = [
    ...new Set(
      [lastWorkingCompatModel, process.env.OPENAI_COMPAT_MODEL, ...FALLBACK_COMPAT_MODELS].filter(
        (m): m is string => Boolean(m)
      )
    ),
  ];

  for (let i = 0; i < candidates.length; i++) {
    const model = candidates[i];
    const isLast = i === candidates.length - 1;
    try {
      const res = await fetch(`${base}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ model, messages }),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!res.ok) {
        const errBody = await res.text();
        const modelUnavailable =
          res.status === 404 ||
          /no longer available|not found|does not exist|deprecat/i.test(errBody);
        // Modèle retiré → bascule automatique sur le candidat suivant
        if (modelUnavailable && !isLast) continue;
        throw new Error(
          `Provider IA (${base}) → HTTP ${res.status}: ${errBody.slice(0, 200)}`
        );
      }
      lastWorkingCompatModel = model;
      return res.json();
    } catch (e) {
      if (isLast) throw e;
    }
  }
  throw new Error(`Provider IA (${base}) → aucun modèle candidat n'a répondu`);
}

/**
 * Unified LLM call that works on both sandbox and Vercel.
 *
 * - On sandbox/local: Uses the ZAI SDK directly
 * - On Vercel: Uses callSandboxProxy() to route through the sandbox
 */
export async function callZAI(messages: { role: string; content: string }[]): Promise<any> {
  // Strategy 0 : provider public OpenAI-compatible (si configuré)
  const compat = await callOpenAICompat(messages);
  if (compat) return compat;

  // On Vercel, use the sandbox proxy
  if (process.env.VERCEL) {
    try {
      return await callSandboxProxy(messages);
    } catch (proxyError: any) {
      console.error('[ZAI] Sandbox proxy failed:', proxyError?.message);
      throw proxyError;
    }
  }

  // On sandbox/local, use the ZAI SDK directly
  const zai = await getZAI();
  if (!zai) {
    throw new Error('ZAI SDK not initialized');
  }

  return await zai.chat.completions.create({
    messages,
    thinking: { type: 'disabled' },
  });
}

// ─── Vision (analyse d'images) ──────────────────────────────
// Message multimodal : content est un tableau de parts
// {type:'text', text} / {type:'image_url', image_url:{url}}.
export type VisionMessage = {
  role: string;
  content: Array<
    | { type: 'text'; text: string }
    | { type: 'image_url'; image_url: { url: string } }
  >;
};

/**
 * Appel LLM avec vision (analyse d'images), unifié sandbox/Vercel.
 * - Sandbox : SDK direct via createVision()
 * - Vercel  : proxy sandbox /api/llm-proxy avec mode:'vision'
 */
export async function callZAIVision(messages: VisionMessage[]): Promise<any> {
  // Strategy 0 : provider public OpenAI-compatible (si configuré)
  const compat = await callOpenAICompat(messages);
  if (compat) return compat;

  if (process.env.VERCEL) {
    return proxyFetchLLM({
      messages,
      mode: 'vision',
      thinking: { type: 'disabled' },
    });
  }

  const zai = await getZAI();
  if (!zai) {
    throw new Error('ZAI SDK not initialized');
  }
  return await zai.chat.completions.createVision({
    messages,
    thinking: { type: 'disabled' },
  });
}
