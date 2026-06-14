// Helper to initialize ZAI SDK with environment-aware configuration
//
// On the sandbox: ZAI.create() reads .z-ai-config → internal-api.z.ai (private IPs, reachable)
// On Vercel:      VERCEL env var is set → use public API (api.z.ai/api/paas/v4)
// Fallback:       Hardcoded config with internal-api.z.ai (only works on sandbox/private network)

let _zaiInstance: any = null;
let _isVercel = false;

const FALLBACK_CONFIG = {
  baseUrl: 'https://internal-api.z.ai/v1',
  apiKey: 'Z.ai',
  chatId: 'chat-37d327cb-5893-4e17-a4a9-e4098be752b9',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMjYxODEzODMtNzcwOS00YjY1LWJkZjctMDQ3MGM3NTdhYWM0IiwiY2hhdF9pZCI6ImNoYXQtMzdkMzI3Y2ItNTg5My00ZTE3LWE0YTktZTQwOThiZTc1MmI5IiwicGxhdGZvcm0iOiJ6YWkifQ.Y0FAcnkiB6qvQ5dPZgGdL7npfip_pYCxx_wYhwMAocw',
  userId: '26181383-7709-4b65-bdf7-0470c757aac4',
};

export const ZAI_PUBLIC_CONFIG = {
  // Z.AI public API — documented at https://docs.z.ai
  // Path: /api/paas/v4/chat/completions (NOT /v1/chat/completions)
  baseUrl: 'https://api.z.ai/api/paas/v4',
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
      _zaiInstance = new ZAI({
        baseUrl: process.env.ZAI_BASE_URL,
        apiKey: process.env.ZAI_API_KEY,
        chatId: process.env.ZAI_CHAT_ID || '',
        token: process.env.ZAI_TOKEN || '',
        userId: process.env.ZAI_USER_ID || '',
      });
      return _zaiInstance;
    }

    // Strategy 2: On Vercel (public cloud), use public API endpoint
    // internal-api.z.ai resolves to private IPs (172.25.x.x) unreachable from Vercel
    if (process.env.VERCEL) {
      console.log('[ZAI] Detected Vercel environment — using public API (api.z.ai/api/paas/v4)');
      _isVercel = true;
      _zaiInstance = new ZAI(ZAI_PUBLIC_CONFIG);
      return _zaiInstance;
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
 * Direct fetch to the Z.AI public API — fallback for Vercel where the SDK's
 * default headers (Authorization: Bearer Z.ai) don't work with the public endpoint.
 * The public API at api.z.ai/api/paas/v4 expects a JWT Bearer token.
 */
export async function callPublicZAI(messages: { role: string; content: string }[]): Promise<any> {
  const url = 'https://api.z.ai/api/paas/v4/chat/completions';
  const token = ZAI_PUBLIC_CONFIG.token;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({
      model: 'glm-4-plus',
      messages,
      thinking: { type: 'disabled' },
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`ZAI Public API error (${response.status}): ${errorBody}`);
  }

  return await response.json();
}
