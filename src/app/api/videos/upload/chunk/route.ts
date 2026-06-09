import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { activeUploads } from '@/lib/upload-store';
import { uploadChunk, isStorageConfigured } from '@/lib/storage';
import path from 'path';
import fs from 'fs';

const CHUNK_DIR = path.join(process.cwd(), 'upload', 'chunks');
const MAX_CHUNK_SIZE = 15 * 1024 * 1024; // 15 MB

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const formData = await request.formData();
    const uploadId = formData.get('uploadId') as string;
    const chunkIndex = parseInt(formData.get('chunkIndex') as string, 10);
    const chunkFile = formData.get('chunk') as File | null;

    if (!uploadId || isNaN(chunkIndex) || !chunkFile) {
      return NextResponse.json({ error: 'Paramètres manquants' }, { status: 400 });
    }

    if (chunkFile.size > MAX_CHUNK_SIZE) {
      return NextResponse.json({ error: 'Chunk trop volumineux' }, { status: 413 });
    }

    const session = activeUploads.get(uploadId);
    if (!session) {
      return NextResponse.json({ error: 'Session d\'upload non trouvée' }, { status: 404 });
    }
    if (session.userId !== result.user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const buffer = Buffer.from(await chunkFile.arrayBuffer());

    if (isStorageConfigured()) {
      // Upload chunk directly to R2 as a temporary part
      const chunkKey = `chunks/${uploadId}/${chunkIndex}`;
      await uploadChunk(chunkKey, buffer, 'application/octet-stream');
    } else {
      // Fallback: write chunk to local disk
      fs.mkdirSync(CHUNK_DIR, { recursive: true });
      const chunkPath = path.join(CHUNK_DIR, `${uploadId}_${chunkIndex}`);
      fs.writeFileSync(chunkPath, buffer);
    }

    session.receivedChunks.add(chunkIndex);

    return NextResponse.json({
      received: chunkIndex,
      totalReceived: session.receivedChunks.size,
      totalChunks: session.totalChunks,
    }, { status: 200 });
  } catch (error) {
    console.error('Upload chunk error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'upload du chunk' }, { status: 500 });
  }
}
