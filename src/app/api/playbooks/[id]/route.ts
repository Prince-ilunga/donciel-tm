import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

function parseJsonField(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value === 'string') return value;
  return JSON.stringify(value);
}

function serializePlaybook(playbook: Record<string, unknown>) {
  return {
    ...playbook,
    entryRules: playbook.entryRules ? JSON.parse(playbook.entryRules as string) : [],
    exitRules: playbook.exitRules ? JSON.parse(playbook.exitRules as string) : [],
    checklist: playbook.checklist ? JSON.parse(playbook.checklist as string) : [],
    tags: playbook.tags ? JSON.parse(playbook.tags as string) : [],
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { id } = await params;

    const playbook = await db.playbook.findFirst({
      where: { id, userId: result.user.id },
      include: {
        screenshots: true,
        _count: {
          select: { trades: true },
        },
      },
    });

    if (!playbook) {
      return NextResponse.json(
        { error: 'Playbook non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      playbook: {
        ...serializePlaybook(playbook),
        tradeCount: playbook._count.trades,
      },
    });
  } catch (error) {
    console.error('Playbook GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du playbook' },
      { status: 500 }
    );
  }
}

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

    const existingPlaybook = await db.playbook.findFirst({
      where: { id, userId: result.user.id },
    });

    if (!existingPlaybook) {
      return NextResponse.json(
        { error: 'Playbook non trouvé' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const {
      name,
      description,
      category,
      direction,
      marketCondition,
      session,
      timeframe,
      entryRules,
      exitRules,
      stopLossRules,
      takeProfitRules,
      riskPerTrade,
      targetRR,
      trailingStopRules,
      checklist,
      tags,
      notes,
      status,
      color,
    } = body;

    // Validate enum fields if provided
    if (category !== undefined && category !== null && !['BREAKOUT', 'RETRACE', 'TREND_FOLLOW', 'REVERSAL', 'RANGE', 'CUSTOM'].includes(category)) {
      return NextResponse.json(
        { error: 'Catégorie invalide' },
        { status: 400 }
      );
    }
    if (direction !== undefined && direction !== null && !['LONG', 'SHORT', 'BOTH'].includes(direction)) {
      return NextResponse.json(
        { error: 'Direction invalide' },
        { status: 400 }
      );
    }
    if (marketCondition !== undefined && marketCondition !== null && !['CONTINUATION', 'RETRACEMENT', 'ANY'].includes(marketCondition)) {
      return NextResponse.json(
        { error: 'Condition de marché invalide' },
        { status: 400 }
      );
    }
    if (session !== undefined && session !== null && !['LONDON', 'NEW YORK', 'ASIE', 'OVERLAP', 'ANY'].includes(session)) {
      return NextResponse.json(
        { error: 'Session invalide' },
        { status: 400 }
      );
    }
    if (timeframe !== undefined && timeframe !== null && !['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'].includes(timeframe)) {
      return NextResponse.json(
        { error: 'Timeframe invalide' },
        { status: 400 }
      );
    }
    if (status !== undefined && status !== null && !['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide' },
        { status: 400 }
      );
    }

    const playbook = await db.playbook.update({
      where: { id },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(description !== undefined && { description: description || null }),
        ...(category !== undefined && { category: category || null }),
        ...(direction !== undefined && { direction: direction || null }),
        ...(marketCondition !== undefined && { marketCondition: marketCondition || null }),
        ...(session !== undefined && { session: session || null }),
        ...(timeframe !== undefined && { timeframe: timeframe || null }),
        ...(entryRules !== undefined && { entryRules: parseJsonField(entryRules) }),
        ...(exitRules !== undefined && { exitRules: parseJsonField(exitRules) }),
        ...(stopLossRules !== undefined && { stopLossRules: stopLossRules || null }),
        ...(takeProfitRules !== undefined && { takeProfitRules: takeProfitRules || null }),
        ...(riskPerTrade !== undefined && { riskPerTrade: riskPerTrade !== null ? parseFloat(String(riskPerTrade)) : null }),
        ...(targetRR !== undefined && { targetRR: targetRR !== null ? parseFloat(String(targetRR)) : null }),
        ...(trailingStopRules !== undefined && { trailingStopRules: trailingStopRules || null }),
        ...(checklist !== undefined && { checklist: parseJsonField(checklist) }),
        ...(tags !== undefined && { tags: parseJsonField(tags) }),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status !== undefined && { status }),
        ...(color !== undefined && { color: color || null }),
      },
      include: { screenshots: true },
    });

    return NextResponse.json({ playbook: serializePlaybook(playbook) });
  } catch (error) {
    console.error('Playbook PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du playbook' },
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

    const existingPlaybook = await db.playbook.findFirst({
      where: { id, userId: result.user.id },
      include: { screenshots: true },
    });

    if (!existingPlaybook) {
      return NextResponse.json(
        { error: 'Playbook non trouvé' },
        { status: 404 }
      );
    }

    // Unlink all trades from this playbook (set playbookId to null)
    await db.trade.updateMany({
      where: { playbookId: id },
      data: { playbookId: null },
    });

    // Delete the playbook (screenshots cascade automatically)
    await db.playbook.delete({ where: { id } });

    return NextResponse.json({ message: 'Playbook supprimé' });
  } catch (error) {
    console.error('Playbook DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du playbook' },
      { status: 500 }
    );
  }
}
