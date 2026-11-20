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

// ─── Strategy 0 : pool multi-fournisseurs OpenAI-compatible ─
// Fonctionne PARTOUT (Vercel inclus), sans dépendance au sandbox.
//
// Chaque clé est essayée dans l'ordre ; quand une clé atteint sa
// limite (429/quota) ou est invalide (401/403), le système passe
// automatiquement à la suivante (cooldown mémoire par instance).
//
// Variables d'environnement :
//  - OPENAI_COMPAT_BASE_URL / OPENAI_COMPAT_API_KEY / OPENAI_COMPAT_MODEL
//      → clé principale (Google Gemini via endpoint OpenAI-compatible)
//  - GEMINI_API_KEY_1, GEMINI_API_KEY_2       → 2 clés Gemini supplémentaires
//  - AGNES_API_KEY_1, AGNES_API_KEY_2         → 2 clés Agnes AI (agnes-ai.com)
//  - MISTRAL_API_KEY_1                        → 1 clé Mistral AI
//  - AGNES_MODEL (défaut agnes-2.5-flash), MISTRAL_MODEL (défaut mistral-small-latest)
const DEFAULT_COMPAT_MODEL = 'gemini-flash-latest';
// Replis essayés automatiquement quand le modèle configuré n'est plus
// disponible. « gemini-flash-latest » est un alias maintenu par Google
// qui pointe toujours vers le flash stable actuel.
const FALLBACK_COMPAT_MODELS = [
  'gemini-flash-latest',
  'gemini-2.5-flash-lite',
  'gemini-3.5-flash-lite',
  'gemini-3.8-flash',
];

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
const AGNES_BASE_URL = 'https://apihub.agnes-ai.com/v1';
const MISTRAL_BASE_URL = 'https://api.mistral.ai/v1';

interface ProviderKey {
  /** Identifiant stable pour la mémoire de rotation */
  label: string;
  baseUrl: string;
  apiKey: string;
  /** Modèles candidats, dans l'ordre de préférence */
  models: string[];
  /** Le provider accepte les parts image_url (vision) */
  vision: boolean;
}

function geminiModels(): string[] {
  return [process.env.OPENAI_COMPAT_MODEL, ...FALLBACK_COMPAT_MODELS].filter(
    (m): m is string => Boolean(m)
  );
}

function agnesModels(): string[] {
  return [process.env.AGNES_MODEL || 'agnes-2.5-flash', 'agnes-3.0-flash'].filter(Boolean);
}

function mistralModels(): string[] {
  const model = process.env.MISTRAL_MODEL || 'mistral-small-latest';
  const list = [model];
  if (!/pixtral/i.test(model)) list.push('pixtral-large-latest'); // secours vision
  return list;
}

/** Pool ordonné des clés configurées (les clés vides sont ignorées). */
export function providerKeyPool(): ProviderKey[] {
  const pool: ProviderKey[] = [];
  const compatBase = process.env.OPENAI_COMPAT_BASE_URL?.replace(/\/+$/, '');
  const compatKey = process.env.OPENAI_COMPAT_API_KEY;
  if (compatBase && compatKey) {
    pool.push({ label: 'compat-primary', baseUrl: compatBase, apiKey: compatKey, models: geminiModels(), vision: true });
  }
  if (process.env.GEMINI_API_KEY_1) {
    pool.push({ label: 'gemini-1', baseUrl: GEMINI_BASE_URL, apiKey: process.env.GEMINI_API_KEY_1, models: geminiModels(), vision: true });
  }
  if (process.env.GEMINI_API_KEY_2) {
    pool.push({ label: 'gemini-2', baseUrl: GEMINI_BASE_URL, apiKey: process.env.GEMINI_API_KEY_2, models: geminiModels(), vision: true });
  }
  if (process.env.AGNES_API_KEY_1) {
    pool.push({ label: 'agnes-1', baseUrl: AGNES_BASE_URL, apiKey: process.env.AGNES_API_KEY_1, models: agnesModels(), vision: true });
  }
  if (process.env.AGNES_API_KEY_2) {
    pool.push({ label: 'agnes-2', baseUrl: AGNES_BASE_URL, apiKey: process.env.AGNES_API_KEY_2, models: agnesModels(), vision: true });
  }
  if (process.env.MISTRAL_API_KEY_1) {
    pool.push({ label: 'mistral-1', baseUrl: MISTRAL_BASE_URL, apiKey: process.env.MISTRAL_API_KEY_1, models: mistralModels(), vision: false });
  }
  return pool;
}

