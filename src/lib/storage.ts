/**
 * Cloudflare R2 Storage Module
 *
 * Uses AWS S3 SDK (R2 is S3-compatible) for cloud file storage.
 * Falls back to local filesystem when R2 is not configured.
 *
 * Required environment variables for R2:
 * - R2_ACCOUNT_ID: Your Cloudflare account ID
 * - R2_ACCESS_KEY_ID: R2 API token access key
 * - R2_SECRET_ACCESS_KEY: R2 API token secret key
 * - R2_BUCKET_NAME: Name of your R2 bucket
 * - R2_PUBLIC_URL: Public URL for accessing files (e.g., https://cdn.donciel.com)
 */

import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

// ─── Configuration ──────────────────────────────────────────
const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID;
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID;
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY;
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME || 'donciel-storage';
const R2_PUBLIC_URL = process.env.R2_PUBLIC_URL;

const isR2Configured =
  !!R2_ACCOUNT_ID && !!R2_ACCESS_KEY_ID && !!R2_SECRET_ACCESS_KEY;

// ─── S3 Client (R2-compatible) ──────────────────────────────
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!s3Client) {
    s3Client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID!,
        secretAccessKey: R2_SECRET_ACCESS_KEY!,
      },
    });
  }
  return s3Client;
}

// ─── Storage Operations ─────────────────────────────────────

/**
 * Upload a file to R2 storage
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
  if (isR2Configured) {
    const client = getS3Client();
    await client.send(
      new PutObjectCommand({
        Bucket: R2_BUCKET_NAME,
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
 * Upload a stream/chunk to R2 (for multipart uploads)
 * Same as uploadFile but works with Buffer data
 */
export async function uploadChunk(
  key: string,
  buffer: Buffer,
  contentType: string = 'application/octet-stream'
): Promise<void> {
  if (!isR2Configured) return;

  const client = getS3Client();
  await client.send(
    new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    })
  );
}

/**
 * Delete a file from R2 storage
 * @param key - The storage key (path) of the file to delete
 */
export async function deleteFile(key: string): Promise<void> {
  if (isR2Configured) {
    const client = getS3Client();
    await client.send(
      new DeleteObjectCommand({
        Bucket: R2_BUCKET_NAME,
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
  if (isR2Configured) {
    const client = getS3Client();
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: key,
    });
    return getSignedUrl(client, command, { expiresIn });
  }
  // Fallback: return a local API path
  return `/api/storage/${key}`;
}

/**
 * Get the public URL for a file stored in R2
 * @param key - The storage key (path) of the file
 * @returns The public URL
 */
export function getPublicUrl(key: string): string {
  if (R2_PUBLIC_URL) {
    return `${R2_PUBLIC_URL}/${key}`;
  }
  // If no public URL configured, use signed URLs
  return key;
}

/**
 * Extract the storage key from a URL or path
 * Handles both old local paths (upload/screenshots/xxx) and R2 URLs
 */
export function extractStorageKey(url: string): string {
  if (!url) return '';

  // If it's a full R2 public URL, extract the key after the domain
  if (R2_PUBLIC_URL && url.startsWith(R2_PUBLIC_URL)) {
    return url.replace(`${R2_PUBLIC_URL}/`, '');
  }

  // If it's a local path like "upload/screenshots/xxx.png", convert to R2 key
  if (url.startsWith('upload/')) {
    return url.replace('upload/', '');
  }

  // Already a clean key
  return url;
}

/**
 * Get the display URL for a stored file
 * Handles both old local paths and new R2 URLs
 */
export function getFileUrl(url: string): string {
  if (!url) return '';

  // If it's already a full URL (http/https), return as-is
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  // If R2 is configured and it's a local path, convert to R2 public URL
  if (isR2Configured && url.startsWith('upload/')) {
    const key = url.replace('upload/', '');
    return getPublicUrl(key);
  }

  // If it's a local path, use the API route
  if (url.startsWith('upload/screenshots/')) {
    const filename = url.replace('upload/screenshots/', '');
    return `/api/screenshots/${filename}`;
  }

  if (url.startsWith('upload/videos/')) {
    const filename = url.replace('upload/videos/', '');
    return `/${url}`;
  }

  // Fallback
  return url;
}

/**
 * Check if R2 storage is configured and available
 */
export function isStorageConfigured(): boolean {
  return isR2Configured;
}
