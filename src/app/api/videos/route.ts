import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth';
import path from 'path';
import fs from 'fs/promises';

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

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'upload', 'videos');
    await fs.mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name) || '.mp4';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await fs.writeFile(filepath, buffer);

    // Save video record
    const relativePath = `upload/videos/${filename}`;
    const video = await db.video.create({
      data: {
        category,
        title,
        description: description || null,
        url: relativePath,
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
