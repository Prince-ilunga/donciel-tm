import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// ─── GET: load the user's plan document (create an empty one if missing) ──
export async function GET() {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    let doc = await db.planDocument.findUnique({
      where: { userId: result.user.id },
    });

    if (!doc) {
      doc = await db.planDocument.create({
        data: { userId: result.user.id },
      });
    }

    let blocks: unknown[] = [];
    try {
      blocks = JSON.parse(doc.blocks || '[]');
    } catch {
      blocks = [];
    }

    return NextResponse.json({
      ok: true,
      id: doc.id,
      title: doc.title,
      blocks,
      updatedAt: doc.updatedAt,
    });
  } catch (error) {
    console.error('Plan GET error:', error);
    return NextResponse.json(
      { ok: false, error: 'Erreur lors du chargement du plan' },
      { status: 500 }
    );
  }
}

// ─── PUT: save the user's plan document ──────────────────────────────────
export async function PUT(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const body = await request.json();
    const title = typeof body.title === 'string' ? body.title.slice(0, 200) : 'Mon Plan de Trading';
    const blocks = Array.isArray(body.blocks) ? body.blocks : [];

    // Light validation: each block must have an id and a known type.
    const ALLOWED = new Set([
      'h1', 'h2', 'h3', 'paragraph', 'bullet', 'numbered', 'quote',
      'callout', 'divider', 'image', 'tradingview', 'code',
    ]);
    const cleanBlocks = blocks
      .filter((b: any) => b && typeof b.id === 'string' && ALLOWED.has(b.type))
      .slice(0, 1000);

    const serialized = JSON.stringify(cleanBlocks);

    const doc = await db.planDocument.upsert({
      where: { userId: result.user.id },
      update: { title, blocks: serialized },
      create: { userId: result.user.id, title, blocks: serialized },
    });

    return NextResponse.json({ ok: true, updatedAt: doc.updatedAt });
  } catch (error) {
    console.error('Plan PUT error:', error);
    return NextResponse.json(
      { ok: false, error: 'Erreur lors de la sauvegarde du plan' },
      { status: 500 }
    );
  }
}
