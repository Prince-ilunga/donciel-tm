import type { Metadata } from 'next';
import RapportClient from './rapport-client';

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Rapport mensuel imprimable (Pack 4 — Croissance)
// Page publique autonome (comme /abonnement) : la page vérifie
// l'authentification côté client (fetch /api/auth/me → /login).
// SANS useSearchParams — le mois se choisit avec useState.
// ─────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Rapport mensuel — DONCIEL TM',
  description:
    'Rapport mensuel de trading imprimable : stats clés, calendrier P&L, top trades, score DONCIEL et violations de risque.',
};

export default function RapportPage() {
  return <RapportClient />;
}
