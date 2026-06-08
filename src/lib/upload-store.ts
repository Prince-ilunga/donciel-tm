/**
 * Shared upload session store for chunked video uploads.
 * Uses globalThis to ensure state is shared across all route handlers.
 */

export interface UploadSession {
  uploadId: string;
  filename: string;
  totalSize: number;
  totalChunks: number;
  category: string;
  title: string;
  description: string;
  userId: string;
  receivedChunks: Set<number>;
  createdAt: number;
}

// Use globalThis to persist across Next.js hot reloads and route handler instances
const globalForUpload = globalThis as unknown as {
  activeUploads: Map<string, UploadSession> | undefined;
};

export const activeUploads = globalForUpload.activeUploads ?? new Map<string, UploadSession>();

if (process.env.NODE_ENV !== 'production') {
  globalForUpload.activeUploads = activeUploads;
}
