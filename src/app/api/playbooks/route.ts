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

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const where: Record<string, unknown> = {
      userId: result.user.id,
    };

    if (status && ['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)) {
      where.status = status;
    }

    const playbooks = await db.playbook.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: {
        screenshots: true,
        _count: {
          select: { trades: true },
        },
      },
    });

    const serialized = playbooks.map((pb) => ({
      ...serializePlaybook(pb),
      tradeCount: pb._count.trades,
    }));

    return NextResponse.json({ playbooks: serialized });
  } catch (error) {
    console.error('Playbooks GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des playbooks' },
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
      screenshots,
    } = body;

    if (!name || typeof name !== 'string' || name.trim() === '') {
      return NextResponse.json(
        { error: 'Le nom du playbook est requis' },
        { status: 400 }
      );
    }

    // Validate enum fields
    if (category && !['BREAKOUT', 'RETRACE', 'TREND_FOLLOW', 'REVERSAL', 'RANGE', 'CUSTOM'].includes(category)) {
      return NextResponse.json(
        { error: 'Catégorie invalide' },
        { status: 400 }
      );
    }
    if (direction && !['LONG', 'SHORT', 'BOTH'].includes(direction)) {
      return NextResponse.json(
        { error: 'Direction invalide' },
        { status: 400 }
      );
    }
    if (marketCondition && !['CONTINUATION', 'RETRACEMENT', 'ANY'].includes(marketCondition)) {
      return NextResponse.json(
        { error: 'Condition de marché invalide' },
        { status: 400 }
      );
    }
    if (session && !['LONDON', 'NEW YORK', 'ASIE', 'OVERLAP', 'ANY'].includes(session)) {
      return NextResponse.json(
        { error: 'Session invalide' },
        { status: 400 }
      );
    }
    if (timeframe && !['M1', 'M5', 'M15', 'M30', 'H1', 'H4', 'D1', 'W1'].includes(timeframe)) {
      return NextResponse.json(
        { error: 'Timeframe invalide' },
        { status: 400 }
      );
    }
    if (status && !['ACTIVE', 'PAUSED', 'ARCHIVED'].includes(status)) {
      return NextResponse.json(
        { error: 'Statut invalide' },
        { status: 400 }
      );
    }

    const playbook = await db.playbook.create({
      data: {
        userId: result.user.id,
        name: name.trim(),
        ...(description !== undefined && { description: description || null }),
        ...(category && { category }),
        ...(direction && { direction }),
        ...(marketCondition && { marketCondition }),
        ...(session && { session }),
        ...(timeframe && { timeframe }),
        entryRules: parseJsonField(entryRules),
        exitRules: parseJsonField(exitRules),
        ...(stopLossRules !== undefined && { stopLossRules: stopLossRules || null }),
        ...(takeProfitRules !== undefined && { takeProfitRules: takeProfitRules || null }),
        ...(riskPerTrade !== undefined && riskPerTrade !== null && { riskPerTrade: parseFloat(String(riskPerTrade)) }),
        ...(targetRR !== undefined && targetRR !== null && { targetRR: parseFloat(String(targetRR)) }),
        ...(trailingStopRules !== undefined && { trailingStopRules: trailingStopRules || null }),
        checklist: parseJsonField(checklist),
        tags: parseJsonField(tags),
        ...(notes !== undefined && { notes: notes || null }),
        ...(status && { status }),
        ...(color !== undefined && { color: color || null }),
        ...(screenshots &&
          Array.isArray(screenshots) &&
          screenshots.length > 0 && {
            screenshots: {
              create: screenshots.map(
                (s: { url: string; type: string; caption?: string }) => ({
                  url: s.url,
                  type: s.type,
                  ...(s.caption && { caption: s.caption }),
                })
              ),
            },
          }),
      },
      include: { screenshots: true },
    });

    return NextResponse.json({ playbook: serializePlaybook(playbook) }, { status: 201 });
  } catch (error) {
    console.error('Playbooks POST error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du playbook' },
      { status: 500 }
    );
  }
}
