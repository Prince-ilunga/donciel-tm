import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser, demoReadonlyGuard } from '@/lib/auth';
import { checkCoachQuota, limitErrorResponse } from '@/lib/plan-limits';
import { callZAIVision, VisionMessage } from '@/lib/zai';
import { isDemoAccount } from '@/lib/demo-data';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

/**
 * POST /api/coach/vision  { screenshotId }
 * Le Coach IA analyse une capture d'écran de trade (analyse de
 * setup, exécution, gestion du risque) en la combinant au contexte
 * réel du trade (setup, direction, prix, résultat).
 * Utilise le même quota mensuel que le coach texte (plan gating).
 */
export async function POST(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error || !result.user) {
      return NextResponse.json({ error: result.error || 'Non autorisé' }, { status: 401 });
    }
    const user = result.user;

    const body = await request.json().catch(() => null);
    const screenshotId = String(body?.screenshotId || '').trim();
    if (!screenshotId) {
      return NextResponse.json({ error: 'screenshotId requis' }, { status: 400 });
    }

    // ─── Récupérer la capture + le trade associé ───
    const screenshot = await db.screenshot.findUnique({
      where: { id: screenshotId },
      include: { trade: true },
    });
    if (!screenshot) {
      return NextResponse.json({ error: 'Capture introuvable' }, { status: 404 });
    }

    // Ownership : le propriétaire ou un admin
    if (screenshot.trade.userId !== user.id && user.role !== 'admin') {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    const demo = isDemoAccount(user.email);
    const guard = demoReadonlyGuard(demo ? undefined : user.email);
    if (guard) return guard;

    // ─── Quota IA (gratuit pour le compte démo) ───
    if (!demo) {
      const quota = await checkCoachQuota(user.id);
      if (!quota.allowed) {
        return limitErrorResponse(quota);
      }
    }

    // ─── Charger l'image en base64 ───
    const url = screenshot.url;
    if (!/^https?:\/\//i.test(url)) {
      return NextResponse.json(
        { error: 'Cette capture n\'est pas analysable (stockage local). Ré-uploade-la via un nouveau trade.' },
        { status: 400 }
      );
    }
    const imageRes = await fetch(url, { signal: AbortSignal.timeout(30000) });
    if (!imageRes.ok) {
      return NextResponse.json({ error: 'Impossible de charger l\'image' }, { status: 502 });
    }
    const contentType = imageRes.headers.get('content-type') || 'image/png';
    if (!contentType.startsWith('image/')) {
      return NextResponse.json({ error: 'Le fichier n\'est pas une image' }, { status: 400 });
    }
    const buffer = Buffer.from(await imageRes.arrayBuffer());
    if (buffer.length > 8 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image trop volumineuse (max 8 Mo)' }, { status: 413 });
    }
    const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;

    // ─── Contexte du trade ───
    const t = screenshot.trade;
    const context = [
      `Actif : ${t.pair}`,
      `Direction : ${t.direction}`,
      `Session : ${t.session}`,
      `Setup : ${t.setup || 'non précisé'}`,
      `Modèle d'entrée : ${t.entryModel || 'non précisé'}`,
      `Structure : ${t.structure || 'non précisée'}`,
      `Timeframe : ${t.timeframe}`,
      `Prix d'entrée : ${t.entryPrice}`,
      `Stop loss : ${t.stopLoss}`,
      `Take profit : ${t.takeProfit}`,
      t.exitPrice != null ? `Prix de sortie : ${t.exitPrice}` : 'Trade encore ouvert',
      t.result ? `Résultat : ${t.result}` : '',
      t.rr != null ? `R:R : ${t.rr}` : '',
      t.lotSize != null ? `Taille de position : ${t.lotSize}` : '',
      t.emotions ? `Émotions notées : ${t.emotions}` : '',
      t.mistakes ? `Erreurs notées : ${t.mistakes}` : '',
      `Type de capture : ${screenshot.type === 'analysis' ? 'analyse pré-trade' : screenshot.type === 'entry' ? 'exécution / point d\'entrée' : 'sortie'}`,
    ]
      .filter(Boolean)
      .join('\n');

    const messages: VisionMessage[] = [
      {
        role: 'system',
        content: [
          {
            type: 'text',
            text:
              'Tu es le Coach IA de DONCIEL™, expert en trading ICT (Inner Circle Trader) et en price action. ' +
              'Tu analyses les captures d\'écran TradingView de traders. Réponds toujours en français, ' +
              'directement, sans markdown lourd. Structure ta réponse ainsi :\n' +
              '1. 📊 Ce que je vois (2-3 phrases : actif, timeframe, structure, niveaux)\n' +
              '2. ✅ Points forts (2-3 puces courts)\n' +
              '3. ⚠️ Points à améliorer (2-3 puces courts, bienveillant mais honnête)\n' +
              '4. 💡 Un conseil concret et actionnable (1-2 phrases)\n' +
              'Sois précis, encourageant, et adapté à un trader en progression. Maximum 180 mots.',
          },
        ],
      },
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text:
              `Analyse ma capture de trade. Contexte du trade enregistré :\n${context}\n\n` +
              'Compare ce que tu vois sur le graphique avec ce contexte : est-ce que l\'entrée, ' +
              'le stop loss et le take profit semblent bien placés ? Le setup correspond-il à une ' +
              'logique ICT cohérente (liquidity, order block, fair value gap, market structure) ?',
          },
          { type: 'image_url', image_url: { url: dataUrl } },
        ],
      },
    ];

    const completion = await callZAIVision(messages);
    const analysis: string =
      completion?.choices?.[0]?.message?.content ||
      'Aucune analyse générée. Réessaie dans un instant.';

    return NextResponse.json({ analysis, screenshotId });
  } catch (error: any) {
    console.error('[coach/vision] Error:', error?.message);
    return NextResponse.json(
      { error: 'Le Coach IA n\'a pas pu analyser cette capture. Réessaie dans un instant.' },
      { status: 500 }
    );
  }
}
