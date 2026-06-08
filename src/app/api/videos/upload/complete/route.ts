import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { activeUploads } from '@/lib/upload-store';
import path from 'path';
import fs from 'fs';

const CHUNK_DIR = path.join(process.cwd(), 'upload', 'chunks');
const UPLOAD_DIR = path.join(process.cwd(), 'upload', 'videos');

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const body = await request.json();
    const { uploadId } = body;
    if (!uploadId) {
      return NextResponse.json({ error: 'uploadId requis' }, { status: 400 });
    }

    const session = activeUploads.get(uploadId);
    if (!session) {
      return NextResponse.json({ error: 'Session d\'upload non trouvée' }, { status: 404 });
    }
    if (session.userId !== result.user.id) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Verify all chunks received
    if (session.receivedChunks.size !== session.totalChunks) {
      const missing = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!session.receivedChunks.has(i)) missing.push(i);
      }
      return NextResponse.json({
        error: `Chunks manquants: ${missing.join(', ')}`,
        missingChunks: missing,
      }, { status: 400 });
    }

    // Assemble chunks into final file
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    const ext = path.extname(session.filename) || '.mp4';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const finalPath = path.join(UPLOAD_DIR, uniqueName);

    const writeStream = fs.createWriteStream(finalPath);
    for (let i = 0; i < session.totalChunks; i++) {
      const chunkPath = path.join(CHUNK_DIR, `${uploadId}_${i}`);
      const chunkData = fs.readFileSync(chunkPath);
      writeStream.write(chunkData);
      try { fs.unlinkSync(chunkPath); } catch {}
    }

    await new Promise<void>((resolve, reject) => {
      writeStream.end();
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    // Save video record in database
    const relativePath = `upload/videos/${uniqueName}`;
    const video = await db.video.create({
      data: {
        category: session.category,
        title: session.title,
        description: session.description || null,
        url: relativePath,
        uploadedBy: session.userId,
      },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Clean up session
    activeUploads.delete(uploadId);

    console.log(`[chunked-upload] Video assembled: ${uniqueName} (${(session.totalSize / 1024 / 1024).toFixed(1)} MB)`);

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error('Upload complete error:', error);
    return NextResponse.json({ error: 'Erreur lors de la finalisation' }, { status: 500 });
  }
}
