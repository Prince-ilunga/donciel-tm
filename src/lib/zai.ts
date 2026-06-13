// Helper to initialize ZAI SDK with multiple fallback strategies
// 1. Environment variables (ZAI_*) - for Vercel with env vars configured
// 2. Hardcoded fallback config - for Vercel without env vars
// 3. File-based config (.z-ai-config) - for local dev

let _zaiInstance: any = null;

const FALLBACK_CONFIG = {
  baseUrl: 'https://internal-api.z.ai/v1',
  apiKey: 'Z.ai',
  chatId: 'chat-37d327cb-5893-4e17-a4a9-e4098be752b9',
  token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoiMjYxODEzODMtNzcwOS00YjY1LWJkZjctMDQ3MGM3NTdhYWM0IiwiY2hhdF9pZCI6ImNoYXQtMzdkMzI3Y2ItNTg5My00ZTE3LWE0YTktZTQwOThiZTc1MmI5IiwicGxhdGZvcm0iOiJ6YWkifQ.Y0FAcnkiB6qvQ5dPZgGdL7npfip_pYCxx_wYhwMAocw',
  userId: '26181383-7709-4b65-bdf7-0470c757aac4',
};

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

    // Strategy 2: Try file-based config (local dev)
    try {
      _zaiInstance = await ZAI.create();
      return _zaiInstance;
    } catch {}

    // Strategy 3: Use hardcoded fallback config (Vercel production)
    _zaiInstance = new ZAI(FALLBACK_CONFIG);
    return _zaiInstance;
  } catch (error) {
    console.error('ZAI SDK init error:', error);
    throw error;
  }
}
