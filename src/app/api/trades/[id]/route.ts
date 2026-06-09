import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';

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

    const trade = await db.trade.findFirst({
      where: { id, userId: result.user.id },
      include: { screenshots: true },
    });

    if (!trade) {
      return NextResponse.json(
        { error: 'Trade non trouvé' },
        { status: 404 }
      );
    }

    return NextResponse.json({ trade });
  } catch (error) {
    console.error('Trade GET error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération du trade' },
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

    const existingTrade = await db.trade.findFirst({
      where: { id, userId: result.user.id },
    });

    if (!existingTrade) {
      return NextResponse.json(
        { error: 'Trade non trouvé' },
        { status: 404 }
      );
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

    // Recalculate RR if entry/SL/TP changed
    const ep = entryPrice !== undefined ? parseFloat(entryPrice) : existingTrade.entryPrice;
    const sl = stopLoss !== undefined ? parseFloat(stopLoss) : existingTrade.stopLoss;
    const tp = takeProfit !== undefined ? parseFloat(takeProfit) : existingTrade.takeProfit;
    const dir = direction || existingTrade.direction;
    const xp = exitPrice !== undefined && exitPrice !== null ? parseFloat(exitPrice) : existingTrade.exitPrice;
    const ls = lotSize !== undefined && lotSize !== null ? parseFloat(lotSize) : existingTrade.lotSize;

    const risk = Math.abs(ep - sl);
    const reward = Math.abs(tp - ep);
    const calculatedRR = risk > 0 ? parseFloat((reward / risk).toFixed(2)) : null;

    // Auto-calculate result
    let calculatedResult: string | null = tradeResult ?? existingTrade.result;
    if (xp !== undefined && xp !== null) {
      if (dir === 'LONG') {
        if (xp >= tp) calculatedResult = 'WIN';
        else if (xp <= sl) calculatedResult = 'LOSS';
        else calculatedResult = 'BE';
      } else {
        if (xp <= tp) calculatedResult = 'WIN';
        else if (xp >= sl) calculatedResult = 'LOSS';
        else calculatedResult = 'BE';
      }
    }

    // Adjust RR based on result: LOSS = -1R, BE = calculated partial RR, WIN = positive RR
    let finalRR = rr ?? calculatedRR;
    if (calculatedResult === 'LOSS') finalRR = -1;
    else if (calculatedResult === 'BE' && xp !== undefined && xp !== null) {
      // Calculate partial RR for BE: actual price movement / risk
      const risk = Math.abs(ep - sl);
      if (risk > 0) {
        const priceDiff = dir === 'LONG' ? xp - ep : ep - xp;
        finalRR = parseFloat((priceDiff / risk).toFixed(2));
      }
    }

    // Auto-calculate PnL
    let calculatedPnl: number | null = pnl ?? existingTrade.pnl;
    if (xp !== undefined && xp !== null && ls) {
      const priceDiff = dir === 'LONG' ? xp - ep : ep - xp;
      calculatedPnl = parseFloat((priceDiff * ls).toFixed(2));
    }

    const trade = await db.trade.update({
      where: { id },
      data: {
        ...(date && { date: new Date(date) }),
        ...(pair && { pair }),
        ...(direction && { direction: dir }),
        ...(session && { session }),
        ...(marketCondition && { marketCondition }),
        ...(timeframe && { timeframe }),
        setup: setup !== undefined ? setup || null : existingTrade.setup,
        structure: structure !== undefined ? structure || null : existingTrade.structure,
        entryModel: entryModel !== undefined ? entryModel || null : existingTrade.entryModel,
        amountToWin: amountToWin !== undefined ? (amountToWin ? parseFloat(amountToWin) : null) : existingTrade.amountToWin,
        ...(entryPrice !== undefined && { entryPrice: ep }),
        ...(stopLoss !== undefined && { stopLoss: sl }),
        ...(takeProfit !== undefined && { takeProfit: tp }),
        exitPrice: exitPrice !== undefined ? (exitPrice !== null ? xp : null) : existingTrade.exitPrice,
        entryTime: entryTime !== undefined ? entryTime || null : existingTrade.entryTime,
        exitTime: exitTime !== undefined ? exitTime || null : existingTrade.exitTime,
        duration: duration !== undefined ? duration || null : existingTrade.duration,
        lotSize: lotSize !== undefined ? (lotSize !== null ? ls : null) : existingTrade.lotSize,
        rr: finalRR,
        pnl: calculatedPnl,
        result: calculatedResult,
        ...(newsEnabled !== undefined && { newsEnabled }),
        emotions: emotions !== undefined ? emotions || null : existingTrade.emotions,
        confluence: confluence !== undefined ? confluence || null : existingTrade.confluence,
        mistakes: mistakes !== undefined ? mistakes || null : existingTrade.mistakes,
        lessons: lessons !== undefined ? lessons || null : existingTrade.lessons,
        notes: notes !== undefined ? notes || null : existingTrade.notes,
      },
      include: { screenshots: true },
    });

    return NextResponse.json({ trade });
  } catch (error) {
    console.error('Trade PUT error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la mise à jour du trade' },
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

    const existingTrade = await db.trade.findFirst({
      where: { id, userId: result.user.id },
      include: { screenshots: true },
    });

    if (!existingTrade) {
      return NextResponse.json(
        { error: 'Trade non trouvé' },
        { status: 404 }
      );
    }

    // Delete screenshot files
    for (const screenshot of existingTrade.screenshots) {
      try {
        const fs = await import('fs/promises');
        const path = await import('path');
        const filePath = path.join(process.cwd(), screenshot.url);
        await fs.unlink(filePath).catch(() => {});
      } catch {
        // Ignore file deletion errors
      }
    }

    await db.trade.delete({ where: { id } });

    return NextResponse.json({ message: 'Trade supprimé' });
  } catch (error) {
    console.error('Trade DELETE error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la suppression du trade' },
      { status: 500 }
    );
  }
}
