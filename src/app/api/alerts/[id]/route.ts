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

    const existing = await db.alert.findFirst({
      where: { id, userId: result.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Alerte non trouvée' }, { status: 404 });
    }

    const body = await request.json();
    const alert = await db.alert.update({
      where: { id },
      data: {
        ...(body.title && { title: body.title }),
        ...(body.description !== undefined && { description: body.description }),
        ...(body.alertDate && { alertDate: new Date(body.alertDate) }),
        ...(body.triggered !== undefined && { triggered: body.triggered }),
      },
    });

    return NextResponse.json({ alert });
  } catch (error) {
    console.error('Alert PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour de l\'alerte' },
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

    const existing = await db.alert.findFirst({
      where: { id, userId: result.user.id },
    });

    if (!existing) {
      return NextResponse.json({ error: 'Alerte non trouvée' }, { status: 404 });
    }

    await db.alert.delete({ where: { id } });

    return NextResponse.json({ message: 'Alerte supprimée' });
  } catch (error) {
    console.error('Alert DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'alerte' },
      { status: 500 }
    );
  }
}
