import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin, demoReadonlyGuard } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

const MAX_IMAGE_SIZE = 8 * 1024 * 1024; // 8 Mo
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // 50 Mo
const IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'];
const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'm4v'];
const ALLOWED_TYPES = ['analysis', 'entry', 'exit', 'context'];

/**
 * POST /api/upload — Upload d'une capture (image/vidéo) attachée à un trade.
 * FormData : file, tradeId, type ("analysis" | "entry" | "exit" | "context")
 * Stockage : Cloudinary si configuré, sinon disque local (upload/screenshots/).
 * Crée l'enregistrement Screenshot lié au trade.
 */
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }
    // Compte démo : lecture seule
    const demoGuard = demoReadonlyGuard(result.user?.email);
    if (demoGuard) return demoGuard;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const tradeId = formData.get('tradeId') as string | null;
    const type = (formData.get('type') as string | null) || 'analysis';

    if (!file) {
      return NextResponse.json({ error: 'Fichier requis' }, { status: 400 });
    }
    if (!tradeId) {
      return NextResponse.json({ error: 'tradeId requis' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(type)) {
      return NextResponse.json(
        { error: `Type invalide (autorisés : ${ALLOWED_TYPES.join(', ')})` },
        { status: 400 }
      );
    }

    // Le trade doit exister et appartenir à l'utilisateur (l'admin peut tout modifier)
    const trade = await db.trade.findFirst({
      where: isAdmin(result.user) ? { id: tradeId } : { id: tradeId, userId: result.user.id },
      select: { id: true },
    });
    if (!trade) {
      return NextResponse.json({ error: 'Trade non trouvé' }, { status: 404 });
    }

    const isVideo = file.type.startsWith('video/');
    if (!file.type.startsWith('image/') && !isVideo) {
      return NextResponse.json(
        { error: 'Le fichier doit être une image ou une vidéo' },
        { status: 400 }
      );
    }
    const maxSize = isVideo ? MAX_VIDEO_SIZE : MAX_IMAGE_SIZE;
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: `Fichier trop volumineux (max ${Math.round(maxSize / (1024 * 1024))} Mo)` },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawExt = (file.name.split('.').pop() || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const safeExt = isVideo
      ? (VIDEO_EXTENSIONS.includes(rawExt) ? rawExt : 'mp4')
      : (IMAGE_EXTENSIONS.includes(rawExt) ? rawExt : 'png');
    const filename = `trade-${tradeId.slice(-8)}-${type}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${safeExt}`;

    const url = await uploadFile(`screenshots/${filename}`, buffer, file.type || (isVideo ? 'video/mp4' : 'image/png'));

    const screenshot = await db.screenshot.create({
      data: {
        tradeId,
        type: type === 'context' ? 'analysis' : type,
        url,
      },
    });

    return NextResponse.json({ ok: true, screenshot }, { status: 201 });
  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'upload de la capture" },
      { status: 500 }
    );
  }
}
