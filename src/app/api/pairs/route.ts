import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

const DEFAULT_PAIRS = [
  'XAUUSD',
  'US30',
  'US100',
  'EURUSD',
  'GBPUSD',
];

export async function GET() {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const customPairs = await db.customPair.findMany({
      where: { userId: result.user.id },
      orderBy: { name: 'asc' },
    });

    const pairs = [
      ...DEFAULT_PAIRS.map((name) => ({ id: `default-${name}`, name, isDefault: true })),
      ...customPairs.map((pair) => ({ id: pair.id, name: pair.name, isDefault: false })),
    ];

    return NextResponse.json({ pairs });
  } catch (error) {
    console.error('Pairs GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des paires' },
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
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Nom de paire requis' },
        { status: 400 }
      );
    }

    const trimmedName = name.trim().toUpperCase();

    // Check if it's already a default pair
    if (DEFAULT_PAIRS.includes(trimmedName)) {
      return NextResponse.json(
        { error: 'Cette paire existe déjà dans les paires par défaut' },
        { status: 409 }
      );
    }

    // Check if user already has this custom pair
    const existing = await db.customPair.findFirst({
      where: { userId: result.user.id, name: trimmedName },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'Vous avez déjà ajouté cette paire' },
        { status: 409 }
      );
    }

    const pair = await db.customPair.create({
      data: {
        userId: result.user.id,
        name: trimmedName,
      },
    });

    return NextResponse.json({ pair }, { status: 201 });
  } catch (error) {
    console.error('Pairs POST error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'ajout de la paire' },
      { status: 500 }
    );
  }
}
