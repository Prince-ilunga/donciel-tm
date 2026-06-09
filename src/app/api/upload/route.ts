import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadFile, isStorageConfigured } from '@/lib/storage';
import path from 'path';
import fs from 'fs';

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tradeId = formData.get('tradeId') as string | null;
    const type = formData.get('type') as string | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }
    if (!tradeId) {
      return NextResponse.json({ error: 'No tradeId provided' }, { status: 400 });
    }

    // Verify trade belongs to user
    const trade = await db.trade.findFirst({
      where: { id: tradeId, userId: result.user.id },
    });
    if (!trade) {
      return NextResponse.json({ error: 'Trade not found' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = path.extname(file.name) || (file.type?.startsWith('video/') ? '.mp4' : '.png');
    const uniqueName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`;

    // Determine content type for proper Cloudinary resource_type
    const contentType = file.type || (ext === '.mp4' || ext === '.webm' || ext === '.mov' ? 'video/mp4' : 'image/png');

    let screenshotUrl: string;

    if (isStorageConfigured()) {
      // Upload to Cloudinary
      const storageKey = `screenshots/${uniqueName.replace(ext, '')}`;
      screenshotUrl = await uploadFile(storageKey, buffer, contentType);
    } else {
      // Check if we're in a serverless environment (Vercel production)
      // In that case, local filesystem won't persist — warn the user
      const isVercel = !!process.env.VERCEL;

      if (isVercel) {
        console.error('❌ Cloudinary is NOT configured on Vercel! Screenshots will NOT persist.');
        return NextResponse.json(
          { error: 'Stockage cloud non configuré. Veuillez configurer Cloudinary (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET) dans les variables d\'environnement Vercel.' },
          { status: 503 }
        );
      }

      // Save locally (only works in local development)
      const uploadDir = path.join(process.cwd(), 'upload', 'screenshots');
      fs.mkdirSync(uploadDir, { recursive: true });
      const filePath = path.join(uploadDir, uniqueName);
      fs.writeFileSync(filePath, buffer);
      screenshotUrl = `upload/screenshots/${uniqueName}`;
    }

    // Save screenshot record in database
    const screenshot = await db.screenshot.create({
      data: {
        tradeId,
        type: type || 'analysis',
        url: screenshotUrl,
      },
    });

    return NextResponse.json({ screenshot }, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
