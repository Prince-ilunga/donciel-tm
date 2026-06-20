import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadFile, isStorageConfigured } from '@/lib/storage';
import path from 'path';
import fs from 'fs';

/**
 * Upload a trade screenshot.
 *
 * Used by the "Saisie des trades" dialog (Setup tab) to attach context/entry/exit
 * screenshots to a trade.
 *
 * Accepts multipart/form-data with:
 *   - file:    the image file (required)
 *   - tradeId: the trade to attach the screenshot to (required)
 *   - type:    one of "context" | "entry" | "exit" (required)
 *
 * Storage strategy:
 *   - When Cloudinary is configured, the file is uploaded to Cloudinary and the
 *     returned secure_url is stored in the DB.
 *   - When Cloudinary is NOT configured (local dev), the file is written to
 *     `upload/screenshots/<filename>` and the stored URL is
 *     `upload/screenshots/<filename>` so the existing `/api/screenshots/[filename]`
 *     route can serve it.
 */
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const formData = await request.formData();
    const tradeId = formData.get('tradeId') as string | null;
    const type = formData.get('type') as string | null;
    const file = formData.get('file') as File | null;

    if (!tradeId || !file || !type) {
      return NextResponse.json(
        { error: 'tradeId, type et fichier requis' },
        { status: 400 }
      );
    }

    // Verify the trade belongs to the authenticated user
    const trade = await db.trade.findFirst({
      where: { id: tradeId, userId: result.user.id },
    });

    if (!trade) {
      return NextResponse.json({ error: 'Trade non trouvé' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Build a filesystem-safe filename: <tradeId>-<type>-<timestamp><ext>
    const ext = path.extname(file.name || '') || '';
    const safeExt = ext.replace(/[^a-zA-Z0-9.]/g, '');
    const filename = `${tradeId}-${type}-${Date.now()}${safeExt}`;
    const storageKey = `screenshots/${filename}`;

    let storedUrl: string;

    if (isStorageConfigured()) {
      // Cloudinary mode — uploadFile returns the full secure_url
      storedUrl = await uploadFile(storageKey, buffer, file.type || 'image/png');
    } else {
      // Local mode — persist to upload/screenshots/ so /api/screenshots/[filename] serves it
      const screenshotsDir = path.join(process.cwd(), 'upload', 'screenshots');
      fs.mkdirSync(screenshotsDir, { recursive: true });
      const localPath = path.join(screenshotsDir, filename);
      fs.writeFileSync(localPath, buffer);
      // Store as upload/screenshots/<filename> — matches what /api/screenshots/[filename] expects
      storedUrl = `upload/screenshots/${filename}`;
    }

    const screenshot = await db.screenshot.create({
      data: { tradeId, type, url: storedUrl },
    });

    return NextResponse.json({ screenshot }, { status: 201 });
  } catch (error) {
    console.error('Trade screenshot upload error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de la capture" },
      { status: 500 }
    );
  }
}
