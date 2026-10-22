// ─────────────────────────────────────────────────────────────
// DONCIEL TM — API d'import MT5/CSV avec auto-journaling
// POST = parse & preview (aucune écriture en base)
// PUT  = confirmation : création des trades (réservé PRO/ELITE)
// ─────────────────────────────────────────────────────────────
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, demoReadonlyGuard } from '@/lib/auth';
import { getContractSize } from '@/lib/utils';
import {
  checkTradeLimit,
  getEffectivePlan,
  limitErrorResponse,
} from '@/lib/plan-limits';
import {
  parseMT5Html,
  parseGenericCsv,
  deriveSessionFromISO,
  normalizePair,
  MAX_IMPORT_TRADES,
} from '@/lib/import-parser';

const IMPORT_MIN_CONTENT = 30;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function toFiniteNumber(v: unknown): number | null {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

interface RawImportTrade {
  date?: unknown;
  pair?: unknown;
  direction?: unknown;
  session?: unknown;
  marketCondition?: unknown;
  timeframe?: unknown;
  entryPrice?: unknown;
  stopLoss?: unknown;
  takeProfit?: unknown;
  exitPrice?: unknown;
  entryTime?: unknown;
  exitTime?: unknown;
  duration?: unknown;
  lotSize?: unknown;
  rr?: unknown;
  pnl?: unknown;
  result?: unknown;
  volume?: unknown;
  comment?: unknown;
}

function planGatePayload() {
  return limitErrorResponse({
    allowed: false,
    reason: "L'import MT5/CSV est disponible à partir du plan Pro.",
    plan: 'FREE',
  });
}

/** POST /api/import — analyse le contenu et renvoie un aperçu SANS écriture en base */
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error ?? 'Non autorisé' }, { status: 401 });
    }
    // Compte démo : lecture seule
    const demoGuard = demoReadonlyGuard(result.user?.email);
    if (demoGuard) return demoGuard;
    const user = result.user;

    // ─── Gating plan : import réservé PRO/ELITE ───
    const plan = await getEffectivePlan(user.id);
    if (plan === 'FREE') {
      return planGatePayload();
    }

    const body = (await request.json().catch(() => null)) as {
      mode?: unknown;
      content?: unknown;
    } | null;

    const mode = body?.mode;
    const content = typeof body?.content === 'string' ? body.content : '';

    if (mode !== 'MT5_HTML' && mode !== 'CSV') {
      return NextResponse.json(
        { error: "Mode d'import invalide (MT5_HTML ou CSV attendu)" },
        { status: 400 }
      );
    }
    if (content.trim().length < IMPORT_MIN_CONTENT) {
      return NextResponse.json(
        { error: 'Contenu trop court ou vide — fournis un rapport MT5 ou un fichier CSV.' },
        { status: 400 }
      );
    }

    const parsed = mode === 'MT5_HTML' ? parseMT5Html(content) : parseGenericCsv(content);
    return NextResponse.json({ trades: parsed.trades, warnings: parsed.warnings });
  } catch (error) {
    console.error('Import POST error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'analyse du fichier" },
      { status: 500 }
    );
  }
}

