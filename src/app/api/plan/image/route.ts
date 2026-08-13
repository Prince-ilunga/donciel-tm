import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { uploadFile, isStorageConfigured, getFileUrl } from '@/lib/storage';
import path from 'path';
import fs from 'fs';

export const dynamic = 'force-dynamic';

const MAX_SIZE = 8 * 1024 * 1024; // 8 MB

// ─── POST: upload an image for a plan block ──────────────────────────────
// Uses Cloudinary when configured. Otherwise writes to the local
// `upload/screenshots/` folder so the existing /api/screenshots/[filename]
// serve route can stream it back to the browser.
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }

    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier doit être une image' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image trop volumineuse (max 8 Mo)' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const ext = (file.name.split('.').pop() || 'png').toLowerCase().replace(/[^a-z0-9]/g, '') || 'png';
    const safeExt = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'].includes(ext) ? ext : 'png';
    const filename = `plan-${result.user.id.slice(-8)}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    let url: string;
    if (isStorageConfigured()) {
      url = await uploadFile(`screenshots/${filename}`, buffer, file.type);
    } else {
      // Local mode: persist to disk so /api/screenshots/[filename] can serve it.
      const dir = path.join(process.cwd(), 'upload', 'screenshots');
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, filename), buffer);
      url = getFileUrl(`upload/screenshots/${filename}`);
    }

    return NextResponse.json({ ok: true, url }, { status: 201 });
  } catch (error) {
    console.error('Plan image upload error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de l'image" },
      { status: 500 }
    );
  }
}
