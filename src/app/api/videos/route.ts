import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth';
import { uploadFile, isStorageConfigured } from '@/lib/storage';

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

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const title = formData.get('title') as string | null;
    const category = formData.get('category') as string | null;
    const description = formData.get('description') as string | null;

    if (!file) {
      return NextResponse.json(
        { error: 'Fichier vidéo requis' },
        { status: 400 }
      );
    }

    if (!title || !category) {
      return NextResponse.json(
        { error: 'Titre et catégorie requis' },
        { status: 400 }
      );
    }

    if (!['STRUCTURE', 'BIAIS', 'ZONES', 'MODELS', 'SETUPS'].includes(category)) {
      return NextResponse.json(
        { error: 'Catégorie invalide' },
        { status: 400 }
      );
    }

    // Generate unique filename
    const ext = file.name.split('.').pop() || 'mp4';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}.${ext}`;

    // Read file data
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    let fileUrl: string;

    if (isStorageConfigured()) {
      // Upload to Cloudflare R2
      const storageKey = `videos/${filename}`;
      const contentType = ext.toLowerCase() === 'webm' ? 'video/webm' : 'video/mp4';
      fileUrl = await uploadFile(storageKey, buffer, contentType);
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