// ─── Mémoire de rotation (par instance serverless) ──────────
// Cooldown par clé : une clé en erreur n'est retestée qu'après
// expiration, sauf si toutes les autres sont indisponibles.
const COOLDOWNS: Record<string, number> = {
  RATE_LIMIT: 5 * 60 * 1000,   // 429 / quota atteint → 5 min
  AUTH: 30 * 60 * 1000,        // 401/403 clé invalide → 30 min
  TRANSIENT: 60 * 1000,        // 5xx / réseau / timeout → 1 min
};
const cooldownUntil = new Map<string, number>();
// Dernière clé ayant répondu (stickiness : on ne la reteste en premier)
let lastWorkingKeyLabel: string | null = null;

type FailureKind = keyof typeof COOLDOWNS | 'FATAL';

function classifyFailure(status: number | undefined, message: string): FailureKind {
  const msg = String(message || '');
  if (status === 401 || status === 403) return 'AUTH';
  if (status === 429 || /rate.?limit|quota|resource.?exhaust|high demand|overload/i.test(msg)) return 'RATE_LIMIT';
  if (status === 400) return 'FATAL'; // requête invalide → inutile de retenter
  return 'TRANSIENT';
}

/** Modèle effectivement utilisé (env → dernière clé qui marche → défaut) */
export function openAICompatModel(): string {
  return process.env.OPENAI_COMPAT_MODEL || DEFAULT_COMPAT_MODEL;
}

function isVisionMessage(messages: unknown[]): boolean {
  return messages.some((m: any) =>
    Array.isArray(m?.content) &&
    m.content.some((p: any) => p?.type === 'image_url')
  );
}

