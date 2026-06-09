import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
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

    // Load session from database
    const session = await db.uploadSession.findUnique({
      where: { uploadId },
    });

    if (!session) {
      return NextResponse.json({ error: 'Session d\'upload non trouvée' }, { status: 404 });
    }
    if (session.userId !== result.user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const buffer = Buffer.from(await chunkFile.arrayBuffer());

    // Store chunks locally (for both Cloudinary and local modes)
    // Cloudinary doesn't support chunked uploads — we assemble on the complete route
    fs.mkdirSync(CHUNK_DIR, { recursive: true });
    const chunkFilename = `chunks_${uploadId}_${chunkIndex}`;
    const chunkPath = path.join(CHUNK_DIR, chunkFilename);
    fs.writeFileSync(chunkPath, buffer);

    // Update received chunks in database
    const receivedChunks: number[] = JSON.parse(session.receivedChunks);
    if (!receivedChunks.includes(chunkIndex)) {
      receivedChunks.push(chunkIndex);
    }
    await db.uploadSession.update({
      where: { uploadId },
      data: { receivedChunks: JSON.stringify(receivedChunks) },
    });

    return NextResponse.json({
      received: chunkIndex,
      totalReceived: receivedChunks.length,
      totalChunks: session.totalChunks,
    }, { status: 200 });
  } catch (error) {
    console.error('Upload chunk error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'upload du chunk' }, { status: 500 });
  }
}
