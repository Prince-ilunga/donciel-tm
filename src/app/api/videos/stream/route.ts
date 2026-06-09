import { NextRequest, NextResponse } from 'next/server';
import { getSignedFileUrl, isStorageConfigured } from '@/lib/storage';

/**
 * Stream a video from R2 storage via signed URL redirect.
 * Used when R2 is configured and videos are stored in the cloud.
 *
 * Query params:
 * - key: The storage key (e.g., "videos/12345-abc.mp4")
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Clé de stockage requise' }, { status: 400 });
    }

    // Prevent directory traversal
    const sanitized = key.replace(/\.\./g, '').replace(/\/\//g, '/');

    if (isStorageConfigured()) {
      // Generate a signed URL for R2 (valid for 24 hours for video streaming)
      const signedUrl = await getSignedFileUrl(sanitized, 86400);
      return NextResponse.redirect(signedUrl);
    }

    return NextResponse.json({ error: 'Stockage R2 non configuré' }, { status: 503 });
  } catch (error) {
    console.error('Video stream error:', error);
    return NextResponse.json({ error: 'Erreur lors du streaming' }, { status: 500 });
  }
}
