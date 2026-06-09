import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    const where: Record<string, unknown> = {
      userId: result.user.id,
    };

    if (type && ['DAY', 'WEEK', 'MONTH'].includes(type)) {
      where.type = type;
    }

    const notes = await db.note.findMany({
      where,
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ notes });
  } catch (error) {
    console.error('Notes GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des notes' },
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

    const body = await request.json();
    const { type, title, content, date } = body;

    if (!type || !title || !content || !date) {
      return NextResponse.json(
        { error: 'Type, titre, contenu et date requis' },
        { status: 400 }
      );
    }

    if (!['DAY', 'WEEK', 'MONTH'].includes(type)) {
      return NextResponse.json(
        { error: 'Type invalide (DAY, WEEK, MONTH)' },
        { status: 400 }
      );
    }

    const note = await db.note.create({
      data: {
        userId: result.user.id,
        type,
        title,
        content,
        date: new Date(date),
      },
    });

    return NextResponse.json({ note }, { status: 201 });
  } catch (error) {
    console.error('Notes POST error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de la note' },
      { status: 500 }
    );
  }
}
