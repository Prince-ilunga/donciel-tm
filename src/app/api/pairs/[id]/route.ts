import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, demoReadonlyGuard } from '@/lib/auth';

/**
 * DELETE /api/pairs/[id]
 * Supprime une paire personnalisée de l'utilisateur connecté.
 * Les paires par défaut (isDefault) ne peuvent pas être supprimées.
 */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Compte démo : lecture seule
    const demoGuard = demoReadonlyGuard(result.user?.email);
    if (demoGuard) return demoGuard;

    const { id } = await params;

    const pair = await db.customPair.findUnique({ where: { id } });

    if (!pair || pair.userId !== result.user.id) {
      return NextResponse.json({ error: 'Paire introuvable' }, { status: 404 });
    }

    await db.customPair.delete({ where: { id } });

    return NextResponse.json({ message: 'Paire supprimée' });
  } catch (error) {
    console.error('Pairs DELETE error:', error);
    return NextResponse.json(
      { error: "Erreur lors de la suppression de la paire" },
      { status: 500 }
    );
  }
}
