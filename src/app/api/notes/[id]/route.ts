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
    const {
      type, title, content, date,
      mood, confidence, marketBias, tags, checklist,
      priority, pinned, plan, observation, rules,
    } = body;

    if (type && !['DAY', 'WEEK', 'MONTH'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide (DAY, WEEK, MONTH)' },
        { status: 400 }
      );
    }

    const updateData: Record<string, unknown> = {};
    if (type !== undefined) updateData.type = type;
    if (title !== undefined) updateData.title = title;
    if (content !== undefined) updateData.content = content;
    if (date !== undefined) updateData.date = new Date(date);
    if (mood !== undefined) updateData.mood = mood || null;
    if (confidence !== undefined) updateData.confidence = confidence != null ? Number(confidence) : null;
    if (marketBias !== undefined) updateData.marketBias = marketBias || null;
    if (tags !== undefined) updateData.tags = tags ? (typeof tags === 'string' ? tags : JSON.stringify(tags)) : null;
    if (checklist !== undefined) updateData.checklist = checklist ? (typeof checklist === 'string' ? checklist : JSON.stringify(checklist)) : null;
    if (priority !== undefined) updateData.priority = priority || null;
    if (pinned !== undefined) updateData.pinned = Boolean(pinned);
    if (plan !== undefined) updateData.plan = plan || null;
    if (observation !== undefined) updateData.observation = observation || null;
    if (rules !== undefined) updateData.rules = rules || null;

    const note = await db.note.update({
      where: { id },
      data: updateData,
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
