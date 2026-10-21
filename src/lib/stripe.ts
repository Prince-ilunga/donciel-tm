// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Stripe client singleton
// STRIPE_SECRET_KEY is configured in Vercel environment variables.
// ─────────────────────────────────────────────────────────────
import Stripe from 'stripe';

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return null;
  if (!stripeClient) {
    stripeClient = new Stripe(key, {
      apiVersion: '2025-11-17.clover' as Stripe.LatestApiVersion,
    });
  }
  return stripeClient;
}

export function appUrl(): string {
  return process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
}
