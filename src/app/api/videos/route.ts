import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { uploadFile, isStorageConfigured } from '@/lib/storage';

// Allow large video uploads (up to 500MB)
export const maxDuration = 300; // 5 minutes timeout for Vercel
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const where: Record<string, unknown> = {};
    if (category && ['STRUCTURE', 'BIAIS', 'ZONES', 'MODELS', 'SETUPS'].includes(category)) {
      where.category = category;
    }

    const videos = await db.video.findMany({
      where,
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ videos });
  } catch (error) {
    console.error('Videos GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des vidéos' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    if (!isAdmin(result.user)) {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    const contentType = request.headers.get('content-type') || '';

    let title: string | null = null;
    let category: string | null = null;
    let description: string | null = null;
    let fileUrl: string | null = null;

    if (contentType.includes('application/json')) {
      // JSON body: client already uploaded to Cloudinary, just save the record
      const body = await request.json();
      title = body.title;
      category = body.category;
      description = body.description || null;
      fileUrl = body.url;
    } else {
      // FormData: server-side upload (fallback for local storage)
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      title = formData.get('title') as string | null;
      category = formData.get('category') as string | null;
      description = formData.get('description') as string | null;

      if (!file) {
        return NextResponse.json(
          { error: 'Fichier vidéo requis' },
          { status: 400 }
        );
      }

      // Generate unique filename
      const ext = file.name.split('.').pop() || 'mp4';
      const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

      // Read file data
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);

      if (isStorageConfigured()) {
        const storageKey = `videos/${filename}`;
        const mimeType = ext.toLowerCase() === 'webm' ? 'video/webm' : 'video/mp4';
        fileUrl = await uploadFile(storageKey, buffer, mimeType);
      } else {
        // Fallback: local filesystem
        const path = await import('path');
        const fs = await import('fs/promises');
        const uploadDir = path.join(process.cwd(), 'upload', 'videos');
        await fs.mkdir(uploadDir, { recursive: true });
        const filepath = path.join(uploadDir, filename);
        await fs.writeFile(filepath, buffer);
        fileUrl = `upload/videos/${filename}`;
      }
    }

    if (!title || !category) {
      return NextResponse.json(
        { error: 'Titre et catégorie requis' },
        { status: 400 }
      );
    }

    if (!fileUrl) {
      return NextResponse.json(
        { error: 'URL du fichier requise' },
        { status: 400 }
      );
    }

    if (!['STRUCTURE', 'BIAIS', 'ZONES', 'MODELS', 'SETUPS'].includes(category)) {
      return NextResponse.json(
        { error: 'Catégorie invalide' },
        { status: 400 }
      );
    }

    // Save video record
    const video = await db.video.create({
      data: {
        category,
        title,
        description: description || null,
        url: fileUrl,
        uploadedBy: result.user.id,
      },
      include: {
        uploader: {
          select: { id: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({ video }, { status: 201 });
  } catch (error) {
    console.error('Video POST error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload de la vidéo' },
      { status: 500 }
    );
  }
}
