import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { sendPlanActivatedEmail } from '@/lib/email';

export const dynamic = 'force-dynamic';

async function requireAdmin() {
  const auth = await getAuthUser();
  if (auth.error || !auth.user) return { error: auth.error || 'Non autorisé', status: 401 as const };
  if (auth.user.role !== 'admin') return { error: 'Accès réservé aux administrateurs', status: 403 as const };
  return { user: auth.user };
}

// GET /api/admin/payment-requests?status=PENDING
export async function GET(request: NextRequest) {
  const guard = await requireAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const status = request.nextUrl.searchParams.get('status');
    const requests = await db.paymentRequest.findMany({
      where: status ? { status } : undefined,
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: { select: { email: true, name: true, plan: true } },
      },
    });
    return NextResponse.json({ requests });
  } catch (error) {
    console.error('Payment requests list error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// PATCH /api/admin/payment-requests  { id, action: "APPROVED"|"REJECTED", adminNote? }
export async function PATCH(request: NextRequest) {
  const guard = await requireAdmin();
  if ('error' in guard) return NextResponse.json({ error: guard.error }, { status: guard.status });

  try {
    const body = await request.json();
    const { id, action, adminNote } = body as { id: string; action: string; adminNote?: string };

    if (!id || (action !== 'APPROVED' && action !== 'REJECTED')) {
      return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
    }

    const req = await db.paymentRequest.findUnique({
      where: { id },
      include: { user: { select: { id: true, email: true, name: true } } },
    });
    if (!req) return NextResponse.json({ error: 'Demande introuvable' }, { status: 404 });
    if (req.status !== 'PENDING') {
      return NextResponse.json({ error: 'Cette demande a déjà été traitée' }, { status: 409 });
    }

    if (action === 'APPROVED') {
      const periodEnd = new Date();
      periodEnd.setDate(periodEnd.getDate() + (req.interval === 'yearly' ? 365 : 30));

      await db.$transaction([
        db.paymentRequest.update({
          where: { id },
          data: {
            status: 'APPROVED',
            adminNote: adminNote || null,
            reviewedAt: new Date(),
            reviewedBy: guard.user.email,
          },
        }),
        db.user.update({
          where: { id: req.userId },
          data: {
            plan: req.plan,
            planStatus: 'active',
            planInterval: req.interval,
            currentPeriodEnd: periodEnd,
          },
        }),
      ]);

      await sendPlanActivatedEmail(
        req.user.email,
        req.plan,
        req.interval === 'yearly' ? 12 : 1
      ).catch(() => undefined);
    } else {
      await db.paymentRequest.update({
        where: { id },
        data: {
          status: 'REJECTED',
          adminNote: adminNote || null,
          reviewedAt: new Date(),
          reviewedBy: guard.user.email,
        },
      });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('Payment request review error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
