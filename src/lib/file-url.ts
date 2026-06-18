/**
 * Client-safe file URL utility.
 *
 * This file MUST NOT import any Node.js-only modules (cloudinary, fs, path, etc.)
 * because it is imported by client components ("use client").
 *
 * The full storage module (src/lib/storage.ts) imports cloudinary/fs/path which
 * are server-only and would crash the browser bundle on Vercel production builds.
 */

/**
 * Get the display URL for a stored file.
 * Handles both old local paths and new Cloudinary URLs.
 * Pure string manipulation — safe for the browser.
 */
export function getFileUrl(url: string): string {
  if (!url) return '';

  // If it's already a full URL (Cloudinary), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If it's a local screenshot path, use the API route
  if (url.startsWith('upload/screenshots/')) {
    const filename = url.replace('upload/screenshots/', '');
    return `/api/screenshots/${filename}`;
  }

  // If it's a local video path, use the streaming API route
  if (url.startsWith('upload/videos/')) {
    const key = url.replace('upload/', '');
    return `/api/videos/stream?key=${encodeURIComponent(key)}`;
  }

  // Fallback
  return url;
}
