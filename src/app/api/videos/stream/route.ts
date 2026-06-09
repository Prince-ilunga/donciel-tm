import { NextRequest, NextResponse } from 'next/server';
import { isStorageConfigured, getCloudName } from '@/lib/storage';

/**
 * Stream a video from Cloudinary.
 * When Cloudinary is configured, videos are served directly via their URLs.
 * This route is only used as a fallback for locally-stored videos.
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
      // Redirect to Cloudinary video URL
      const cloudName = getCloudName();
      // Extract public_id (remove extension)
      const publicId = sanitized.replace(/\.[^.]+$/, '');
      const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/video/upload/${publicId}`;
      return NextResponse.redirect(cloudinaryUrl);
    }

    return NextResponse.json({ error: 'Stockage cloud non configuré' }, { status: 503 });
  } catch (error) {
    console.error('Video stream error:', error);
    return NextResponse.json({ error: 'Erreur lors du streaming' }, { status: 500 });
  }
}
