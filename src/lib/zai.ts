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
export async function callSandboxProxy(messages: { role: string; content: string }[]): Promise<any> {
  const proxyUrl = process.env.ZAI_PROXY_URL;
  if (!proxyUrl) {
    throw new Error('ZAI_PROXY_URL not configured. Set it to the sandbox URL (e.g., http://YOUR_SANDBOX_IP:81)');
  }

  const url = `${proxyUrl}/api/llm-proxy`;

  console.log(`[ZAI Proxy] Calling sandbox proxy at ${url}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      thinking: { type: 'disabled' },
    }),
    signal: AbortSignal.timeout(120000), // 2 min timeout for LLM responses
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Sandbox proxy error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();

  // The /api/llm-proxy route returns the raw ZAI SDK response
  // which has the same format as chat.completions.create()
  return data;
}

/**
 * Unified LLM call that works on both sandbox and Vercel.
 *
 * - On sandbox/local: Uses the ZAI SDK directly
 * - On Vercel: Uses callSandboxProxy() to route through the sandbox
 */
export async function callZAI(messages: { role: string; content: string }[]): Promise<any> {
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
