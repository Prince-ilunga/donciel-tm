import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthUser, demoReadonlyGuard } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────
// Goals API (Pack 3 — Discipline & Risque)
//  GET    ?period=YYYY-MM → { goals }   (tous si period absent)
//  POST   { period, metric, target } → upsert (unique user+period+metric) → { goal, created }
//  DELETE ?id=&archive=true → archive (status ARCHIVED) sinon suppression → { success }
// ─────────────────────────────────────────────────────────────

const GOAL_METRICS = [
  'RR_TOTAL',
  'WIN_RATE',
  'PROFIT_FACTOR',
  'NET_PNL',
  'TRADES_COUNT',
  'DISCIPLINE_SCORE',
] as const;

const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;

const goalCreateSchema = z.object({
  period: z
    .string({ message: 'La période est requise' })
    .regex(PERIOD_REGEX, 'Période invalide (format attendu : YYYY-MM)'),
  metric: z.enum(GOAL_METRICS, { message: 'Métrique invalide' }),
  target: z
    .number({ message: 'La cible doit être un nombre' })
    .positive('La cible doit être supérieure à 0')
    .max(1_000_000, 'La cible semble invalide'),
});

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }
    // Compte démo : lecture seule
    const demoGuard = demoReadonlyGuard(result.user?.email);
    if (demoGuard) return demoGuard;
    const userId = result.user.id;

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period');

    const where: Record<string, unknown> = { userId };
    if (period && PERIOD_REGEX.test(period)) {
      where.period = period;
    }

    const goals = await db.goal.findMany({
      where,
      orderBy: [{ period: 'desc' }, { createdAt: 'desc' }],
    });

    return NextResponse.json({ goals });
  } catch (error) {
    console.error('Goals GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des objectifs' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }
    const userId = result.user.id;

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corps de requête invalide' }, { status: 400 });
    }

    const parsed = goalCreateSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Données d\'objectif invalides' },
        { status: 400 }
      );
    }

    const { period, metric, target } = parsed.data;

    // Upsert : un seul objectif par (user, période, métrique)
    const existing = await db.goal.findUnique({
      where: {
        userId_period_metric: {
          userId,
          period,
          metric,
        },
      },
    });

    const goal = await db.goal.upsert({
      where: {
        userId_period_metric: {
          userId,
          period,
          metric,
        },
      },
      create: { userId, period, metric, target },
      update: { target, status: 'ACTIVE' },
    });

    return NextResponse.json({ goal, created: !existing });
  } catch (error) {
    console.error('Goals POST error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement de l\'objectif' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }
    const userId = result.user.id;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const archive = searchParams.get('archive') === 'true';

    if (!id) {
      return NextResponse.json({ error: 'Paramètre id manquant' }, { status: 400 });
    }

    // Ownership : l'objectif doit appartenir à l'utilisateur connecté
    const goal = await db.goal.findFirst({
      where: { id, userId },
    });
    if (!goal) {
      return NextResponse.json({ error: 'Objectif introuvable' }, { status: 404 });
    }

    if (archive) {
      const archived = await db.goal.update({
        where: { id: goal.id },
        data: { status: 'ARCHIVED' },
      });
      return NextResponse.json({ success: true, archived: true, goal: archived });
    }

    await db.goal.delete({ where: { id: goal.id } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Goals DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression de l\'objectif' },
      { status: 500 }
    );
  }
}
