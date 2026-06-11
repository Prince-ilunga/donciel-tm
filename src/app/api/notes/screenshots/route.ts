import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { uploadFile } from '@/lib/storage';

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const formData = await request.formData();
    const noteId = formData.get('noteId') as string;
    const file = formData.get('file') as File | null;

    if (!noteId || !file) {
      return NextResponse.json({ error: 'noteId et fichier requis' }, { status: 400 });
    }

    // Verify note belongs to user
    const note = await db.note.findFirst({
      where: { id: noteId, userId: result.user.id },
    });

    if (!note) {
      return NextResponse.json({ error: 'Note non trouvée' }, { status: 404 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const key = `note-screenshots/${noteId}/${Date.now()}-${file.name}`;
    const url = await uploadFile(key, buffer, file.type);

    const screenshot = await db.noteScreenshot.create({
      data: { noteId, url },
    });

    return NextResponse.json({ screenshot }, { status: 201 });
  } catch (error) {
    console.error('Note screenshot upload error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'upload de la capture' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const screenshotId = searchParams.get('screenshotId');

    if (!screenshotId) {
      return NextResponse.json({ error: 'screenshotId requis' }, { status: 400 });
    }

    // Verify screenshot belongs to user's note
    const screenshot = await db.noteScreenshot.findFirst({
      where: { id: screenshotId, note: { userId: result.user.id } },
    });

    if (!screenshot) {
      return NextResponse.json({ error: 'Capture non trouvée' }, { status: 404 });
    }

    await db.noteScreenshot.delete({ where: { id: screenshotId } });

    return NextResponse.json({ message: 'Capture supprimée' });
  } catch (error) {
    console.error('Note screenshot delete error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la capture' },
      { status: 500 }
    );
  }
}
