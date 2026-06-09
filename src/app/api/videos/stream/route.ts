import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { isStorageConfigured, getCloudName } from '@/lib/storage';

/**
 * Stream a video from Cloudinary or local filesystem.
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

    // Try local filesystem first
    const localPath = path.join(process.cwd(), 'upload', sanitized);

    if (fs.existsSync(localPath)) {
      const stat = fs.statSync(localPath);
      const ext = path.extname(localPath).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
      };
      const contentType = contentTypes[ext] || 'video/mp4';

      // Support range requests for video streaming
      const range = request.headers.get('range');
      if (range) {
        const bytes = range.replace(/bytes=/, '').split('-');
        const start = parseInt(bytes[0], 10);
        const end = bytes[1] ? parseInt(bytes[1], 10) : stat.size - 1;
        const chunkSize = end - start + 1;
        const buffer = Buffer.alloc(chunkSize);
        const fd = fs.openSync(localPath, 'r');
        fs.readSync(fd, buffer, 0, chunkSize, start);
        fs.closeSync(fd);

        return new NextResponse(buffer, {
          status: 206,
          headers: {
            'Content-Range': `bytes ${start}-${end}/${stat.size}`,
            'Accept-Ranges': 'bytes',
            'Content-Length': chunkSize.toString(),
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
        });
      }

      const buffer = fs.readFileSync(localPath);
      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Content-Length': stat.size.toString(),
          'Accept-Ranges': 'bytes',
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // If local file not found and Cloudinary is configured, redirect to Cloudinary URL
    if (isStorageConfigured()) {
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
