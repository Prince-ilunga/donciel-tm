import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { getAuthUser } from '@/lib/auth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * GET /api/export?type=trades|stats&format=pdf
 * Export trading data as professional PDF
 */
export async function GET(request: NextRequest) {
  try {
    const result = await getAuthUser();
    if (result.error) {
      return NextResponse.json({ error: result.error }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const exportType = searchParams.get('type') || 'trades';
    const lang = searchParams.get('lang') || 'fr';

    // Fetch all trades for the user
    const trades = await db.trade.findMany({
      where: { userId: result.user.id },
      include: { screenshots: true },
      orderBy: { date: 'desc' },
    });

    const isFr = lang === 'fr';
    const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

    // ─── Colors ─────────────────────────────────────────────
    const PRIMARY = [212, 175, 55];     // Gold
    const DARK = [15, 15, 20];          // Near black
    const PROFIT = [34, 197, 94];       // Green
    const LOSS = [239, 68, 68];         // Red
    const BE_COLOR = [234, 179, 8];     // Yellow
    const MUTED = [120, 120, 130];      // Gray

    // ─── Page dimensions ────────────────────────────────────
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;

    // ─── Helper: Add header to each page ────────────────────
    const addHeader = (title: string) => {
      // Top bar
      doc.setFillColor(...DARK);
      doc.rect(0, 0, pageW, 22, 'F');

      // Gold accent line
      doc.setFillColor(...PRIMARY);
      doc.rect(0, 22, pageW, 1.5, 'F');

      // Logo text
      doc.setTextColor(...PRIMARY);
      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.text('DONCIEL™', margin, 14);

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(11);
      doc.setFont('helvetica', 'normal');
      doc.text(title, margin + 35, 14);

      // Date
      doc.setFontSize(8);
      doc.setTextColor(180, 180, 190);
      const dateStr = new Date().toLocaleDateString(isFr ? 'fr-FR' : 'en-US', {
        year: 'numeric', month: 'long', day: 'numeric'
      });
      doc.text(dateStr, pageW - margin, 14, { align: 'right' });

      // User info
      const userName = result.user?.name || result.user?.email || '';
      if (userName) {
        doc.text(userName, pageW - margin, 19, { align: 'right' });
      }
    };

    // ─── Helper: Add footer to each page ────────────────────
    const addFooter = (pageNum: number, totalPages: number) => {
      const y = pageH - 8;
      doc.setFillColor(...DARK);
      doc.rect(0, pageH - 12, pageW, 12, 'F');

      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.text(
        `DONCIEL™ ${isFr ? 'Journal de Trading Professionnel' : 'Professional Trading Journal'}`,
        margin, y
      );
      doc.text(
        `${isFr ? 'Page' : 'Page'} ${pageNum} / ${totalPages}`,
        pageW - margin, y, { align: 'right' }
      );
      doc.text(
        isFr ? 'Confidentiel' : 'Confidential',
        pageW / 2, y, { align: 'center' }
      );
    };

    // ─── Calculate stats ────────────────────────────────────
    const totalTrades = trades.length;
    const wins = trades.filter(t => t.result === 'WIN').length;
    const losses = trades.filter(t => t.result === 'LOSS').length;
    const bes = trades.filter(t => t.result === 'BE').length;
    const tradesWithResult = wins + losses + bes;
    const winRate = tradesWithResult > 0 ? ((wins / tradesWithResult) * 100).toFixed(1) : '0.0';
    const totalRR = trades.reduce((s, t) => s + (t.rr ?? 0), 0);
    const totalPnl = trades.reduce((s, t) => s + (t.pnl ?? 0), 0);
    const avgRR = totalTrades > 0 ? (totalRR / totalTrades).toFixed(2) : '0.00';
    const longTrades = trades.filter(t => t.direction === 'LONG').length;
    const shortTrades = trades.filter(t => t.direction === 'SHORT').length;

    // By pair stats
    const byPair: Record<string, { count: number; wins: number; totalRR: number; pnl: number }> = {};
    trades.forEach(t => {
      if (!byPair[t.pair]) byPair[t.pair] = { count: 0, wins: 0, totalRR: 0, pnl: 0 };
      byPair[t.pair].count++;
      if (t.result === 'WIN') byPair[t.pair].wins++;
      byPair[t.pair].totalRR += (t.rr ?? 0);
      byPair[t.pair].pnl += (t.pnl ?? 0);
    });

    // By session stats
    const bySession: Record<string, { count: number; wins: number; totalRR: number }> = {};
    trades.forEach(t => {
      if (!bySession[t.session]) bySession[t.session] = { count: 0, wins: 0, totalRR: 0 };
      bySession[t.session].count++;
      if (t.result === 'WIN') bySession[t.session].wins++;
      bySession[t.session].totalRR += (t.rr ?? 0);
    });

    // ─── PAGE 1: Dashboard Summary ─────────────────────────
    addHeader(isFr ? 'Tableau de Bord' : 'Dashboard');

    // KPI Cards
    const cardY = 28;
    const cardH = 22;
    const cardW = (pageW - margin * 2 - 15) / 5;
    const kpis = [
      { label: isFr ? 'Total Trades' : 'Total Trades', value: totalTrades.toString(), color: PRIMARY },
      { label: isFr ? 'Win Rate' : 'Win Rate', value: `${winRate}%`, color: PROFIT },
      { label: isFr ? 'RR Total' : 'Total RR', value: totalRR.toFixed(2), color: totalRR >= 0 ? PROFIT : LOSS },
      { label: isFr ? 'P&L Total' : 'Total P&L', value: `$${totalPnl >= 0 ? '+' : ''}${totalPnl.toFixed(2)}`, color: totalPnl >= 0 ? PROFIT : LOSS },
      { label: isFr ? 'RR Moyen' : 'Avg RR', value: avgRR, color: parseFloat(avgRR) >= 1 ? PROFIT : LOSS },
    ];

    kpis.forEach((kpi, i) => {
      const x = margin + i * (cardW + 3.75);
      // Card background
      doc.setFillColor(245, 245, 248);
      doc.roundedRect(x, cardY, cardW, cardH, 2, 2, 'F');
      // Color accent
      doc.setFillColor(...kpi.color);
      doc.rect(x, cardY, 2, cardH, 'F');
      // Label
      doc.setTextColor(...MUTED);
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(kpi.label, x + 6, cardY + 7);
      // Value
      doc.setTextColor(...DARK);
      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.text(kpi.value, x + 6, cardY + 17);
    });

    // Direction breakdown
    const dirY = cardY + cardH + 6;
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Répartition par Direction' : 'Direction Breakdown', margin, dirY);

    // Mini direction bars
    const barY = dirY + 4;
    const barW = pageW / 2 - margin * 2;
    const longPct = totalTrades > 0 ? longTrades / totalTrades : 0;

    doc.setFillColor(...PROFIT);
    doc.roundedRect(margin, barY, barW * longPct, 5, 1, 1, 'F');
    doc.setFillColor(...LOSS);
    doc.roundedRect(margin + barW * longPct, barY, barW * (1 - longPct), 5, 1, 1, 'F');
    doc.setTextColor(...PROFIT);
    doc.setFontSize(7);
    doc.text(`LONG: ${longTrades}`, margin + 2, barY + 3.5);
    doc.setTextColor(...LOSS);
    doc.text(`SHORT: ${shortTrades}`, margin + barW - 25, barY + 3.5);

    // By Pair table
    const pairY = barY + 12;
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Performance par Paire' : 'Performance by Pair', margin, pairY);

    const pairData = Object.entries(byPair).map(([pair, stats]) => [
      pair,
      stats.count.toString(),
      stats.count > 0 ? `${((stats.wins / stats.count) * 100).toFixed(1)}%` : '—',
      stats.totalRR.toFixed(2),
      `$${stats.pnl >= 0 ? '+' : ''}${stats.pnl.toFixed(2)}`,
    ]);

    autoTable(doc, {
      startY: pairY + 2,
      margin: { left: margin, right: margin },
      head: [[
        isFr ? 'Paire' : 'Pair',
        isFr ? 'Trades' : 'Trades',
        isFr ? 'Win Rate' : 'Win Rate',
        'RR',
        'P&L',
      ]],
      body: pairData,
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: DARK, textColor: PRIMARY, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        0: { fontStyle: 'bold' },
        4: { fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
          const val = data.cell.raw as string;
          if (val.startsWith('$+')) data.cell.styles.textColor = PROFIT;
          else if (val.startsWith('$-')) data.cell.styles.textColor = LOSS;
        }
        if (data.section === 'body' && data.column.index === 3) {
          const val = parseFloat(data.cell.raw as string);
          if (val >= 0) data.cell.styles.textColor = PROFIT;
          else data.cell.styles.textColor = LOSS;
        }
      },
    });

    // By Session table
    const sessStartY = (doc as any).lastAutoTable?.finalY + 8 || pairY + 40;
    doc.setTextColor(...DARK);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(isFr ? 'Performance par Session' : 'Performance by Session', margin, sessStartY);

    const sessData = Object.entries(bySession).map(([session, stats]) => [
      session,
      stats.count.toString(),
      stats.count > 0 ? `${((stats.wins / stats.count) * 100).toFixed(1)}%` : '—',
      stats.totalRR.toFixed(2),
    ]);

    autoTable(doc, {
      startY: sessStartY + 2,
      margin: { left: margin, right: margin },
      head: [[
        isFr ? 'Session' : 'Session',
        isFr ? 'Trades' : 'Trades',
        isFr ? 'Win Rate' : 'Win Rate',
        'RR',
      ]],
      body: sessData,
      theme: 'plain',
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: { fillColor: DARK, textColor: PRIMARY, fontStyle: 'bold', fontSize: 7 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
    });

    addFooter(1, 2);

    // ─── PAGE 2: Trades Table ───────────────────────────────
    doc.addPage();
    addHeader(isFr ? 'Liste des Trades' : 'Trades List');

    const tradeData = trades.map((t, idx) => {
      const dateStr = t.date ? new Date(t.date).toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—';
      const rrStr = t.rr != null ? (t.rr >= 0 ? `+${t.rr.toFixed(2)}` : t.rr.toFixed(2)) : '—';
      const pnlStr = t.pnl != null ? `${t.pnl >= 0 ? '+' : ''}$${t.pnl.toFixed(2)}` : '—';
      const resultStr = t.result || '—';
      return [
        (idx + 1).toString(),
        dateStr,
        t.pair,
        t.direction,
        t.setup || '—',
        t.entryPrice.toString(),
        t.stopLoss.toString(),
        t.takeProfit.toString(),
        rrStr,
        pnlStr,
        resultStr,
      ];
    });

    autoTable(doc, {
      startY: 28,
      margin: { left: margin, right: margin },
      head: [[
        '#',
        isFr ? 'Date' : 'Date',
        isFr ? 'Paire' : 'Pair',
        isFr ? 'Direction' : 'Dir',
        'Setup',
        isFr ? 'Entrée' : 'Entry',
        'SL',
        'TP',
        'RR',
        'P&L',
        isFr ? 'Résultat' : 'Result',
      ]],
      body: tradeData,
      theme: 'plain',
      styles: { fontSize: 6.5, cellPadding: 1.8 },
      headStyles: { fillColor: DARK, textColor: PRIMARY, fontStyle: 'bold', fontSize: 6.5 },
      alternateRowStyles: { fillColor: [248, 248, 252] },
      columnStyles: {
        0: { cellWidth: 8 },
        3: { fontStyle: 'bold' },
        8: { fontStyle: 'bold' },
        9: { fontStyle: 'bold' },
        10: { fontStyle: 'bold' },
      },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          // Direction color
          if (data.column.index === 3) {
            data.cell.styles.textColor = data.cell.raw === 'LONG' ? PROFIT : LOSS;
          }
          // RR color
          if (data.column.index === 8) {
            const val = data.cell.raw as string;
            if (val.startsWith('+')) data.cell.styles.textColor = PROFIT;
            else if (val.startsWith('-')) data.cell.styles.textColor = LOSS;
          }
          // P&L color
          if (data.column.index === 9) {
            const val = data.cell.raw as string;
            if (val.startsWith('+')) data.cell.styles.textColor = PROFIT;
            else if (val.startsWith('-')) data.cell.styles.textColor = LOSS;
          }
          // Result color
          if (data.column.index === 10) {
            const val = data.cell.raw as string;
            if (val === 'WIN') data.cell.styles.textColor = PROFIT;
            else if (val === 'LOSS') data.cell.styles.textColor = LOSS;
            else if (val === 'BE') data.cell.styles.textColor = BE_COLOR;
          }
        }
      },
    });

    addFooter(2, 2);

    // ─── Generate PDF buffer ────────────────────────────────
    const pdfBuffer = Buffer.from(doc.output('arraybuffer'));

    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="DONCIEL-Trade-Journal-${new Date().toISOString().slice(0, 10)}.pdf"`,
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Erreur lors de l\'export' },
      { status: 500 }
    );
  }
}
