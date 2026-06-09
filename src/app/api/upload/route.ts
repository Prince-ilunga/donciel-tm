import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { uploadFile, isStorageConfigured } from '@/lib/storage';

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
      return NextResponse.json(
        { error: 'Fichier requis' },
        { status: 400 }
      );
    }

    if (!tradeId) {
      return NextResponse.json(
        { error: 'ID du trade requis' },
        { status: 400 }
      );
    }

    if (!type || !['analysis', 'context', 'entry', 'exit'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide (context, entry, exit)' },
        { status: 400 }
      );
    }

    // Verify trade belongs to user
    const trade = await db.trade.findFirst({
      where: { id: tradeId, userId: result.user.id },
    });

    if (!trade) {
      return NextResponse.json(
        { error: 'Trade non trouvé' },
        { status: 404 }
      );
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'png';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // Determine content type
    const contentTypes: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
    };
    const contentType = contentTypes[ext.toLowerCase()] || 'image/png';

    // Read file data
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let fileUrl: string;

    if (isStorageConfigured()) {
      // Upload to Cloudflare R2
      const storageKey = `screenshots/${filename}`;
      fileUrl = await uploadFile(storageKey, buffer, contentType);
    } else {
      // Fallback: local filesystem
      const path = await import('path');
      const fs = await import('fs/promises');
      const uploadDir = path.join(process.cwd(), 'upload', 'screenshots');
      await fs.mkdir(uploadDir, { recursive: true });
      const filepath = path.join(uploadDir, filename);
      await fs.writeFile(filepath, buffer);
      fileUrl = `upload/screenshots/${filename}`;
    }

    // Save screenshot record in database
    const screenshot = await db.screenshot.create({
      data: {
        tradeId,
        type,
        url: fileUrl,
      },
    });

    return NextResponse.json({ screenshot }, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload' },
      { status: 500 }
    );
  }
}
