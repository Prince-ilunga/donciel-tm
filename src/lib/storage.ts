/**
 * Cloud Storage Module — Cloudinary
 *
 * ★ 25 Go gratuit, SANS carte bancaire
 * ★ Supporte vidéos et images
 * ★ URLs publiques directes (pas besoin de signed URLs)
 *
 * Falls back to local filesystem when Cloudinary is not configured.
 *
 * ─── Variables d'environnement requises ───
 * - CLOUDINARY_CLOUD_NAME: Nom de votre cloud Cloudinary
 * - CLOUDINARY_API_KEY: Clé API Cloudinary
 * - CLOUDINARY_API_SECRET: Secret API Cloudinary
 */

import { v2 as cloudinary } from 'cloudinary';
import path from 'path';
import fs from 'fs';

// ─── Configuration ──────────────────────────────────────────
const CLOUDINARY_CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME;
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;

const isCloudConfigured =
  !!CLOUDINARY_CLOUD_NAME && !!CLOUDINARY_API_KEY && !!CLOUDINARY_API_SECRET;

// Configure Cloudinary SDK
if (isCloudConfigured) {
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
}

// ─── Storage Operations ─────────────────────────────────────

/**
 * Upload a file to Cloudinary
 * @param key - The storage key (folder/filename), e.g., "screenshots/12345-image.png"
 * @param buffer - The file data as a Buffer
 * @param contentType - MIME type of the file
 * @returns The public URL of the uploaded file
 */
export async function uploadFile(
  key: string,
  buffer: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<string> {
  if (isCloudConfigured) {
    // Determine resource type based on content type
    const isVideo = contentType.startsWith('video/');
    const resourceType = isVideo ? 'video' : 'image';

    // Extract folder and public_id from key
    const lastSlash = key.lastIndexOf('/');
    const folder = lastSlash > 0 ? key.substring(0, lastSlash) : '';
    const publicId = lastSlash > 0 ? key.substring(lastSlash + 1) : key;
    // Remove file extension from public_id (Cloudinary uses it as the resource identifier)
    const publicIdNoExt = publicId.replace(/\.[^.]+$/, '');

    const result = await cloudinary.uploader.upload(
      `data:${contentType};base64,${buffer.toString('base64')}`,
      {
        folder,
        public_id: publicIdNoExt,
        resource_type: resourceType,
        use_filename: true,
        unique_filename: false,
        overwrite: false,
      }
    );

    return result.secure_url;
  }

  // Fallback: return a relative path (local filesystem mode)
  return key;
}

/**
 * Upload a chunk to cloud storage
 * For Cloudinary, we store chunks locally during upload, then assemble at the end.
 * Cloudinary doesn't support chunked uploads natively — the complete route handles assembly.
 */
export async function uploadChunk(
  key: string,
  buffer: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<void> {
  if (!isCloudConfigured) return;

  // Store chunk locally temporarily (will be assembled and uploaded on complete)
  const chunkDir = path.join(process.cwd(), 'upload', 'chunks');
  fs.mkdirSync(chunkDir, { recursive: true });

  // key format: "chunks/uploadId/chunkIndex"
  const parts = key.split('/');
  const filename = parts.join('_');
  const chunkPath = path.join(chunkDir, filename);
  fs.writeFileSync(chunkPath, buffer);
}

/**
 * Delete a file from Cloudinary
 * @param key - The storage key or full URL of the file to delete
 */
export async function deleteFile(key: string): Promise<void> {
  if (isCloudConfigured) {
    try {
      // Extract public_id from URL or key
      const publicId = extractPublicId(key);
      if (!publicId) return;

      // Determine if it's a video based on the key/path
      const isVideo = key.includes('videos/') || publicId.includes('videos/');

      await cloudinary.uploader.destroy(publicId, {
        resource_type: isVideo ? 'video' : 'image',
      });
    } catch (error) {
      console.error('Cloudinary delete error:', error);
    }
  }
}

/**
 * Get a signed URL for temporary access to a file
 * With Cloudinary public buckets, files are publicly accessible,
 * so this just returns the direct URL.
 */
export async function getSignedFileUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  if (isCloudConfigured) {
    // Cloudinary public URLs don't expire, but we can generate a signed URL
    // For simplicity, construct the URL directly
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${key}`;
  }
  return `/api/storage/${key}`;
}

/**
 * Get the public URL for a file stored in Cloudinary
 */
export function getPublicUrl(key: string): string {
  if (isCloudConfigured) {
    return `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/image/upload/${key}`;
  }
  return key;
}

/**
 * Extract the Cloudinary public_id from a URL or path
 */
function extractPublicId(urlOrKey: string): string {
  if (!urlOrKey) return '';

  // If it's a Cloudinary URL
  if (urlOrKey.includes('res.cloudinary.com')) {
    // Format: https://res.cloudinary.com/CLOUD_NAME/image/upload/v1234567890/folder/public_id.ext
    // or: https://res.cloudinary.com/CLOUD_NAME/video/upload/v1234567890/folder/public_id.ext
    const match = urlOrKey.match(/\/(?:image|video|raw)\/upload\/v\d+\/(.+?)(?:\.[^.]+)?$/);
    if (match) return match[1];

    // Without version: .../upload/folder/public_id.ext
    const matchNoVersion = urlOrKey.match(/\/(?:image|video|raw)\/upload\/(.+?)(?:\.[^.]+)?$/);
    if (matchNoVersion) return matchNoVersion[1];
  }

  // If it's a local path like "upload/screenshots/xxx.png", convert to Cloudinary folder/key
  if (urlOrKey.startsWith('upload/')) {
    const cleanPath = urlOrKey.replace('upload/', '');
    // Remove extension for public_id
    return cleanPath.replace(/\.[^.]+$/, '');
  }

  // Already a clean key — remove extension
  return urlOrKey.replace(/\.[^.]+$/, '');
}

/**
 * Extract the storage key from a URL or path
 * Handles both old local paths and Cloudinary URLs
 */
export function extractStorageKey(url: string): string {
  if (!url) return '';

  // If it's a Cloudinary URL, return the full URL (we'll use it directly)
  if (url.includes('res.cloudinary.com')) {
    return url;
  }

  // If it's a local path like "upload/screenshots/xxx.png"
  if (url.startsWith('upload/')) {
    return url.replace('upload/', '');
  }

  return url;
}

/**
 * Get the display URL for a stored file
 * Handles both old local paths and new Cloudinary URLs
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

/**
 * Check if cloud storage is configured and available
 */
export function isStorageConfigured(): boolean {
  return isCloudConfigured;
}

/**
 * Get the Cloudinary cloud name (exported for use in other modules)
 */
export function getCloudName(): string {
  return CLOUDINARY_CLOUD_NAME || '';
}
