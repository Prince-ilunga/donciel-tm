import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, isAdmin } from '@/lib/auth';

/**
 * DELETE /api/trades/clear - Delete ALL trades (and their screenshots via cascade)
 * Admin only endpoint
 */
export async function DELETE(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    // Only admins can clear all trades
    if (!isAdmin(result.user)) {
      return NextResponse.json(
        { error: 'Accès réservé aux administrateurs' },
        { status: 403 }
      );
    }

    // Delete all screenshots first (in case cascade doesn't work on the deployment DB)
    const deletedScreenshots = await db.screenshot.deleteMany({});

    // Delete all trades
    const deletedTrades = await db.trade.deleteMany({});

    return NextResponse.json({
      message: 'Tous les trades ont été supprimés',
      deletedTrades: deletedTrades.count,
      deletedScreenshots: deletedScreenshots.count,
    });
  } catch (error) {
    console.error('Clear trades error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression des trades' },
      { status: 500 }
    );
  }
}
