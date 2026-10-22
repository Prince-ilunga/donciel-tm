// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Génération des icônes PWA (sharp)
// Source : scripts/icon.svg
// Sortie : public/icons/icon-192.png, icon-512.png, icon-maskable-512.png
// Usage  : bun scripts/gen-icons.mjs
// ─────────────────────────────────────────────────────────────
import { readFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const sourceSvg = readFileSync(path.join(root, 'scripts', 'icon.svg'), 'utf8');
const outDir = path.join(root, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

async function render(svgString, size, filename) {
  await sharp(Buffer.from(svgString))
    .resize(size, size)
    .png()
    .toFile(path.join(outDir, filename));
  console.log(`✓ ${filename} (${size}x${size})`);
}

// Icônes standard (coins arrondis dessinés dans le SVG)
await render(sourceSvg, 192, 'icon-192.png');
await render(sourceSvg, 512, 'icon-512.png');

// Variante maskable : fond pleine surface (rx=0) + contenu réduit à la
// safe zone 80 % centrée (padding de 10 % de chaque côté).
const maskableSvg = sourceSvg
  .replaceAll('rx="96"', 'rx="0"')
  .replace(
    '<g id="art">',
    '<g id="art" transform="translate(51.2 51.2) scale(0.8)">'
  );
await render(maskableSvg, 512, 'icon-maskable-512.png');

console.log('Icônes PWA générées dans public/icons/');
