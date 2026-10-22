import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createToken, setAuthCookie, isSecureRequest } from '@/lib/auth';
import { DEMO_EMAIL, DEMO_NAME, DEMO_TRADES } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';

// Rate limiting simple en mémoire (IP → timestamps)
const attempts = new Map<string, number[]>();
const MAX_ATTEMPTS = 10;
const WINDOW_MS = 60 * 60 * 1000; // 1h

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const list = (attempts.get(ip) || []).filter((t) => now - t < WINDOW_MS);
  list.push(now);
  attempts.set(ip, list);
  return list.length > MAX_ATTEMPTS;
}

/**
 * POST /api/demo/login
 * Connecte (ou crée) le compte démo public et le peuple avec un
 * jeu de données réaliste. Lecture seule garantie côté API.
 */
export async function POST(request: NextRequest) {
  try {
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown';

    if (rateLimited(ip)) {
      return NextResponse.json(
        { error: 'Trop de tentatives. Réessaie dans une heure.' },
        { status: 429 }
      );
    }

    // ─── Trouver ou créer le compte démo ───
    let demo = await db.user.findUnique({ where: { email: DEMO_EMAIL } });

    if (!demo) {
      // Mot de passe aléatoire inconnu de tous (le compte n'est
      // accessible QUE via cette route)
      const randomPassword =
        Math.random().toString(36).slice(2) +
        Math.random().toString(36).slice(2) +
        Date.now().toString(36);
      const { hashPassword } = await import('@/lib/auth');
      demo = await db.user.create({
        data: {
          email: DEMO_EMAIL,
          password: await hashPassword(randomPassword),
          name: DEMO_NAME,
          role: 'user',
          status: 'approved',
          language: 'fr',
          plan: 'PRO', // débloque l'affichage des stats avancées en démo
          planStatus: 'active',
        },
      });
    }

    // ─── Peupler les trades si le compte est vide ───
    const existingTrades = await db.trade.count({
      where: { userId: demo.id },
    });

    if (existingTrades === 0) {
      for (const t of DEMO_TRADES) {
        const created = await db.trade.create({
          data: {
            userId: demo.id,
            date: new Date(t.date),
            pair: t.pair,
            direction: t.direction,
            session: t.session || 'LONDON',
            marketCondition: t.marketCondition || 'CONTINUATION',
            timeframe: t.timeframe || 'M15',
            setup: t.setup,
            entryModel: t.entryModel,
            structure: t.structure,
            confluence: t.confluence,
            entryPrice: t.entryPrice ?? 0,
            stopLoss: t.stopLoss ?? 0,
            takeProfit: t.takeProfit ?? 0,
            exitPrice: t.exitPrice,
            entryTime: t.entryTime,
            exitTime: t.exitTime,
            duration: t.duration,
            lotSize: t.lotSize,
            rr: t.rr,
            pnl: t.pnl,
            result: t.result,
            newsEnabled: t.newsEnabled,
            emotions: t.emotions,
            mistakes: t.mistakes,
            lessons: t.lessons,
            notes: t.notes,
            importSource: 'MANUAL',
          },
        });
        for (const s of t.screenshots || []) {
          await db.screenshot.create({
            data: { tradeId: created.id, type: s.type, url: s.url },
          });
        }
      }
    }

    // ─── Session (même mécanique que /api/auth/login) ───
    const token = await createToken({
      id: demo.id,
      email: demo.email,
      role: demo.role,
    });

    const response = NextResponse.json({
      message: 'Mode démo activé',
      user: {
        id: demo.id,
        email: demo.email,
        name: demo.name,
        role: demo.role,
        language: demo.language,
        demo: true,
      },
    });
    response.headers.set('Set-Cookie', setAuthCookie(token, isSecureRequest(request)));
    return response;
  } catch (error) {
    console.error('Demo login error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'activation du mode démo' },
      { status: 500 }
    );
  }
}
