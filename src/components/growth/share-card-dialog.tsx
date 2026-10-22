'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarDays, Download, Loader2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  computeCoreStats,
  computeEquityCurve,
  MONTH_LABELS_FR,
  type TradeLike,
} from '@/lib/analytics';
import { computeDoncielScore } from '@/lib/discipline';
import { useAppStore } from '@/stores/app-store';

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Carte de partage virale 1080×1350 (ratio 4:5)
// (Pack 4 — Croissance & Rétention)
//
// Rendu canvas : fond obsidienne→saphir, grille subtile, glow bleu,
// R total en dégradé, stats clés, sparkline d'équité, badge Score
// DONCIEL, pied de marque. Export PNG + Web Share API.
// ─────────────────────────────────────────────────────────────

const W = 1080;
const H = 1350;
const M = 84; // marge

const FONT_SERIF = '"Playfair Display", Georgia, "Times New Roman", serif';
const FONT_SANS = '"Geist", "Segoe UI", Arial, sans-serif';

function currentMonthKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string, lang: 'fr' | 'en'): string {
  const m = parseInt(key.slice(5), 10) - 1;
  const y = key.slice(0, 4);
  if (lang === 'en') {
    const en = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${en[m] || ''} ${y}`;
  }
  return `${MONTH_LABELS_FR[m] || ''} ${y}`;
}

function roundRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.arcTo(x + w, y, x + w, y + r, r);
  ctx.lineTo(x + w, y + h - r);
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
  ctx.lineTo(x + r, y + h);
  ctx.arcTo(x, y + h, x, y + h - r, r);
  ctx.lineTo(x, y + r);
  ctx.arcTo(x, y, x + r, y, r);
  ctx.closePath();
}

function drawCard(
  canvas: HTMLCanvasElement,
  monthTrades: TradeLike[],
  year: number,
  month: number,
  lang: 'fr' | 'en'
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const core = computeCoreStats(monthTrades);
  const score = computeDoncielScore(monthTrades);
  const equity = computeEquityCurve(monthTrades);

  ctx.clearRect(0, 0, W, H);

  // ── Fond dégradé obsidienne → saphir ──
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#04060a');
  bg.addColorStop(0.55, '#0a1628');
  bg.addColorStop(1, '#10243f');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  // ── Glow bleu (haut droit) ──
  const glow = ctx.createRadialGradient(W * 0.85, 150, 40, W * 0.85, 150, 640);
  glow.addColorStop(0, 'rgba(56,189,248,0.25)');
  glow.addColorStop(1, 'rgba(56,189,248,0)');
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);

  // ── Grille subtile ──
  ctx.strokeStyle = 'rgba(148,163,184,0.06)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 90; x < W; x += 90) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, H);
  }
  for (let y = 90; y < H; y += 90) {
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
  }
  ctx.stroke();

  // ── Bordure arrondie globale ──
  ctx.strokeStyle = 'rgba(56,189,248,0.22)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, 2, 2, W - 4, H - 4, 48);
  ctx.stroke();

  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';

  // ── En-tête marque ──
  ctx.fillStyle = '#f8fafc';
  ctx.font = `700 74px ${FONT_SERIF}`;
  ctx.fillText('DONCIEL™', M, 172);

  ctx.fillStyle = 'rgba(148,163,184,0.85)';
  ctx.font = `500 26px ${FONT_SANS}`;
  ctx.fillText('J O U R N A L   D E   T R A D I N G', M, 216);

  const subtitle = lang === 'fr' ? `Bilan de ${monthLabel(`${year}-${String(month).padStart(2, '0')}`, 'fr')}` : `Monthly review — ${monthLabel(`${year}-${String(month).padStart(2, '0')}`, 'en')}`;
  ctx.fillStyle = '#93c5fd';
  ctx.font = `600 42px ${FONT_SERIF}`;
  ctx.fillText(subtitle, M, 288);

  // ── Grand R total (dégradé de texte) ──
  const rText = `${core.totalRR >= 0 ? '+' : ''}${core.totalRR.toFixed(1)}R`;
  const grad = ctx.createLinearGradient(M, 0, W - M, 0);
  grad.addColorStop(0, '#93c5fd');
  grad.addColorStop(0.5, '#38bdf8');
  grad.addColorStop(1, '#2563eb');
  ctx.font = `700 200px ${FONT_SERIF}`;
  ctx.fillStyle = grad;
  ctx.fillText(rText, M, 540);

  ctx.font = `500 28px ${FONT_SANS}`;
  ctx.fillStyle = 'rgba(148,163,184,0.8)';
  ctx.fillText(lang === 'fr' ? 'R cumulés ce mois' : 'Total R this month', M, 592);

  // ── Stats secondaires ──
  const stats: { label: string; value: string }[] = [
    { label: 'WIN RATE', value: `${core.winRate}%` },
    { label: 'PROFIT FACTOR', value: core.profitFactor >= 999 ? '∞' : core.profitFactor.toFixed(2) },
    { label: lang === 'fr' ? 'MEILLEUR STREAK' : 'BEST STREAK', value: `${core.maxWinStreak} W` },
  ];
  const colX = [M, M + 310, M + 610];
  stats.forEach((s, i) => {
    ctx.fillStyle = 'rgba(148,163,184,0.75)';
    ctx.font = `600 22px ${FONT_SANS}`;
    ctx.fillText(s.label, colX[i], 668);
    ctx.fillStyle = '#f1f5f9';
    ctx.font = `700 52px ${FONT_SANS}`;
    ctx.fillText(s.value, colX[i], 726);
  });

  // ── Panneau sparkline d'équité ──
  const sx = M;
  const sy = 790;
  const sw = W - 2 * M;
  const sh = 240;

  ctx.fillStyle = 'rgba(148,163,184,0.75)';
  ctx.font = `600 22px ${FONT_SANS}`;
  ctx.fillText(lang === 'fr' ? "COURBE D'ÉQUITÉ (R)" : 'EQUITY CURVE (R)', sx, sy - 22);

  ctx.fillStyle = 'rgba(2,6,23,0.45)';
  ctx.strokeStyle = 'rgba(56,189,248,0.18)';
  ctx.lineWidth = 1.5;
  roundRectPath(ctx, sx, sy, sw, sh, 24);
  ctx.fill();
  ctx.stroke();

  const pad = 30;
  const plotW = sw - pad * 2;
  const plotH = sh - pad * 2;

  if (equity.length >= 1) {
    const values = [0, ...equity.map((p) => p.equityR)];
    let min = Math.min(...values);
    let max = Math.max(...values);
    if (min === max) {
      min -= 1;
      max += 1;
    }
    const range = max - min;
    const px = (i: number) => sx + pad + (i / (values.length - 1)) * plotW;
    const py = (v: number) => sy + sh - pad - ((v - min) / range) * plotH;

    // Remplissage dégradé
    const area = ctx.createLinearGradient(0, sy, 0, sy + sh);
    area.addColorStop(0, 'rgba(56,189,248,0.35)');
    area.addColorStop(1, 'rgba(56,189,248,0)');
    ctx.beginPath();
    ctx.moveTo(px(0), py(values[0]));
    for (let i = 1; i < values.length; i++) ctx.lineTo(px(i), py(values[i]));
    ctx.lineTo(px(values.length - 1), sy + sh - pad);
    ctx.lineTo(px(0), sy + sh - pad);
    ctx.closePath();
    ctx.fillStyle = area;
    ctx.fill();

    // Ligne d'équité
    ctx.beginPath();
    ctx.moveTo(px(0), py(values[0]));
    for (let i = 1; i < values.length; i++) ctx.lineTo(px(i), py(values[i]));
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 6;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke();

    // Point final lumineux
    const lastX = px(values.length - 1);
    const lastY = py(values[values.length - 1]);
    ctx.beginPath();
    ctx.arc(lastX, lastY, 16, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(56,189,248,0.25)';
    ctx.fill();
    ctx.beginPath();
    ctx.arc(lastX, lastY, 7, 0, Math.PI * 2);
    ctx.fillStyle = '#38bdf8';
    ctx.fill();
  } else {
    ctx.strokeStyle = 'rgba(148,163,184,0.4)';
    ctx.setLineDash([10, 10]);
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx + pad, sy + sh / 2);
    ctx.lineTo(sx + sw - pad, sy + sh / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = 'rgba(148,163,184,0.8)';
    ctx.font = `500 26px ${FONT_SANS}`;
    ctx.textAlign = 'center';
    ctx.fillText(lang === 'fr' ? 'Aucun trade ce mois-ci' : 'No trades this month', W / 2, sy + sh / 2 - 20);
    ctx.textAlign = 'left';
  }

  // ── Badge Score DONCIEL ──
  const pillText = lang === 'fr'
    ? `Score DONCIEL : ${score.total}/100 — Grade ${score.grade}`
    : `DONCIEL Score: ${score.total}/100 — Grade ${score.grade}`;
  ctx.font = `600 34px ${FONT_SANS}`;
  const pillW = ctx.measureText(pillText).width + 72;
  const pillH = 68;
  const pillY = 1102;
  ctx.fillStyle = 'rgba(56,189,248,0.10)';
  ctx.strokeStyle = 'rgba(56,189,248,0.45)';
  ctx.lineWidth = 2;
  roundRectPath(ctx, M, pillY, pillW, pillH, pillH / 2);
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = '#e0f2fe';
  ctx.fillText(pillText, M + 36, pillY + 45);

  // ── Pied de carte ──
  ctx.strokeStyle = 'rgba(148,163,184,0.18)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(M, 1236);
  ctx.lineTo(W - M, 1236);
  ctx.stroke();

  ctx.fillStyle = 'rgba(148,163,184,0.9)';
  ctx.font = `600 30px ${FONT_SANS}`;
  ctx.fillText('donciel-trading.vercel.app', M, 1288);

  ctx.textAlign = 'right';
  ctx.font = `italic 600 30px ${FONT_SERIF}`;
  ctx.fillStyle = 'rgba(147,197,253,0.85)';
  ctx.fillText(lang === 'fr' ? 'Journalise. Analyse. Progresse.' : 'Journal. Analyze. Progress.', W - M, 1288);
  ctx.textAlign = 'left';
}

export interface ShareCardDialogProps {
  open: boolean;
  onClose: () => void;
}

export function ShareCardDialog({ open, onClose }: ShareCardDialogProps) {
  const language = useAppStore((s) => s.language);
  const [trades, setTrades] = useState<TradeLike[]>([]);
  const [loading, setLoading] = useState(true);
  const [month, setMonth] = useState<string>(currentMonthKey());
  const [sharing, setSharing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const fr = language === 'fr';

  // Chargement des trades à l'ouverture du dialog
  useEffect(() => {
    if (!open) return;
    let alive = true;
    (async () => {
      const res = await fetch('/api/trades').catch(() => null);
      if (!alive) return;
      if (res && res.ok) {
        const d = (await res.json()) as { trades?: TradeLike[] };
        setTrades(d.trades || []);
      } else {
        setTrades([]);
      }
      setLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [open]);

  // 12 derniers mois avec des trades
  const sortedMonths = useMemo(() => {
    const keys = new Set<string>();
    for (const t of trades) {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    const sorted = [...keys].sort().reverse().slice(0, 12);
    return sorted.length > 0 ? sorted : [currentMonthKey()];
  }, [trades]);

  // Mois actif : garde la sélection si valide, sinon le mois le plus récent
  const activeMonth = sortedMonths.includes(month) ? month : sortedMonths[0];

  const year = parseInt(activeMonth.slice(0, 4), 10);
  const monthNum = parseInt(activeMonth.slice(5), 10);

  const monthTrades = useMemo(
    () =>
      trades.filter((t) => {
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === monthNum - 1;
      }),
    [trades, year, monthNum]
  );

  // Rendu canvas
  useEffect(() => {
    if (!open || loading) return;
    const canvas = canvasRef.current;
    if (!canvas || monthTrades.length === 0) return;

    drawCard(canvas, monthTrades, year, monthNum, language);

    // Redessine une fois les polices (Playfair/Geist) chargées
    let cancelled = false;
    if (typeof document !== 'undefined' && document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) {
          const c = canvasRef.current;
          if (c) drawCard(c, monthTrades, year, monthNum, language);
        }
      }).catch(() => {});
    }
    return () => {
      cancelled = true;
    };
  }, [open, loading, monthTrades, year, monthNum, language]);

  const getPngBlob = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const canvas = canvasRef.current;
        if (!canvas) {
          resolve(null);
          return;
        }
        canvas.toBlob((blob) => resolve(blob), 'image/png');
      }),
    []
  );

  const triggerDownload = useCallback(
    (blob: Blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `donciel-bilan-${activeMonth}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 3000);
    },
    [activeMonth]
  );

  const handleDownload = useCallback(async () => {
    const blob = await getPngBlob();
    if (!blob) {
      toast.error(fr ? 'Impossible de générer l’image' : 'Unable to generate the image');
      return;
    }
    triggerDownload(blob);
    toast.success(fr ? 'Image téléchargée 🎉' : 'Image downloaded 🎉');
  }, [getPngBlob, triggerDownload, fr]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const blob = await getPngBlob();
      if (!blob) {
        toast.error(fr ? 'Impossible de générer l’image' : 'Unable to generate the image');
        return;
      }
      const file = new File([blob], `donciel-bilan-${activeMonth}.png`, { type: 'image/png' });
      const nav = navigator as Navigator & { canShare?: (data: ShareData) => boolean };
      if (nav.canShare?.({ files: [file] })) {
        await nav.share({
          files: [file],
          title: 'DONCIEL TM — Bilan mensuel',
          text: fr
            ? `Mon bilan ${monthLabel(activeMonth, 'fr')} avec DONCIEL TM 📈`
            : `My ${monthLabel(activeMonth, 'en')} review with DONCIEL TM 📈`,
        });
        toast.success(fr ? 'Carte partagée 🚀' : 'Card shared 🚀');
      } else {
        // Fallback : téléchargement
        triggerDownload(blob);
        toast.info(
          fr
            ? 'Partage non supporté sur cet appareil — image téléchargée.'
            : 'Sharing not supported on this device — image downloaded.'
        );
      }
    } catch (err) {
      // Partage annulé par l'utilisateur → silencieux
      if ((err as DOMException)?.name !== 'AbortError') {
        toast.error(fr ? 'Échec du partage' : 'Share failed');
      }
    } finally {
      setSharing(false);
    }
  }, [getPngBlob, triggerDownload, activeMonth, fr]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="font-serif text-xl">
            {fr ? 'Carte de partage' : 'Share card'}
          </DialogTitle>
          <DialogDescription>
            {fr
              ? 'Ton bilan mensuel en image — idéal pour les réseaux sociaux.'
              : 'Your monthly review as an image — perfect for social media.'}
          </DialogDescription>
        </DialogHeader>

        {/* Sélecteur de mois */}
        <div className="flex items-center gap-3">
          <Select value={activeMonth} onValueChange={setMonth}>
            <SelectTrigger className="h-11 w-full" aria-label={fr ? 'Choisir le mois' : 'Pick a month'}>
              <SelectValue placeholder={fr ? 'Choisir un mois' : 'Pick a month'} />
            </SelectTrigger>
            <SelectContent>
              {sortedMonths.map((key) => (
                <SelectItem key={key} value={key}>
                  {monthLabel(key, language)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Aperçu canvas 1080×1350 */}
        {loading ? (
          <div className="space-y-3 py-2">
            <Skeleton className="mx-auto h-72 w-full max-w-[320px] rounded-xl" />
            <Skeleton className="mx-auto h-10 w-full max-w-[320px] rounded-lg" />
          </div>
        ) : monthTrades.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border py-12 text-center">
            <CalendarDays className="size-8 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              {fr ? 'Aucun trade ce mois-ci.' : 'No trades this month.'}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-center py-1">
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="block h-auto w-full max-w-[320px] rounded-xl border border-sky-500/20 shadow-xl sm:max-w-sm"
                role="img"
                aria-label={
                  fr
                    ? `Carte de bilan mensuel — ${monthLabel(activeMonth, 'fr')}`
                    : `Monthly review card — ${monthLabel(activeMonth, 'en')}`
                }
              />
            </div>

            <div className="grid grid-cols-1 gap-2 pb-1 sm:grid-cols-2">
              <Button
                onClick={handleDownload}
                className="h-11 w-full gap-2 bg-sky-500 text-white hover:bg-sky-600"
              >
                <Download className="size-4" />
                {fr ? 'Télécharger PNG' : 'Download PNG'}
              </Button>
              <Button
                onClick={handleShare}
                disabled={sharing}
                variant="outline"
                className="h-11 w-full gap-2 border-sky-500/40 text-sky-300 hover:bg-sky-500/10"
              >
                {sharing ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                {fr ? 'Partager' : 'Share'}
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ShareCardDialog;
