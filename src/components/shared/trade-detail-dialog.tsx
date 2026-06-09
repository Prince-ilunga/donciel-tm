"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useTrades } from "@/lib/hooks";
import { cn, getContractSize, calculateDollarAmount } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ArrowUpRight,
  ArrowDownRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Clock,
  Target,
  DollarSign,
  BarChart3,
  Calculator,
  Newspaper,
  AlertTriangle,
  Lightbulb,
  Heart,
  Layers,
  X,
  Image as ImageIcon,
  Eye,
} from "lucide-react";

interface TradeDetail {
  id: string;
  userId: string;
  date: string;
  pair: string;
  direction: string;
  session: string;
  marketCondition: string;
  timeframe: string;
  setup: string | null;
  structure: string | null;
  entryModel: string | null;
  amountToWin: number | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number | null;
  entryTime: string | null;
  exitTime: string | null;
  duration: string | null;
  lotSize: number | null;
  rr: number | null;
  pnl: number | null;
  result: string | null;
  newsEnabled: boolean;
  emotions: string | null;
  confluence: string | null;
  mistakes: string | null;
  lessons: string | null;
  notes: string | null;
  createdAt: string;
  screenshots: { id: string; type: string; url: string }[];
}

export function TradeDetailDialog() {
  const { selectedTradeId, showTradeDetail, setShowTradeDetail, language, setScreenshotViewerUrl } = useAppStore();
  const { trades: allTrades, refetch: refetchTrades } = useTrades();
  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevTradeIdRef = useRef<string | null>(null);

  const fetchTrade = useCallback(async (id: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/trades/${id}?_t=${Date.now()}`);
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || (language === "fr" ? "Erreur lors du chargement" : "Error loading trade"));
        setTrade(null);
        return;
      }
      const data = await res.json();
      if (data.trade && data.trade.entryPrice !== undefined) {
        setTrade(data.trade);
      } else {
        setError(language === "fr" ? "Données du trade invalides" : "Invalid trade data");
        setTrade(null);
      }
    } catch (err) {
      console.error("Error fetching trade:", err);
      setError(language === "fr" ? "Erreur de connexion" : "Connection error");
      setTrade(null);
    } finally {
      setLoading(false);
    }
  }, [language]);

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowTradeDetail(false);
      setTrade(null);
      setError(null);
      prevTradeIdRef.current = null;
    }
  }, [setShowTradeDetail]);

  useEffect(() => {
    if (showTradeDetail && selectedTradeId && selectedTradeId !== prevTradeIdRef.current) {
      prevTradeIdRef.current = selectedTradeId;
      setTrade(null);
      fetchTrade(selectedTradeId);
      // Fetch all trades for chart data and screenshot fallback
      refetchTrades();
    }
    if (!showTradeDetail && prevTradeIdRef.current) {
      prevTradeIdRef.current = null;
      setTrade(null);
      setError(null);
    }
  }, [showTradeDetail, selectedTradeId, fetchTrade, refetchTrades]);

  const isLong = trade?.direction === "LONG";
  const isWin = trade?.result === "WIN";
  const isLoss = trade?.result === "LOSS";

  // Compute trade statistics
  const tradeStats = useMemo(() => {
    if (!trade) return null;
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - trade.entryPrice);
    const rr = risk > 0 ? reward / risk : 0;
    const riskRewardRatio = risk > 0 ? rr.toFixed(2) : "—";

    // Recalculate P&L FIRST if it's 0/null but we have the data to compute it
    let pnl = trade.pnl;
    if ((pnl === null || pnl === 0) && trade.exitPrice != null && trade.lotSize && trade.lotSize > 0) {
      const priceDiff = trade.direction === 'LONG'
        ? trade.exitPrice - trade.entryPrice
        : trade.entryPrice - trade.exitPrice;
      pnl = calculateDollarAmount(priceDiff, trade.lotSize, trade.pair);
    }

    // Calculate Risk ($) and Reward ($) using contract size
    let riskAmount = "—";
    let rewardAmount = "—";
    let maxRewardDollar = 0;

    if (trade.amountToWin && trade.amountToWin > 0) {
      // Use user-entered amountToWin for reward, derive risk from RR
      rewardAmount = trade.amountToWin.toFixed(2);
      riskAmount = rr > 0 ? (trade.amountToWin / rr).toFixed(2) : trade.amountToWin.toFixed(2);
      maxRewardDollar = trade.amountToWin;
    } else if (trade.lotSize && trade.lotSize > 0) {
      // Calculate using contract size based on pair
      const contractSize = getContractSize(trade.pair);
      const riskDollar = risk * trade.lotSize * contractSize;
      const rewardDollar = reward * trade.lotSize * contractSize;
      riskAmount = riskDollar.toFixed(2);
      rewardAmount = rewardDollar.toFixed(2);
      maxRewardDollar = rewardDollar;
    }

    // Efficiency: actual P&L as percentage of max possible reward
    let efficiency = "—";
    if (pnl != null && maxRewardDollar > 0) {
      const eff = (pnl / maxRewardDollar) * 100;
      efficiency = eff.toFixed(0) + "%";
    }

    return { riskRewardRatio, riskAmount, rewardAmount, efficiency, pnl };
  }, [trade]);

  // Get chart data for this trade
  const chartData = useMemo(() => {
    if (!trade || !allTrades.length) return { last10RR: [], cumulativeRRUpToTrade: [], totalCumulativeRR: 0 };

    // Sort trades by date then createdAt
    const sorted = [...allTrades].sort((a, b) => {
      const dateA = new Date(a.date).getTime();
      const dateB = new Date(b.date).getTime();
      if (dateA !== dateB) return dateA - dateB;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    // Find the index of current trade
    const currentIdx = sorted.findIndex(t => t.id === trade.id);

    // ─── RR PAR TRADE: Last 10 trades ending at this trade ───
    const startIdx = Math.max(0, (currentIdx >= 0 ? currentIdx : sorted.length - 1) - 9);
    const endIdx = currentIdx >= 0 ? currentIdx + 1 : sorted.length;
    const last10 = sorted.slice(startIdx, endIdx);

    const last10RR = last10.map((t, i) => ({
      index: startIdx + i + 1,
      rr: t.rr ?? 0,
      result: t.result,
    }));

    // ─── CUMULE RR ISOLÉ: Cumulative RR from first trade up to this trade ───
    const upToCurrentIdx = currentIdx >= 0 ? currentIdx + 1 : sorted.length;
    const tradesUpToCurrent = sorted.slice(0, upToCurrentIdx);

    let cumRR = 0;
    const cumulativeRRUpToTrade = tradesUpToCurrent.map((t, i) => {
      cumRR += (t.rr ?? 0);
      return { index: i + 1, cumulativeRR: cumRR };
    });

    const totalCumulativeRR = cumRR;

    return { last10RR, cumulativeRRUpToTrade, totalCumulativeRR };
  }, [trade, allTrades]);

  // Chart dimensions
  const CHART_W = 300;
  const CHART_H = 120;
  const CHART_PAD = 20;

  // Bar chart data for RR PAR TRADE
  const rrBarChart = useMemo(() => {
    const data = chartData.last10RR;
    if (!data.length) return null;
    const maxRR = Math.max(...data.map(d => Math.abs(d.rr)), 1);
    const barW = Math.max(4, (CHART_W - CHART_PAD * 2) / data.length - 4);
    const zeroY = CHART_H / 2;

    return (
      <svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="overflow-visible">
        {/* Zero line */}
        <line x1={CHART_PAD} y1={zeroY} x2={CHART_W - CHART_PAD} y2={zeroY} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3,3" />
        {data.map((d, i) => {
          const x = CHART_PAD + i * ((CHART_W - CHART_PAD * 2) / data.length) + 2;
          const barHeight = (Math.abs(d.rr) / maxRR) * (zeroY - CHART_PAD);
          const y = d.rr >= 0 ? zeroY - barHeight : zeroY;
          const color = d.result === "WIN" ? "#22c55e" : d.result === "LOSS" ? "#ef4444" : "#eab308";
          return (
            <g key={i}>
              <rect x={x} y={y} width={barW} height={barHeight} fill={color} rx={2} opacity={0.8} />
              <text x={x + barW / 2} y={CHART_H - 2} textAnchor="middle" fontSize={8} fill="currentColor" opacity={0.4}>{d.index}</text>
            </g>
          );
        })}
      </svg>
    );
  }, [chartData.last10RR]);

  // Line chart for CUMULE RR ISOLÉ (from first trade up to this trade)
  const cumulativeLineChart = useMemo(() => {
    const data = chartData.cumulativeRRUpToTrade;
    if (!data.length) return null;
    const values = data.map(d => d.cumulativeRR);
    const minVal = Math.min(...values, 0);
    const maxVal = Math.max(...values, 0);
    const range = maxVal - minVal || 1;

    const points = data.map((d, i) => ({
      x: CHART_PAD + i * ((CHART_W - CHART_PAD * 2) / (data.length - 1 || 1)),
      y: CHART_H - CHART_PAD - ((d.cumulativeRR - minVal) / range) * (CHART_H - CHART_PAD * 2),
    }));

    const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaD = `${pathD} L ${points[points.length - 1].x} ${CHART_H - CHART_PAD} L ${points[0].x} ${CHART_H - CHART_PAD} Z`;

    // Zero line Y
    const zeroY = CHART_H - CHART_PAD - ((0 - minVal) / range) * (CHART_H - CHART_PAD * 2);

    // Determine color based on final cumulative RR
    const finalRR = values[values.length - 1];
    const lineColor = finalRR >= 0 ? "#22c55e" : "#ef4444";

    return (
      <svg width="100%" height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="overflow-visible">
        {zeroY > CHART_PAD && zeroY < CHART_H - CHART_PAD && (
          <line x1={CHART_PAD} y1={zeroY} x2={CHART_W - CHART_PAD} y2={zeroY} stroke="currentColor" strokeOpacity={0.15} strokeDasharray="3,3" />
        )}
        <path d={areaD} fill={lineColor} opacity={0.1} />
        <path d={pathD} fill="none" stroke={lineColor} strokeWidth={2} />
        {points.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={3} fill={lineColor} />
        ))}
      </svg>
    );
  }, [chartData.cumulativeRRUpToTrade]);

  // Resolve screenshot URL - handles all possible URL formats
  const resolveScreenshotUrl = useCallback((url: string): string => {
    if (!url) return '';
    // Full URLs (Cloudinary, etc.) used directly
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // Local paths get converted to API route
    if (url.startsWith('upload/screenshots/')) {
      return `/api/screenshots/${url.replace('upload/screenshots/', '')}`;
    }
    // Any other path - try as API route
    return `/api/screenshots/${url.split('/').pop()}`;
  }, []);

  // Detect if a URL is a video (Cloudinary video URL or video file extension)
  const isVideoUrl = useCallback((url: string): boolean => {
    if (!url) return false;
    // Cloudinary video URLs contain /video/upload/
    if (url.includes('/video/upload/')) return true;
    // Check video file extensions
    const videoExts = ['.mp4', '.webm', '.mov', '.avi', '.mkv', '.m4v'];
    const lowerUrl = url.toLowerCase();
    return videoExts.some(ext => lowerUrl.endsWith(ext));
  }, []);

  // Get screenshots - check both trade API and allTrades for maximum reliability
  const tradeScreenshots = useMemo(() => {
    if (!trade) return [];
    // Try allTrades first (freshly refetched when dialog opens, includes screenshots)
    const fromAllTrades = allTrades.find(t => t.id === trade.id)?.screenshots;
    if (fromAllTrades && fromAllTrades.length > 0) return fromAllTrades;
    // Fallback: trade API data
    if (trade.screenshots && trade.screenshots.length > 0) return trade.screenshots;
    return [];
  }, [trade, allTrades]);

  return (
    <Dialog open={showTradeDetail} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-5xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        {loading ? (
          <div className="p-6 space-y-4">
            <DialogHeader>
              <DialogTitle className="sr-only">{language === "fr" ? "Chargement du trade..." : "Loading trade..."}</DialogTitle>
              <DialogDescription className="sr-only">{language === "fr" ? "Chargement en cours" : "Loading"}</DialogDescription>
            </DialogHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        ) : error ? (
          <div className="p-6">
            <DialogHeader>
              <DialogTitle className="sr-only">{language === "fr" ? "Erreur" : "Error"}</DialogTitle>
              <DialogDescription className="sr-only">{error}</DialogDescription>
            </DialogHeader>
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <AlertTriangle className="w-12 h-12 text-loss/50 mb-4" />
              <p className="text-muted-foreground text-sm">{error}</p>
              <Button variant="outline" size="sm" className="mt-4" onClick={() => handleOpenChange(false)}>
                {language === "fr" ? "Fermer" : "Close"}
              </Button>
            </div>
          </div>
        ) : trade ? (
          <>
            {/* Trade Header */}
            <div className="p-6 border-b border-border bg-muted/30">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3 text-xl">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    isLong ? "bg-profit/10 text-profit" : "bg-loss/10 text-loss"
                  )}>
                    {isLong ? <ArrowUpRight className="w-5 h-5" /> : <ArrowDownRight className="w-5 h-5" />}
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono font-bold text-lg">{trade.pair}</span>
                    <DialogDescription className="sr-only">{trade.pair} {trade.direction} - {trade.date}</DialogDescription>
                    <Badge className={cn(
                      "text-xs font-semibold",
                      isLong ? "bg-profit/15 text-profit border-profit/20" : "bg-loss/15 text-loss border-loss/20"
                    )}>
                      {trade.direction}
                    </Badge>
                    {trade.result && (
                      <Badge className={cn(
                        "text-xs font-semibold",
                        trade.result === "WIN" && "bg-profit/15 text-profit border-profit/20",
                        trade.result === "LOSS" && "bg-loss/15 text-loss border-loss/20",
                        trade.result === "BE" && "bg-gold/15 text-gold border-gold/20"
                      )}>
                        {trade.result}
                      </Badge>
                    )}
                    {trade.setup && (
                      <Badge variant="outline" className="text-xs font-mono">{trade.setup}</Badge>
                    )}
                    {trade.structure && (
                      <Badge variant="outline" className="text-xs">{trade.structure}</Badge>
                    )}
                    {trade.entryModel && (
                      <Badge variant="outline" className="text-xs">{trade.entryModel}</Badge>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3 mt-3 flex-wrap">
                <Badge variant="outline" className="text-xs">{trade.date}</Badge>
                <Badge variant="outline" className="text-xs">{trade.session}</Badge>
                <Badge variant="outline" className="text-xs">{trade.marketCondition}</Badge>
                <Badge variant="outline" className="text-xs font-mono">{trade.timeframe}</Badge>
                {trade.newsEnabled && (
                  <Badge className="text-xs bg-gold/15 text-gold border-gold/20 gap-1"><Newspaper className="w-3 h-3" />News</Badge>
                )}
              </div>
            </div>

            <ScrollArea className="max-h-[60vh]">
              <div className="p-6 space-y-6">
                {/* Key Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                  {/* RR */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1"><Target className="w-3 h-3" />RR</div>
                    <div className={cn("text-2xl font-bold font-mono", trade.rr != null && trade.rr >= 1 && "text-profit", trade.rr != null && trade.rr < 1 && "text-loss")}>
                      {trade.rr != null ? trade.rr.toFixed(2) : "—"}
                    </div>
                  </div>
                  {/* P&L */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1"><DollarSign className="w-3 h-3" />P&L</div>
                    {(() => {
                      const pnl = tradeStats?.pnl ?? trade.pnl;
                      if (pnl == null) return <span className="text-2xl font-bold font-mono text-muted-foreground">—</span>;
                      return (
                        <div className={cn("text-2xl font-bold font-mono", pnl > 0 && "text-profit", pnl < 0 && "text-loss", pnl === 0 && "text-gold")}>
                          {pnl >= 0 ? "+" : ""}{pnl.toFixed(2)}
                        </div>
                      );
                    })()}
                  </div>
                  {/* Result */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1"><BarChart3 className="w-3 h-3" />{t(language, "result")}</div>
                    <div className="flex justify-center mt-1">
                      {trade.result ? (
                        <Badge className={cn("text-sm font-bold px-3 py-1", trade.result === "WIN" && "bg-profit/15 text-profit border-profit/20", trade.result === "LOSS" && "bg-loss/15 text-loss border-loss/20", trade.result === "BE" && "bg-gold/15 text-gold border-gold/20")}>{trade.result}</Badge>
                      ) : <span className="text-muted-foreground">—</span>}
                    </div>
                  </div>
                  {/* Duration */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1"><Clock className="w-3 h-3" />{t(language, "duration")}</div>
                    <div className="text-lg font-bold font-mono">{trade.duration || "—"}</div>
                  </div>

                </div>

                {/* ─── Charts Section ──────────────── */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {language === "fr" ? "Graphiques" : "Charts"}
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* RR PAR TRADE - Bar Chart (10 derniers trades) */}
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                          {t(language, "rrParTrade")}
                        </span>
                        <Badge variant="outline" className="text-[9px]">{t(language, "derniersTrades")}</Badge>
                      </div>
                      {rrBarChart || (
                        <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                          {t(language, "noData")}
                        </div>
                      )}
                    </Card>

                    {/* CUMULE RR ISOLÉ - Curve Chart (for this trade) */}
                    <Card className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                          {t(language, "cumuleRRIsole")}
                        </span>
                      </div>
                      {cumulativeLineChart || (
                        <div className="h-[120px] flex items-center justify-center text-muted-foreground text-sm">
                          {t(language, "noData")}
                        </div>
                      )}
                    </Card>
                  </div>

                  {/* CUMULE TOTAL DE RR */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] uppercase tracking-wider font-semibold text-primary">
                        {t(language, "cumuleTotalRR")}
                      </span>
                      <span className="text-xs text-muted-foreground">{t(language, "depuisPremierTrade")}</span>
                    </div>
                    <div className={cn(
                      "text-3xl font-bold font-mono mt-2",
                      chartData.totalCumulativeRR >= 0 ? "text-profit" : "text-loss"
                    )}>
                      {chartData.totalCumulativeRR >= 0 ? "+" : ""}{chartData.totalCumulativeRR.toFixed(2)} RR
                    </div>
                  </Card>
                </div>

                {/* Price Parameters */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {language === "fr" ? "Paramètres de Prix" : "Price Parameters"}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <ParamCard label={t(language, "entryPrice")} value={trade.entryPrice.toString()} mono />
                    <ParamCard label={t(language, "stopLoss")} value={trade.stopLoss.toString()} mono valueClass="text-loss" />
                    <ParamCard label={t(language, "takeProfit")} value={trade.takeProfit.toString()} mono valueClass="text-profit" />
                    {trade.exitPrice != null && <ParamCard label={t(language, "exitPrice")} value={trade.exitPrice.toString()} mono />}
                    {trade.lotSize != null && <ParamCard label={t(language, "lotSize")} value={trade.lotSize.toString()} mono />}

                    {trade.entryTime && <ParamCard label={t(language, "entryTime")} value={trade.entryTime} mono />}
                    {trade.exitTime && <ParamCard label={t(language, "exitTime")} value={trade.exitTime} mono />}
                  </div>
                </div>

                {/* Trade Context - Structure & Entry Model */}
                {(trade.structure || trade.entryModel) && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === "fr" ? "Contexte du Trade" : "Trade Context"}
                    </h4>
                    <div className="grid grid-cols-2 gap-3">
                      {trade.structure && <ParamCard label={t(language, "structureField")} value={trade.structure} />}
                      {trade.entryModel && <ParamCard label={t(language, "entryModelField")} value={trade.entryModel} />}
                    </div>
                  </div>
                )}

                {/* Trade Statistics */}
                {tradeStats && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === "fr" ? "Statistiques du Trade" : "Trade Statistics"}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard label={language === "fr" ? "Ratio Risk/Reward" : "Risk/Reward Ratio"} value={tradeStats.riskRewardRatio} />
                      <StatCard label={language === "fr" ? "Risque ($)" : "Risk ($)"} value={tradeStats.riskAmount} valueClass="text-loss" />
                      <StatCard label={language === "fr" ? "Récompense ($)" : "Reward ($)"} value={tradeStats.rewardAmount} valueClass="text-profit" />
                      <StatCard label={language === "fr" ? "Efficacité" : "Efficiency"} value={tradeStats.efficiency} />
                    </div>
                  </div>
                )}

                {/* Qualitative Data */}
                {(trade.emotions || trade.confluence || trade.mistakes || trade.lessons) && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === "fr" ? "Données Qualitatives" : "Qualitative Data"}
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {trade.emotions && <QualCard icon={Heart} label={t(language, "emotions")} value={trade.emotions} color="text-pink-400" />}
                      {trade.confluence && <QualCard icon={Layers} label={t(language, "confluence")} value={trade.confluence} color="text-foreground" />}
                      {trade.mistakes && <QualCard icon={AlertTriangle} label={t(language, "mistakes")} value={trade.mistakes} color="text-loss" />}
                      {trade.lessons && <QualCard icon={Lightbulb} label={t(language, "lessons")} value={trade.lessons} color="text-gold" />}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {trade.notes && (
                  <div className="rounded-xl bg-muted/30 p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">{t(language, "notes")}</div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{trade.notes}</p>
                  </div>
                )}

                {/* Screenshots & Videos */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {language === "fr" ? "Captures & Vidéos" : "Screenshots & Videos"}
                    {tradeScreenshots.length > 0 && <span className="ml-1 text-[10px]">({tradeScreenshots.length})</span>}
                  </h4>
                  {tradeScreenshots.length > 0 ? (
                    <div className="grid grid-cols-3 gap-3">
                      {tradeScreenshots.map((screenshot) => {
                        const mediaSrc = resolveScreenshotUrl(screenshot.url);
                        if (!mediaSrc) return null;
                        const isVideo = isVideoUrl(screenshot.url);
                        const typeLabel = (screenshot.type === "context" || screenshot.type === "analysis")
                          ? t(language, "contextScreenshot")
                          : screenshot.type === "entry"
                            ? t(language, "entryScreenshot")
                            : t(language, "exitScreenshot");

                        return (
                          <button
                            key={screenshot.id}
                            onClick={(e) => { e.stopPropagation(); setScreenshotViewerUrl(mediaSrc); }}
                            className="group relative aspect-video rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all duration-200"
                          >
                            {isVideo ? (
                              <video
                                src={mediaSrc}
                                className="w-full h-full object-cover"
                                muted
                                playsInline
                                preload="metadata"
                              />
                            ) : (
                              <img
                                src={mediaSrc}
                                alt={`${screenshot.type} screenshot`}
                                className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                              />
                            )}
                            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                              <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                            </div>
                            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2 flex items-center justify-between">
                              <span className="text-[10px] text-white font-medium uppercase tracking-wider">
                                {typeLabel}
                              </span>
                              {isVideo && (
                                <span className="text-[9px] text-white/70 bg-white/20 rounded px-1">VID</span>
                              )}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground/60 italic">
                      {language === "fr" ? "Aucune capture d'écran" : "No screenshots"}
                    </div>
                  )}
                </div>
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="p-12 text-center">
            <DialogHeader>
              <DialogTitle className="sr-only">{language === "fr" ? "Aucune donnée" : "No data"}</DialogTitle>
            </DialogHeader>
            <p className="text-muted-foreground">{t(language, "noData")}</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ─── Sub-components ──────────────────────────────────────────
function ParamCard({ label, value, mono, valueClass }: { label: string; value: string; mono?: boolean; valueClass?: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-sm font-semibold", mono && "font-mono", valueClass)}>{value}</div>
    </div>
  );
}

function StatCard({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className={cn("text-lg font-bold font-mono", valueClass)}>{value}</div>
    </div>
  );
}

function QualCard({ icon: Icon, label, value, color }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="flex items-center gap-1.5 mb-2">
        <Icon className={cn("w-3.5 h-3.5", color)} />
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">{label}</span>
      </div>
      <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{value}</p>
    </div>
  );
}
