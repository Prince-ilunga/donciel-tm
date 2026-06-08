import { NextRequest, NextResponse } from 'next/server';
import path from 'path';
import fs from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;

    // Prevent directory traversal
    const sanitized = filename.replace(/\.\./g, '').replace(/\//g, '');
    const filepath = path.join(process.cwd(), 'upload', 'screenshots', sanitized);

    // Check file exists
    if (!fs.existsSync(filepath)) {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    // Read file
    const buffer = fs.readFileSync(filepath);

    // Determine content type
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
  } catch (error) {
    console.error('Screenshot serve error:', error);
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}
