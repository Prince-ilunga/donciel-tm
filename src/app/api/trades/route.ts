import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const pair = searchParams.get('pair');
    const direction = searchParams.get('direction');
    const session = searchParams.get('session');
    const marketCondition = searchParams.get('marketCondition');
    const timeframe = searchParams.get('timeframe');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');
    const resultFilter = searchParams.get('result');

    const where: Record<string, unknown> = {
      userId: result.user.id,
    };

    if (pair) where.pair = pair;
    if (direction) where.direction = direction;
    if (session) where.session = session;
    if (marketCondition) where.marketCondition = marketCondition;
    if (timeframe) where.timeframe = timeframe;
    if (resultFilter) where.result = resultFilter;

    if (dateFrom || dateTo) {
      where.date = {};
      if (dateFrom) (where.date as Record<string, unknown>).gte = new Date(dateFrom);
      if (dateTo) (where.date as Record<string, unknown>).lte = new Date(dateTo);
    }

    const trades = await db.trade.findMany({
      where,
      include: { screenshots: true },
      orderBy: { date: 'desc' },
    });

    return NextResponse.json({ trades });
  } catch (error) {
    console.error('Trades GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des trades' },
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
      date,
      pair,
      direction,
      session,
      marketCondition,
      timeframe,
      setup,
      structure,
      entryModel,
      amountToWin,
      entryPrice,
      stopLoss,
      takeProfit,
      exitPrice,
      entryTime,
      exitTime,
      duration,
      lotSize,
      rr,
      pnl,
      result: tradeResult,
      newsEnabled,
      emotions,
      confluence,
      mistakes,
      lessons,
      notes,
    } = body;

    if (!date || !pair || !direction || !session || !marketCondition || !timeframe || entryPrice === undefined || stopLoss === undefined || takeProfit === undefined) {
      return NextResponse.json(
        { error: 'Champs obligatoires manquants' },
        { status: 400 }
      );
    }

    // Auto-calculate RR (positive reward/risk ratio)
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    const calculatedRR = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null;

    // Auto-calculate result based on exit price
    let calculatedResult: string | null = tradeResult || null;
    if (exitPrice !== undefined && exitPrice !== null) {
      if (direction === 'LONG') {
        if (exitPrice >= takeProfit) calculatedResult = 'WIN';
        else if (exitPrice <= stopLoss) calculatedResult = 'LOSS';
        else calculatedResult = 'BE';
      } else {
        if (exitPrice <= takeProfit) calculatedResult = 'WIN';
        else if (exitPrice >= stopLoss) calculatedResult = 'LOSS';
        else calculatedResult = 'BE';
      }
    }

    // Adjust RR based on result: LOSS = -1R, BE = 0R, WIN = positive RR
    let finalRR = rr ?? calculatedRR;
    if (calculatedResult === 'LOSS') finalRR = -1;
    else if (calculatedResult === 'BE') finalRR = 0;

    // Auto-calculate PnL
    let calculatedPnl: number | null = pnl ?? null;
    if (exitPrice !== undefined && exitPrice !== null && lotSize) {
      const priceDiff = direction === 'LONG'
        ? exitPrice - entryPrice
        : entryPrice - exitPrice;
      calculatedPnl = parseFloat((priceDiff * lotSize).toFixed(2));
    }

    const trade = await db.trade.create({
      data: {
        userId: result.user.id,
        date: new Date(date),
        pair,
        direction,
        session,
        marketCondition,
        timeframe,
        setup: setup || null,
        structure: structure || null,
        entryModel: entryModel || null,
        amountToWin: amountToWin ? parseFloat(amountToWin) : null,
        entryPrice: parseFloat(entryPrice),
        stopLoss: parseFloat(stopLoss),
        takeProfit: parseFloat(takeProfit),
        exitPrice: exitPrice !== undefined && exitPrice !== null ? parseFloat(exitPrice) : null,
        entryTime: entryTime || null,
        exitTime: exitTime || null,
        duration: duration || null,
        lotSize: lotSize ? parseFloat(lotSize) : null,
        rr: finalRR,
        pnl: calculatedPnl,
        result: calculatedResult,
        newsEnabled: newsEnabled ?? false,
        emotions: emotions || null,
        confluence: confluence || null,
        mistakes: mistakes || null,
        lessons: lessons || null,
        notes: notes || null,
      },
      include: { screenshots: true },
    });

    return NextResponse.json({ trade }, { status: 201 });
  } catch (error) {
    console.error('Trades POST error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la création du trade' },
      { status: 500 }
    );
  }
}
