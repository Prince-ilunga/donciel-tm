import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

/**
 * POST /api/upload
 * Uploads a screenshot (analysis / entry / exit / context) for a trade.
 *
 * Form data:
 *   - file:    File (image)
 *   - tradeId: string
 *   - type:    string ("analysis" | "entry" | "exit" | "context")
 *
 * Returns: { screenshot: Screenshot }
 */
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const formData = await request.formData();
    const tradeId = formData.get('tradeId') as string;
    const type = (formData.get('type') as string) || 'analysis';
    const file = formData.get('file') as File | null;

    if (!tradeId || !file) {
      return NextResponse.json(
        { error: 'tradeId et fichier requis' },
        { status: 400 }
      );
    }

    // Verify the trade belongs to the authenticated user
    const trade = await db.trade.findFirst({
      where: { id: tradeId, userId: result.user.id },
    });

    if (!trade) {
      return NextResponse.json(
        { error: 'Trade non trouvé' },
        { status: 404 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const safeName = (file.name || 'screenshot').replace(/[^a-zA-Z0-9.\-_]/g, '_');
    const key = `screenshots/${tradeId}/${type}-${Date.now()}-${safeName}`;
    const url = await uploadFile(key, buffer, file.type);

    const screenshot = await db.screenshot.create({
      data: { tradeId, type, url },
    });

    return NextResponse.json({ screenshot }, { status: 201 });
  } catch (error) {
    console.error('Screenshot upload error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de la capture" },
      { status: 500 }
    );
  }
}
