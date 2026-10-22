import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * LLM Proxy API Route — proxies chat completion requests to the ZAI API.
 *
 * This route exists because Vercel's serverless functions cannot reach
 * internal-api.z.ai (private IPs). The sandbox's Next.js server CAN reach it,
 * so Vercel calls this route through the Caddy gateway as a fallback.
 *
 * Called from: src/app/api/coach/route.ts (Strategy 3 fallback)
 */

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { messages, mode } = body;

    if (!messages || !Array.isArray(messages)) {
      return NextResponse.json({ error: 'messages array required' }, { status: 400 });
    }

    // Use ZAI SDK (works from sandbox where internal-api.z.ai is reachable)
    const { getZAI } = await import('@/lib/zai');
    const zai = await getZAI();

    // mode "vision" → analyse d'images (createVision). Les messages
    // contiennent des parts {type:'text'|'image_url'} au lieu d'une
    // simple string.
    const completion =
      mode === 'vision'
        ? await zai.chat.completions.createVision({
            messages,
            thinking: { type: 'disabled' },
          })
        : await zai.chat.completions.create({
            messages,
            thinking: { type: 'disabled' },
          });

    return NextResponse.json(completion);
  } catch (error: any) {
    console.error('[llm-proxy] Error:', error?.message);
    return NextResponse.json(
      { error: error?.message || 'LLM proxy error' },
      { status: 500 }
    );
  }
}
