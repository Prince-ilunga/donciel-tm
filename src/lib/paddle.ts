// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Paddle Billing helpers (server-side)
// Paddle agit comme "Merchant of Record" : il vend au nom de
// DONCIEL TM, encaisse (cartes, PayPal, etc.), gère les taxes
// puis reverse les fonds. Idéal quand Stripe n'est pas
// disponible dans le pays du fondateur (ex: RDC).
//
// Variables d'environnement (Vercel) :
//  - PADDLE_API_KEY                  clé serveur (pdl_ntfset_... ou clé API)
//  - PADDLE_WEBHOOK_SECRET           secret de signature webhook
//  - PADDLE_ENV                      "production" ou vide (sandbox par défaut)
//  - NEXT_PUBLIC_PADDLE_CLIENT_TOKEN token public Paddle.js (test_xxx / live_xxx)
//  - PADDLE_PRICE_{PRO,ELITE}_{MONTHLY,YEARLY}  IDs de prix (pri_xxx)
// ─────────────────────────────────────────────────────────────

export type PaddlePlan = 'PRO' | 'ELITE';
export type PaddleInterval = 'monthly' | 'yearly';

export function paddleConfigured(): boolean {
  return Boolean(
    process.env.PADDLE_API_KEY &&
    process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN
  );
}

export function paddleApiBase(): string {
  return process.env.PADDLE_ENV === 'production'
    ? 'https://api.paddle.com'
    : 'https://sandbox-api.paddle.com';
}

export function paddleEnvironment(): 'sandbox' | 'production' {
  return process.env.PADDLE_ENV === 'production' ? 'production' : 'sandbox';
}

export function paddleClientToken(): string | null {
  return process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN || null;
}

/** Map a Paddle price ID back to the plan (from environment configuration) */
export function planFromPaddlePriceId(priceId: string | null | undefined): PaddlePlan | null {
  if (!priceId) return null;
  if (
    priceId === process.env.PADDLE_PRICE_PRO_MONTHLY ||
    priceId === process.env.PADDLE_PRICE_PRO_YEARLY
  ) return 'PRO';
  if (
    priceId === process.env.PADDLE_PRICE_ELITE_MONTHLY ||
    priceId === process.env.PADDLE_PRICE_ELITE_YEARLY
  ) return 'ELITE';
  return null;
}

export function intervalFromPaddlePriceId(priceId: string | null | undefined): PaddleInterval | null {
  if (!priceId) return null;
  if (priceId === process.env.PADDLE_PRICE_PRO_YEARLY || priceId === process.env.PADDLE_PRICE_ELITE_YEARLY) return 'yearly';
  if (priceId === process.env.PADDLE_PRICE_PRO_MONTHLY || priceId === process.env.PADDLE_PRICE_ELITE_MONTHLY) return 'monthly';
  return null;
}

// ─── Public config sent to the browser ──────────────────────
export function paddlePublicConfig() {
  if (!paddleConfigured()) return null;
  return {
    clientToken: paddleClientToken(),
    environment: paddleEnvironment(),
    priceIds: {
      'PRO:monthly': process.env.PADDLE_PRICE_PRO_MONTHLY || null,
      'PRO:yearly': process.env.PADDLE_PRICE_PRO_YEARLY || null,
      'ELITE:monthly': process.env.PADDLE_PRICE_ELITE_MONTHLY || null,
      'ELITE:yearly': process.env.PADDLE_PRICE_ELITE_YEARLY || null,
    } as Record<string, string | null>,
  };
}

// ─── Mobile money (paiement manuel validé par l'admin) ───────
export function mobileMoneyConfig() {
  const number = process.env.NEXT_PUBLIC_MM_NUMBER || null;
  const name = process.env.NEXT_PUBLIC_MM_NAME || 'DONCIEL TM';
  if (!number) return null;
  return { number, name, operators: ['MPESA', 'AIRTEL', 'ORANGE'] as const };
}

// ─── Webhook signature (HMAC-SHA256 over "ts:rawBody") ───────
export async function verifyPaddleSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader) return false;
  const parts = Object.fromEntries(
    signatureHeader.split(';').map((p) => {
      const idx = p.indexOf('=');
      return [p.slice(0, idx), p.slice(idx + 1)];
    })
  );
  const ts = parts['ts'];
  const h1 = parts['h1'];
  if (!ts || !h1) return false;

  const { createHmac, timingSafeEqual } = await import('crypto');
  const expected = createHmac('sha256', secret).update(`${ts}:${rawBody}`).digest('hex');
  try {
    const a = Buffer.from(expected, 'hex');
    const b = Buffer.from(h1, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

// ─── Customer portal session ─────────────────────────────────
export async function createPaddlePortalSession(customerId: string): Promise<string | null> {
  const key = process.env.PADDLE_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`${paddleApiBase()}/customers/${customerId}/portal-sessions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    if (!res.ok) {
      console.error('Paddle portal session error:', res.status, await res.text());
      return null;
    }
    const json = await res.json();
    return json?.data?.urls?.general?.overview || null;
  } catch (error) {
    console.error('Paddle portal session error:', error);
    return null;
  }
}