async function callProviderKey(
  key: ProviderKey,
  messages: unknown[],
  timeoutMs: number
): Promise<any> {
  const attempt = async (model: string, capMs: number) => {
    const res = await fetch(`${key.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key.apiKey}`,
      },
      body: JSON.stringify({ model, messages }),
      signal: AbortSignal.timeout(capMs),
    });
    if (res.ok) return res.json();
    const errBody = await res.text();
    const err = new Error(`HTTP ${res.status}: ${errBody.slice(0, 150)}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  };

  // Candidats : modèle configuré/env → replis du provider
  const candidates = [...new Set(key.models)].filter(Boolean);
  const tried: string[] = [];
  const started = Date.now();
  let attemptsUsed = 0;

  for (const model of candidates) {
    // Garde-fou budget : au-delà de 70 % du temps imparti, on arrête
    // le parcours des modèles (le 1er essai garde le timeout complet).
    if (attemptsUsed > 0 && Date.now() - started > timeoutMs * 0.7) {
      tried.push('budget de temps dépassé — arrêt du parcours');
      break;
    }
    // 1er essai : timeout complet ; suivants : plafonnés à 90 s
    const cap = attemptsUsed === 0 ? timeoutMs : Math.min(timeoutMs, 90000);
    attemptsUsed++;
    try {
      const json = await attempt(model, cap);
      lastWorkingKeyLabel = key.label;
      cooldownUntil.delete(key.label);
      return json;
    } catch (e: any) {
      const status = e?.status;
      const msg = String(e?.message || '');
      tried.push(`${model} → ${msg}`);
      const kind = classifyFailure(status, msg);
      if (kind === 'AUTH' || kind === 'FATAL') {
        // Clé invalide ou requête invalide → les modèles suivants de ce
        // provider n'aideront pas : propager vers la clé suivante.
        throw new Error(`Provider IA ${key.label} (${key.baseUrl}) → ${msg}`);
      }
      if (model !== candidates[candidates.length - 1]) {
        continue; // modèle suivant de CE provider (modèle indisponible, etc.)
      }
      // Dernier modèle du provider en échec transitoire → propager
      throw new Error(`Provider IA ${key.label} (${key.baseUrl}) → ${msg}`);
    }
  }
  throw new Error(`Provider IA ${key.label} (${key.baseUrl}) → aucun modèle disponible [${tried.slice(0, 4).join(' | ')}]`);
}

/**
 * Appel LLM via le pool de clés OpenAI-compatible, avec rotation
 * automatique : chaque clé est essayée dans l'ordre ; en cas de
 * limite atteinte (429/quota), d'erreur d'authentification ou de
 * panne, le système bascule sur la clé suivante du pool.
 *
 * opts.vision : filtrer les providers qui n'acceptent pas les images.
 */
export async function callOpenAICompat(
  messages: unknown[],
  timeoutMs = 180000,
  opts?: { vision?: boolean }
): Promise<any | null> {
  const pool = providerKeyPool();
  if (pool.length === 0) return null; // non configuré → stratégie suivante

  const wantsVision = opts?.vision || isVisionMessage(messages);
  const usable = wantsVision ? pool.filter((k) => k.vision) : pool;
  const candidates = usable.length > 0 ? usable : pool; // si seul Mistral est configuré, tenter quand même

  const now = Date.now();
  const fresh = candidates.filter((k) => (cooldownUntil.get(k.label) ?? 0) <= now);
  const ordered = [...new Set([
    ...fresh.filter((k) => k.label === lastWorkingKeyLabel), // sticky : dernière clé qui marche
    ...fresh.filter((k) => k.label !== lastWorkingKeyLabel),
    ...(fresh.length === 0 ? candidates : []), // tout est en cooldown → tenter quand même
  ])];

  let lastError: any = null;
  for (const key of ordered) {
    try {
      return await callProviderKey(key, messages, timeoutMs);
    } catch (e: any) {
      lastError = e;
      const status = e?.status;
      const msg = String(e?.message || '');
      const kind = classifyFailure(status, msg);
      if (kind !== 'FATAL') {
        cooldownUntil.set(key.label, Date.now() + COOLDOWNS[kind]);
        console.warn(`[AI POOL] ${key.label} en cooldown (${kind}) : ${msg.slice(0, 120)}`);
      } else {
        console.error(`[AI POOL] ${key.label} échec fatal : ${msg.slice(0, 120)}`);
      }
    }
  }

  // Toutes les clés ont échoué → découverte automatique des modèles
  // disponibles (GET /models) sur chaque provider, puis dernière chance.
  for (const key of ordered.slice(0, 3)) {
    const discovered = await discoverCompatModels(key.baseUrl, key.apiKey);
    const poolIds = discovered
      .filter((id) => !/tts|embed|audio|imagen|veo|native|live/i.test(id))
      .slice(0, 8);
    const variants: string[] = [];
    for (const id of poolIds) {
      variants.push(id);
      if (id.startsWith('models/')) variants.push(id.slice('models/'.length));
    }
    const unique = [...new Set(variants)]
      .filter((m) => !key.models.includes(m))
      .slice(0, 8);
    const retryKey: ProviderKey = { ...key, models: unique };
    for (const model of unique) {
      try {
        const json = await callProviderKey(retryKey, messages, Math.min(timeoutMs, 90000));
        lastWorkingKeyLabel = key.label;
        return json;
      } catch {
        // on continue sur le modèle/provider suivant
      }
    }
  }

  throw lastError ?? new Error('Aucune clé IA disponible dans le pool');
}

/**
 * Liste les modèles disponibles du provider OpenAI-compatible
 * (GET /models). Retourne les ids triés : les modèles "flash" d'abord.
 */
export async function discoverCompatModels(
  base: string,
  key: string,
  timeoutMs = 20000
): Promise<string[]> {
  try {
    const res = await fetch(`${base}/models`, {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return [];
    const data = await res.json();
    const ids: string[] = (data?.data || [])
      .map((m: any) => String(m?.id || ''))
      .filter(Boolean);
    return ids.sort((a, b) => {
      const score = (id: string) => {
        const plain = id.replace(/^models\//, '');
        if (/^gemini-flash-latest$/i.test(plain)) return 0; // alias toujours à jour
        if (/flash.*lite/i.test(plain) && !/preview|image|tts/i.test(plain)) return 1; // lite = moins de demande
        if (/flash/i.test(plain) && !/preview/i.test(plain)) return 2;
        return 3;
      };
      return score(a) - score(b);
    });
  } catch {
    return [];
  }
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
  // Strategy 0 : pool de clés public OpenAI-compatible (si configuré)
  const compat = await callOpenAICompat(messages, 180000, { vision: true });
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