/** PUT /api/import — confirmation : crée les trades (résultats/pnl/rr recalculés serveur) */
export async function PUT(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error ?? 'Non autorisé' }, { status: 401 });
    }
    const user = result.user;

    // ─── Gating plan (défensif) ───
    const plan = await getEffectivePlan(user.id);
    if (plan === 'FREE') {
      return planGatePayload();
    }

    const body = (await request.json().catch(() => null)) as {
      trades?: unknown;
      accountName?: unknown;
      mode?: unknown;
    } | null;

    const rawTrades = Array.isArray(body?.trades) ? (body.trades as RawImportTrade[]) : null;
    if (!rawTrades || rawTrades.length === 0) {
      return NextResponse.json({ error: 'Aucun trade à importer' }, { status: 400 });
    }
    if (rawTrades.length > MAX_IMPORT_TRADES) {
      return NextResponse.json(
        { error: `Trop de trades en un seul import (${MAX_IMPORT_TRADES} maximum)` },
        { status: 400 }
      );
    }
    const accountName =
      typeof body?.accountName === 'string' && body.accountName.trim()
        ? body.accountName.trim().slice(0, 60)
        : 'Principal';
    const importSource = body?.mode === 'MT5_HTML' || body?.mode === 'CSV' ? body.mode : 'CSV';

    // ─── Limite mensuelle du plan ───
    const limitCheck = await checkTradeLimit(user.id);
    if (!limitCheck.allowed) {
      return limitErrorResponse(limitCheck);
    }

    // Cap défensif au quota restant pour les plans à limite mensuelle
    let kept = rawTrades;
    let skipped = 0;
    let limitReached = false;
    if (
      limitCheck.limit !== undefined &&
      limitCheck.limit !== -1 &&
      limitCheck.current !== undefined
    ) {
      const remaining = Math.max(0, limitCheck.limit - limitCheck.current);
      if (rawTrades.length > remaining) {
        kept = rawTrades.slice(0, remaining);
        skipped = rawTrades.length - kept.length;
        limitReached = true;
      }
    }

    let created = 0;

    for (const raw of kept) {
      // ─── Validation des champs critiques ───
      const dateISO = typeof raw.date === 'string' ? raw.date : '';
      const pair = normalizePair(typeof raw.pair === 'string' ? raw.pair : '');
      const direction =
        raw.direction === 'SHORT' ? 'SHORT' : raw.direction === 'LONG' ? 'LONG' : null;
      const entryPrice = toFiniteNumber(raw.entryPrice);
      if (!dateISO || !pair || !direction || entryPrice === null) {
        skipped++;
        continue;
      }
      const parsedDate = new Date(dateISO);
      if (Number.isNaN(parsedDate.getTime())) {
        skipped++;
        continue;
      }

      const stopLoss = toFiniteNumber(raw.stopLoss) ?? 0;
      const takeProfit = toFiniteNumber(raw.takeProfit) ?? 0;
      const exitPrice = toFiniteNumber(raw.exitPrice);
      const lotSize = toFiniteNumber(raw.lotSize);
      const reportedPnl = toFiniteNumber(raw.pnl);
      const entryTime = typeof raw.entryTime === 'string' ? raw.entryTime.trim().slice(0, 5) : null;
      const exitTime = typeof raw.exitTime === 'string' ? raw.exitTime.trim().slice(0, 5) : null;
      const duration = typeof raw.duration === 'string' ? raw.duration.trim().slice(0, 20) : null;
      const notes =
        typeof raw.comment === 'string' ? raw.comment.trim().slice(0, 500) || null : null;

      // ─── Résultat recalculé serveur (pnl du rapport fait foi, pas le client) ───
      let tradeResult: 'WIN' | 'LOSS' | 'BE';
      if (reportedPnl !== null) {
        tradeResult = reportedPnl > 0.005 ? 'WIN' : reportedPnl < -0.005 ? 'LOSS' : 'BE';
      } else if (exitPrice !== null) {
        const diff = direction === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
        tradeResult = diff > 0 ? 'WIN' : diff < 0 ? 'LOSS' : 'BE';
      } else if (raw.result === 'WIN' || raw.result === 'LOSS' || raw.result === 'BE') {
        tradeResult = raw.result;
      } else {
        tradeResult = 'BE';
      }

      // ─── RR recalculé serveur (même logique que POST /api/trades) ───
      const risk = Math.abs(entryPrice - stopLoss);
      const reward = Math.abs(takeProfit - entryPrice);
      let finalRR: number | null = risk > 0 && takeProfit > 0 ? round2(reward / risk) : null;
      if (tradeResult === 'LOSS') {
        finalRR = -1;
      } else if (tradeResult === 'BE' && exitPrice !== null && risk > 0) {
        const priceDiff = direction === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
        finalRR = round2(priceDiff / risk);
      }

      // ─── PnL : celui du rapport s'il est fourni, sinon recalcul via contract size ───
      let finalPnl: number | null = reportedPnl !== null ? round2(reportedPnl) : null;
      if (finalPnl === null && exitPrice !== null && lotSize) {
        const priceDiff = direction === 'LONG' ? exitPrice - entryPrice : entryPrice - exitPrice;
        finalPnl = round2(priceDiff * lotSize * getContractSize(pair));
      }

      const marketCondition =
        raw.marketCondition === 'RETRACEMENT' ? 'RETRACEMENT' : 'CONTINUATION';
      const timeframe =
        typeof raw.timeframe === 'string' && raw.timeframe.trim()
          ? raw.timeframe.trim().slice(0, 10)
          : 'M5';
      const session = deriveSessionFromISO(dateISO);

      await db.trade.create({
        data: {
          userId: user.id,
          date: parsedDate,
          pair,
          direction,
          session,
          marketCondition,
          timeframe,
          entryPrice,
          stopLoss,
          takeProfit,
          exitPrice,
          entryTime,
          exitTime,
          duration,
          lotSize,
          rr: finalRR,
          pnl: finalPnl,
          result: tradeResult,
          newsEnabled: false,
          notes,
          accountName,
          importSource,
        },
      });
      created++;
    }

    return NextResponse.json({ created, skipped, limitReached });
  } catch (error) {
    console.error('Import PUT error:', error);
    return NextResponse.json(
      { error: "Erreur lors de l'import des trades" },
      { status: 500 }
    );
  }
}
