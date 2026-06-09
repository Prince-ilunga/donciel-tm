import { NextRequest, NextResponse } from 'next/server';
import { getAuthUser } from '@/lib/auth';
import { db } from '@/lib/db';
import { uploadFile, isStorageConfigured } from '@/lib/storage';
import { v2 as cloudinary } from 'cloudinary';
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

    // Verify all chunks received
    const receivedChunks: number[] = JSON.parse(session.receivedChunks);
    if (receivedChunks.length !== session.totalChunks) {
      const missing = [];
      for (let i = 0; i < session.totalChunks; i++) {
        if (!receivedChunks.includes(i)) missing.push(i);
      }
      return NextResponse.json({
        error: `Chunks manquants: ${missing.join(', ')}`,
        missingChunks: missing,
      }, { status: 400 });
    }

    // Generate unique filename
    const ext = path.extname(session.filename) || '.mp4';
    const uniqueName = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;

    let fileUrl: string;

    if (isStorageConfigured()) {
      // ─── Cloud Mode: Assemble chunks and upload to Cloudinary ───
      const chunks: Buffer[] = [];

      for (let i = 0; i < session.totalChunks; i++) {
        // Chunks were stored locally by uploadChunk()
        const chunkFilename = `chunks_${uploadId}_${i}`;
        const chunkPath = path.join(CHUNK_DIR, chunkFilename);

        if (fs.existsSync(chunkPath)) {
          const chunkData = fs.readFileSync(chunkPath);
          chunks.push(chunkData);
          // Clean up chunk file
          try { fs.unlinkSync(chunkPath); } catch {}
        }
      }

      // Combine all chunks
      const finalBuffer = Buffer.concat(chunks);

      // Upload to Cloudinary as video
      const contentType = ext.toLowerCase() === '.webm' ? 'video/webm' : 'video/mp4';
      fileUrl = await uploadFile(`videos/${uniqueName}`, finalBuffer, contentType);
    } else {
      // ─── Local Mode: Assemble chunks from disk ───
      fs.mkdirSync(UPLOAD_DIR, { recursive: true });
      const finalPath = path.join(UPLOAD_DIR, uniqueName);
      const writeStream = fs.createWriteStream(finalPath);

      for (let i = 0; i < session.totalChunks; i++) {
        const chunkFilename = `chunks_${uploadId}_${i}`;
        const chunkPath = path.join(CHUNK_DIR, chunkFilename);

        if (fs.existsSync(chunkPath)) {
          const chunkData = fs.readFileSync(chunkPath);
          writeStream.write(chunkData);
          try { fs.unlinkSync(chunkPath); } catch {}
        }
      }

      await new Promise<void>((resolve, reject) => {
        writeStream.end();
        writeStream.on('finish', resolve);
        writeStream.on('error', reject);
      });

      fileUrl = `upload/videos/${uniqueName}`;
    }

    // Save video record in database
    const video = await db.video.create({
      data: {
        category: session.category,
        title: session.title,
        description: session.description || null,
        url: fileUrl,
        uploadedBy: session.userId,
      },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    // Clean up session from database
    await db.uploadSession.delete({
      where: { uploadId },
    });

    console.log(`[upload] Video saved: ${uniqueName} (${(session.totalSize / 1024 / 1024).toFixed(1)} MB) → ${isStorageConfigured() ? 'cloud' : 'local'}`);

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error('Upload complete error:', error);
    return NextResponse.json({ error: 'Erreur lors de la finalisation' }, { status: 500 });
  }
}
