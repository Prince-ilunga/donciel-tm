import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET() {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const alerts = await db.alert.findMany({
      where: { userId: result.user.id },
      orderBy: { alertDate: 'asc' },
    });

    return NextResponse.json({ alerts });
  } catch (error) {
    console.error('Alerts GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des alertes' },
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
    const { title, description, alertDate, noteId } = body;

    if (!title || !alertDate) {
      return NextResponse.json(
        { error: 'Titre et date requis' },
        { status: 400 }
      );
    }

    // Try to create with noteId; fall back without it if column doesn't exist yet
    let alert;
    try {
      alert = await db.alert.create({
        data: {
          userId: result.user.id,
          title,
          description: description || null,
          alertDate: new Date(alertDate),
          ...(noteId && { noteId }),
        },
      });
    } catch {
      // Fallback: noteId column may not exist yet (pending prisma db push)
      alert = await db.alert.create({
        data: {
          userId: result.user.id,
          title,
          description: description || null,
          alertDate: new Date(alertDate),
        },
      });
    }

    return NextResponse.json({ alert }, { status: 201 });
  } catch (error) {
    console.error('Alerts POST error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création de l\'alerte' },
      { status: 500 }
    );
  }
}
