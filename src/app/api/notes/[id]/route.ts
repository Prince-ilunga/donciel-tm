import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { id } = await params;

    const existingNote = await db.note.findFirst({
      where: { id, userId: result.user.id },
    });

    if (!existingNote) {
      return NextResponse.json(
        { error: 'Note non trouvée' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { type, title, content, date } = body;

    if (type && !['DAY', 'WEEK', 'MONTH'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide (DAY, WEEK, MONTH)' },
        { status: 400 }
      );
    }

    const note = await db.note.update({
      where: { id },
      data: {
        ...(type && { type }),
        ...(title && { title }),
        ...(content && { content }),
        ...(date && { date: new Date(date) }),
      },
    });

    return NextResponse.json({ note });
  } catch (error) {
    console.error('Note PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de la note' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { id } = await params;

    const existingNote = await db.note.findFirst({
      where: { id, userId: result.user.id },
    });

    if (!existingNote) {
      return NextResponse.json(
        { error: 'Note non trouvée' },
        { status: 404 }
      );
    }

    await db.note.delete({ where: { id } });

    return NextResponse.json({ message: 'Note supprimée' });
  } catch (error) {
    console.error('Note DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de la note' },
      { status: 500 }
    );
  }
}
