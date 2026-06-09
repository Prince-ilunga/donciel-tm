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
      };
      const contentType = contentTypes[ext] || 'image/png';

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
      const cloudinaryUrl = `https://res.cloudinary.com/${cloudName}/image/upload/screenshots/${publicId}`;
      return NextResponse.redirect(cloudinaryUrl);
    }

    return NextResponse.json({ error: 'File not found' }, { status: 404 });
  } catch (error) {
    console.error('Screenshot serve error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
