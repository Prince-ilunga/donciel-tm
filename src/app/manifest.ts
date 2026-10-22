import type { MetadataRoute } from 'next';

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Manifeste PWA (route metadata Next.js)
// Génère /manifest.webmanifest — installable sur mobile.
// ─────────────────────────────────────────────────────────────
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'DONCIEL TM — Journal de Trading',
    short_name: 'DONCIEL',
    description:
      'Journal de trading professionnel : statistiques avancées, score de discipline DONCIEL, coach IA et rapports mensuels.',
    start_url: '/app',
    display: 'standalone',
    background_color: '#04060a',
    theme_color: '#04060a',
    lang: 'fr',
    orientation: 'portrait',
    categories: ['finance', 'productivity', 'business'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  };
}
