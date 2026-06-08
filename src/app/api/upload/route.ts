import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import path from 'path';
import fs from 'fs/promises';

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

    if (!type || !['analysis', 'entry', 'exit'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide (analysis, entry, exit)' },
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

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'upload', 'screenshots');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name) || '.png';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filepath, buffer);

    // Save screenshot record in database
    const relativePath = `upload/screenshots/${filename}`;
    const screenshot = await db.screenshot.create({
      data: {
        tradeId,
        type,
        url: relativePath,
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
