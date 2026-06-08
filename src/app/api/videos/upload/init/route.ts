import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { activeUploads } from '@/lib/upload-store';
import path from 'path';
import fs from 'fs';

const CHUNK_DIR = path.join(process.cwd(), 'upload', 'chunks');
const MAX_FILE_SIZE = 500 * 1024 * 1024; // 500 MB
const VALID_CATEGORIES = ['STRUCTURE', 'BIAIS', 'ZONES', 'MODELS', 'SETUPS'];

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }
    if (!isAdmin(result.user)) {
      return NextResponse.json({ error: 'Accès réservé aux administrateurs' }, { status: 403 });
    }

    const body = await request.json();
    const { filename, totalSize, totalChunks, category, title, description } = body;

    if (!title) return NextResponse.json({ error: 'Titre requis' }, { status: 400 });
    if (!category || !VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: 'Catégorie invalide' }, { status: 400 });
    }
    if (totalSize > MAX_FILE_SIZE) {
      return NextResponse.json({ error: 'Fichier trop volumineux (max 500 Mo)' }, { status: 413 });
    }
    if (!totalChunks || totalChunks < 1) {
      return NextResponse.json({ error: 'totalChunks requis' }, { status: 400 });
    }

    fs.mkdirSync(CHUNK_DIR, { recursive: true });

    const uploadId = `${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;

    activeUploads.set(uploadId, {
      uploadId,
      filename: filename || 'video.mp4',
      totalSize,
      totalChunks,
      category,
      title,
      description: description || '',
      userId: result.user.id,
      receivedChunks: new Set(),
      createdAt: Date.now(),
    });

    // Clean up stale sessions (older than 2 hours)
    const now = Date.now();
    for (const [id, session] of activeUploads) {
      if (now - session.createdAt > 2 * 60 * 60 * 1000) {
        for (let i = 0; i < session.totalChunks; i++) {
          const chunkPath = path.join(CHUNK_DIR, `${id}_${i}`);
          try { fs.unlinkSync(chunkPath); } catch {}
        }
        activeUploads.delete(id);
      }
    }

    return NextResponse.json({ uploadId }, { status: 200 });
  } catch (error) {
    console.error('Upload init error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'initialisation' }, { status: 500 });
  }
}
