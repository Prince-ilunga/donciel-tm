/**
 * Cloud Storage Module — Backblaze B2 / Cloudflare R2 / Any S3-Compatible
 *
 * Uses AWS S3 SDK for cloud file storage. Works with:
 * - Backblaze B2 (10 Go gratuit, SANS carte bancaire) ← recommandé
 * - Cloudflare R2 (10 Go gratuit, demande carte bancaire)
 * - Any S3-compatible storage
 *
 * Falls back to local filesystem when cloud storage is not configured.
 *
 * ─── Variables d'environnement requises ───
 * - S3_ENDPOINT: URL du endpoint S3
 *     Backblaze B2: https://s3.REGION.backblazeb2.com
 *     Cloudflare R2: https://ACCOUNT_ID.r2.cloudflarestorage.com
 * - S3_REGION: Région du bucket (ex: us-east-005 pour B2, "auto" pour R2)
 * - S3_ACCESS_KEY_ID: Clé d'accès API
 * - S3_SECRET_ACCESS_KEY: Clé secrète API
 * - S3_BUCKET_NAME: Nom du bucket (défaut: donciel-storage)
 * - S3_PUBLIC_URL: URL publique d'accès aux fichiers (optionnel)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Configuration ──────────────────────────────────────────
const S3_ENDPOINT = process.env.S3_ENDPOINT;
const S3_REGION = process.env.S3_REGION || 'auto';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID;
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY;
const S3_BUCKET_NAME = process.env.S3_BUCKET_NAME || 'donciel-storage';
const S3_PUBLIC_URL = process.env.S3_PUBLIC_URL;

const isCloudConfigured =
  !!S3_ENDPOINT && !!S3_ACCESS_KEY_ID && !!S3_SECRET_ACCESS_KEY;

// ─── S3 Client (works with B2, R2, or any S3-compatible) ───
let s3Client: S3Client | null = null;

export function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: S3_REGION,
      endpoint: S3_ENDPOINT,
      credentials: {
        accessKeyId: S3_ACCESS_KEY_ID!,
        secretAccessKey: S3_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

// ─── Storage Operations ─────────────────────────────────────

/**
 * Upload a file to cloud storage
 * @param key - The storage key (path) for the file, e.g., "screenshots/12345-image.png"
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
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
      })
    );
    // Return the public URL
    return getPublicUrl(key);
  }

  // Fallback: return a relative path (local filesystem mode)
  return key;
}

/**
 * Upload a stream/chunk to cloud storage (for multipart uploads)
 * Same as uploadFile but works with Buffer data
 */
export async function uploadChunk(
  key: string,
  buffer: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<void> {
  if (!isCloudConfigured) return;

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

/**
 * Delete a file from cloud storage
 * @param key - The storage key (path) of the file to delete
 */
export async function deleteFile(key: string): Promise<void> {
  if (isCloudConfigured) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: S3_BUCKET_NAME,
        Key: key,
      })
    );
  }
}

/**
 * Get a signed URL for temporary access to a private file
 * @param key - The storage key (path) of the file
 * @param expiresIn - URL expiration time in seconds (default: 1 hour)
 * @returns A signed URL that grants temporary access
 */
export async function getSignedFileUrl(
  key: string,
  expiresIn: number = 3600
): Promise<string> {
  if (isCloudConfigured) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET_NAME,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn });
  }
  // Fallback: return a local API path
  return `/api/storage/${key}`;
}

/**
 * Get the public URL for a file stored in cloud storage
 * @param key - The storage key (path) of the file
 * @returns The public URL
 */
export function getPublicUrl(key: string): string {
  if (S3_PUBLIC_URL) {
    return `${S3_PUBLIC_URL}/${key}`;
  }
  // If no public URL configured, return the key (will use signed URLs via API route)
  return key;
}

/**
 * Extract the storage key from a URL or path
 * Handles both old local paths (upload/screenshots/xxx) and cloud URLs
 */
export function extractStorageKey(url: string): string {
  if (!url) return '';

  // If it's a full public URL, extract the key after the domain
  if (S3_PUBLIC_URL && url.startsWith(S3_PUBLIC_URL)) {
    return url.replace(`${S3_PUBLIC_URL}/`, '');
  }

  // If it's a local path like "upload/screenshots/xxx.png", convert to storage key
  if (url.startsWith('upload/')) {
    return url.replace('upload/', '');
  }

  // Already a clean key
  return url;
}

/**
 * Get the display URL for a stored file
 * Handles both old local paths and new cloud URLs
 */
export function getFileUrl(url: string): string {
  if (!url) return '';

  // If it's already a full URL (http/https), return as-is (cloud public URL)
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

  // If cloud is configured and it's a key without prefix, construct public URL
  if (isCloudConfigured && !url.startsWith('/')) {
    return getPublicUrl(url);
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
 * Get the bucket name (exported for use in upload complete route)
 */
export function getBucketName(): string {
  return S3_BUCKET_NAME;
}
