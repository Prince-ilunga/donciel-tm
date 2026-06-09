import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';
import { isStorageConfigured, getCloudName } from '@/lib/storage';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Prevent directory traversal
    const sanitized = filename.replace(/\.\./g, '').replace(/\//g, '');

    // Check if this looks like a video file
    const isVideo = /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(sanitized);

    // Check local filesystem first (works for locally stored screenshots)
    const localPath = path.join(process.cwd(), 'upload', 'screenshots', sanitized);

    if (fs.existsSync(localPath)) {
      const buffer = fs.readFileSync(localPath);

      const ext = path.extname(sanitized).toLowerCase();
      const contentTypes: Record<string, string> = {
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
        '.webp': 'image/webp',
        '.bmp': 'image/bmp',
        '.mp4': 'video/mp4',
        '.webm': 'video/webm',
        '.mov': 'video/quicktime',
        '.avi': 'video/x-msvideo',
      };
      const contentType = contentTypes[ext] || (isVideo ? 'video/mp4' : 'image/png');

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=31536000, immutable',
        },
      });
    }

    // If local file not found and Cloudinary is configured, redirect to Cloudinary URL
    if (isStorageConfigured()) {
      const cloudName = getCloudName();
      // Remove extension for public_id
      const publicId = sanitized.replace(/\.[^.]+$/, '');
      const resourceType = isVideo ? 'video' : 'image';
      const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/${resourceType}/upload/screenshots/${publicId}`;
      return NextResponse.redirect(cloudinaryUrl);
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  } catch (error) {
    console.error('Screenshot serve error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
