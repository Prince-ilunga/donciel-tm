// ─────────────────────────────────────────────────────────────
// DONCIEL TM — SasPay helpers (server-side)
// https://docs.saspay.me — API REST d'encaissement mobile money
// et carte bancaire (Afrique de l'Ouest et du Centre).
//
// SasPay gère le checkout hébergé : on crée une session
// (POST /checkout-sessions/), on redirige le client vers
// checkout_url, et le plan est activé soit par le webhook
// `transaction.success`, soit par le polling du statut au retour.
//
// Variables d'environnement (Vercel) :
//  - SASPAY_API_KEY          clé secrète marchande (sk_live_... / sk_test_...)
//  - SASPAY_ENV              "production" ou vide (sandbox par défaut)
//  - SASPAY_WEBHOOK_SECRET   secret de signature webhook (X-Webhook-Signature)
// ─────────────────────────────────────────────────────────────

export type SaspayPlan = 'PRO' | 'ELITE';
export type SaspayInterval = 'monthly' | 'yearly';

export function saspayConfigured(): boolean {
  return Boolean(process.env.SASPAY_API_KEY);
}

export function saspayApiBase(): string {
  return process.env.SASPAY_ENV === 'production'
    ? 'https://api.saspay.me/api/v1'
    : 'https://sandbox-api.saspay.me/api/v1';
}

export function saspayEnvironment(): 'sandbox' | 'production' {
  return process.env.SASPAY_ENV === 'production' ? 'production' : 'sandbox';
}

/** Config publique envoyée au navigateur (pas de secret ici). */
export function saspayPublicConfig() {
  if (!saspayConfigured()) return null;
  return {
    environment: saspayEnvironment(),
  };
}

// ─── Création d'une session de checkout hébergé ─────────────
export interface SaspayCheckoutInput {
  /** Montant en unités de la devise (ex: "14.99") */
  amount: string;
  /** Devise ISO 4217 (USD) */
  currency: string;
  description: string;
  customerEmail: string;
  customerName: string;
  customerPhone?: string;
  returnUrl?: string;
  metadata?: Record<string, unknown>;
}

export interface SaspayCheckoutSession {
  id: string;
  slug?: string;
  checkout_url: string;
  amount: string;
  currency: string;
  status: string;
  transaction?: { id?: string; status?: string } | null;
  paid_at?: string | null;
}

export async function createSaspayCheckoutSession(
  input: SaspayCheckoutInput
): Promise<SaspayCheckoutSession> {
  const key = process.env.SASPAY_API_KEY;
  if (!key) throw new Error('SasPay non configuré (SASPAY_API_KEY manquant)');

  const res = await fetch(`${saspayApiBase()}/checkout-sessions/`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: input.amount,
      currency: input.currency,
      description: input.description,
      customer_email: input.customerEmail,
      customer_name: input.customerName,
      ...(input.customerPhone ? { customer_phone: input.customerPhone } : {}),
      ...(input.returnUrl ? { return_url: input.returnUrl } : {}),
      ...(input.metadata ? { metadata: input.metadata } : {}),
    }),
    signal: AbortSignal.timeout(30000),
  });

  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.error?.message || json?.message || `HTTP ${res.status}`;
    throw new Error(`SasPay checkout error: ${message}`);
  }
  // Enveloppe de réponse SasPay : { success, data, code }
  const session = (json?.data ?? json) as SaspayCheckoutSession;
  if (!session?.id || !session?.checkout_url) {
    throw new Error('SasPay checkout error: réponse inattendue');
  }
  return session;
}

// ─── Statut d'une session (revérifie toujours côté gateway) ──
export interface SaspaySessionStatus {
  id: string;
  slug?: string;
  status: string; // PENDING, PAID, EXPIRED, CANCELLED…
  transaction_id?: string | null;
  transaction_status?: string | null; // SUCCESS, FAILED, PENDING…
  transaction_reference?: string | null;
}

export async function getSaspaySessionStatus(
  sessionId: string
): Promise<SaspaySessionStatus | null> {
  const key = process.env.SASPAY_API_KEY;
  if (!key) throw new Error('SasPay non configuré (SASPAY_API_KEY manquant)');

  const res = await fetch(
    `${saspayApiBase()}/checkout-sessions/${encodeURIComponent(sessionId)}/status/`,
    {
      headers: { Authorization: `Bearer ${key}` },
      signal: AbortSignal.timeout(20000),
    }
  );
  if (res.status === 404) return null;
  const json = await res.json().catch(() => null);
  if (!res.ok) {
    const message = json?.error?.message || json?.message || `HTTP ${res.status}`;
    throw new Error(`SasPay status error: ${message}`);
  }
  return (json?.data ?? json) as SaspaySessionStatus;
}

// ─── Vérification de la signature webhook ────────────────────
// Signature = HMAC-SHA256 hex de `${timestamp}.${rawBody}` avec le
// signing_secret. Headers : X-Webhook-Signature, X-Webhook-Timestamp,
// X-Webhook-Event. Tolérance horloge : 5 minutes.
export async function verifySaspayWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  timestampHeader: string | null,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !timestampHeader) return false;

  // 1. Contrôle de l'âge (rejeu) : ±5 minutes
  const ts = Number(timestampHeader);
  if (!Number.isFinite(ts)) return false;
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - ts) > 300) return false;

  // 2. Contrôle de la signature (temps constant, corps brut)
  const { createHmac, timingSafeEqual } = await import('crypto');
  const expected = createHmac('sha256', secret).update(`${timestampHeader}.${rawBody}`).digest('hex');
  try {
    const a = Buffer.from(signatureHeader.toLowerCase(), 'hex');
    const b = Buffer.from(expected, 'hex');
    return a.length === b.length && timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
