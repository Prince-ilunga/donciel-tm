import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

// ─────────────────────────────────────────────────────────────
// Risk profile API (Pack 3 — Discipline & Risque)
//  GET  → { profile }  (null si non configuré)
//  PUT  → upsert du profil (validation zod stricte) → { profile }
// ─────────────────────────────────────────────────────────────

const riskProfileSchema = z.object({
  initialCapital: z
    .number({ message: 'Le capital initial doit être un nombre' })
    .positive('Le capital initial doit être supérieur à 0')
    .max(1_000_000_000, 'Le capital initial semble invalide'),
  currency: z.enum(['USD', 'EUR']).default('USD'),
  riskPerTradePct: z
    .number({ message: 'Le risque par trade doit être un nombre' })
    .min(0.1, 'Le risque par trade doit être entre 0.1 et 10 %')
    .max(10, 'Le risque par trade doit être entre 0.1 et 10 %'),
  maxDailyLossPct: z
    .number({ message: 'La perte quotidienne max doit être un nombre' })
    .min(0.5, 'La perte quotidienne max doit être entre 0.5 et 50 %')
    .max(50, 'La perte quotidienne max doit être entre 0.5 et 50 %'),
  maxWeeklyLossPct: z
    .number({ message: 'La perte hebdomadaire max doit être un nombre' })
    .min(0.5, 'La perte hebdomadaire max doit être entre 0.5 et 50 %')
    .max(50, 'La perte hebdomadaire max doit être entre 0.5 et 50 %'),
  maxTradesPerDay: z
    .number({ message: 'Le nombre max de trades par jour doit être un nombre' })
    .int('Le nombre max de trades par jour doit être un entier')
    .min(1, 'Le nombre max de trades par jour doit être entre 1 et 100')
    .max(100, 'Le nombre max de trades par jour doit être entre 1 et 100')
    .nullable(),
});

export async function GET() {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }
    const userId = result.user.id;

    const profile = await db.riskProfile.findUnique({
      where: { userId },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('RiskProfile GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du profil de risque' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
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

    const parsed = riskProfileSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        { error: firstIssue?.message || 'Données de profil invalides' },
        { status: 400 }
      );
    }

    const data = parsed.data;

    const profile = await db.riskProfile.upsert({
      where: { userId },
      create: {
        userId,
        initialCapital: data.initialCapital,
        currency: data.currency,
        riskPerTradePct: data.riskPerTradePct,
        maxDailyLossPct: data.maxDailyLossPct,
        maxWeeklyLossPct: data.maxWeeklyLossPct,
        maxTradesPerDay: data.maxTradesPerDay,
      },
      update: {
        initialCapital: data.initialCapital,
        currency: data.currency,
        riskPerTradePct: data.riskPerTradePct,
        maxDailyLossPct: data.maxDailyLossPct,
        maxWeeklyLossPct: data.maxWeeklyLossPct,
        maxTradesPerDay: data.maxTradesPerDay,
      },
    });

    return NextResponse.json({ profile });
  } catch (error) {
    console.error('RiskProfile PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'enregistrement du profil de risque' },
      { status: 500 }
    );
  }
}
