import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth';
import fs from 'fs/promises';
import path from 'path';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

    const { id } = await params;

    const video = await db.video.findUnique({ where: { id } });
    if (!video) {
      return NextResponse.json(
        { error: 'Vidéo non trouvée' },
        { status: 404 }
      );
    }

    // Delete the file
    try {
      const filePath = path.join(process.cwd(), video.url);
      await fs.unlink(filePath).catch(() => {});
    } catch {
      // Ignore file deletion errors
    }

    await db.video.delete({ where: { id } });

    return NextResponse.json({ message: 'Vidéo supprimée' });
  } catch (error) {
    console.error('Video DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la vidéo' },
      { status: 500 }
    );
  }
}
