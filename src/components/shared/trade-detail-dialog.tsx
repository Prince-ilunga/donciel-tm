"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
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
  const [trade, setTrade] = useState<TradeDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const prevTradeIdRef = useRef<string | null>(null);

  // Fetch trade data when dialog opens with a specific trade ID
  const fetchTrade = useCallback(async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/trades/${id}`);
      const data = await res.json();
      setTrade(data.trade || data);
    } catch (err) {
      console.error("Error fetching trade:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  // Handle dialog state changes
  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      setShowTradeDetail(false);
      setTrade(null);
      prevTradeIdRef.current = null;
    }
  }, [setShowTradeDetail]);

  // Sync: when dialog opens with a new trade ID, trigger fetch
  useEffect(() => {
    if (showTradeDetail && selectedTradeId && selectedTradeId !== prevTradeIdRef.current) {
      prevTradeIdRef.current = selectedTradeId;
      setTrade(null);
      fetchTrade(selectedTradeId);
    }
    if (!showTradeDetail && prevTradeIdRef.current) {
      prevTradeIdRef.current = null;
      setTrade(null);
    }
  }, [showTradeDetail, selectedTradeId, fetchTrade]);

  const isLong = trade?.direction === "LONG";
  const isWin = trade?.result === "WIN";
  const isLoss = trade?.result === "LOSS";

  // Compute trade statistics
  const tradeStats = useMemo(() => {
    if (!trade) return null;
    const risk = Math.abs(trade.entryPrice - trade.stopLoss);
    const reward = Math.abs(trade.takeProfit - trade.entryPrice);
    const riskRewardRatio = risk > 0 ? (reward / risk).toFixed(2) : "—";
    const riskAmount = trade.lotSize ? (risk * trade.lotSize).toFixed(2) : "—";
    const rewardAmount = trade.lotSize ? (reward * trade.lotSize).toFixed(2) : "—";
    const efficiency = trade.pnl !== null && trade.lotSize && trade.rr
      ? trade.rr > 0 ? ((trade.pnl / (reward * trade.lotSize)) * 100).toFixed(0) : "—"
      : "—";

    return { riskRewardRatio, riskAmount, rewardAmount, efficiency };
  }, [trade]);

  return (
    <Dialog open={showTradeDetail} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] p-0 gap-0 overflow-hidden">
        {/* Header */}
        {loading ? (
          <div className="p-6 space-y-4">
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-64" />
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
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-lg">{trade.pair}</span>
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
                      <Badge variant="outline" className="text-xs font-mono">
                        {trade.setup}
                      </Badge>
                    )}
                  </div>
                </DialogTitle>
              </DialogHeader>
              <div className="flex items-center gap-3 mt-3">
                <Badge variant="outline" className="text-xs">
                  {trade.date}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {trade.session}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  {trade.marketCondition}
                </Badge>
                <Badge variant="outline" className="text-xs font-mono">
                  {trade.timeframe}
                </Badge>
                {trade.newsEnabled && (
                  <Badge className="text-xs bg-gold/15 text-gold border-gold/20 gap-1">
                    <Newspaper className="w-3 h-3" />
                    News
                  </Badge>
                )}
              </div>
            </div>

            <ScrollArea className="max-h-[calc(90vh-140px)]">
              <div className="p-6 space-y-6">
                {/* Key Metrics Row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {/* RR */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                      <Target className="w-3 h-3" />
                      RR
                    </div>
                    <div className={cn(
                      "text-2xl font-bold font-mono",
                      trade.rr !== null && trade.rr >= 1 && "text-profit",
                      trade.rr !== null && trade.rr < 1 && "text-loss"
                    )}>
                      {trade.rr !== null ? trade.rr.toFixed(2) : "—"}
                    </div>
                  </div>

                  {/* P&L */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                      <DollarSign className="w-3 h-3" />
                      P&L
                    </div>
                    <div className={cn(
                      "text-2xl font-bold font-mono",
                      trade.pnl !== null && trade.pnl > 0 && "text-profit",
                      trade.pnl !== null && trade.pnl < 0 && "text-loss",
                      trade.pnl !== null && trade.pnl === 0 && "text-gold"
                    )}>
                      {trade.pnl !== null ? `${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}` : "—"}
                    </div>
                  </div>

                  {/* Result */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                      <BarChart3 className="w-3 h-3" />
                      {t(language, "result")}
                    </div>
                    <div className="flex justify-center mt-1">
                      {trade.result ? (
                        <Badge className={cn(
                          "text-sm font-bold px-3 py-1",
                          trade.result === "WIN" && "bg-profit/15 text-profit border-profit/20",
                          trade.result === "LOSS" && "bg-loss/15 text-loss border-loss/20",
                          trade.result === "BE" && "bg-gold/15 text-gold border-gold/20"
                        )}>
                          {trade.result}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </div>
                  </div>

                  {/* Duration */}
                  <div className="rounded-xl border border-border p-3 text-center">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" />
                      {t(language, "duration")}
                    </div>
                    <div className="text-lg font-bold font-mono">
                      {trade.duration || "—"}
                    </div>
                  </div>
                </div>

                {/* Price Parameters */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                    {language === "fr" ? "Paramètres de Prix" : "Price Parameters"}
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    <ParamCard
                      label={t(language, "entryPrice")}
                      value={trade.entryPrice.toFixed(2)}
                      mono
                    />
                    <ParamCard
                      label={t(language, "stopLoss")}
                      value={trade.stopLoss.toFixed(2)}
                      mono
                      valueClass="text-loss"
                    />
                    <ParamCard
                      label={t(language, "takeProfit")}
                      value={trade.takeProfit.toFixed(2)}
                      mono
                      valueClass="text-profit"
                    />
                    {trade.exitPrice !== null && (
                      <ParamCard
                        label={t(language, "exitPrice")}
                        value={trade.exitPrice.toFixed(2)}
                        mono
                      />
                    )}
                    {trade.lotSize !== null && (
                      <ParamCard
                        label={t(language, "lotSize")}
                        value={trade.lotSize.toString()}
                        mono
                      />
                    )}
                    {trade.entryTime && (
                      <ParamCard
                        label={t(language, "entryTime")}
                        value={trade.entryTime}
                        mono
                      />
                    )}
                    {trade.exitTime && (
                      <ParamCard
                        label={t(language, "exitTime")}
                        value={trade.exitTime}
                        mono
                      />
                    )}
                  </div>
                </div>

                {/* Trade Statistics */}
                {tradeStats && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {language === "fr" ? "Statistiques du Trade" : "Trade Statistics"}
                    </h4>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <StatCard
                        label={language === "fr" ? "Ratio Risk/Reward" : "Risk/Reward Ratio"}
                        value={tradeStats.riskRewardRatio}
                      />
                      <StatCard
                        label={language === "fr" ? "Risque ($)" : "Risk ($)"}
                        value={tradeStats.riskAmount}
                        valueClass="text-loss"
                      />
                      <StatCard
                        label={language === "fr" ? "Récompense ($)" : "Reward ($)"}
                        value={tradeStats.rewardAmount}
                        valueClass="text-profit"
                      />
                      <StatCard
                        label={language === "fr" ? "Efficacité" : "Efficiency"}
                        value={tradeStats.efficiency !== "—" ? `${tradeStats.efficiency}%` : "—"}
                      />
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
                      {trade.emotions && (
                        <QualCard
                          icon={Heart}
                          label={t(language, "emotions")}
                          value={trade.emotions}
                          color="text-pink-400"
                        />
                      )}
                      {trade.confluence && (
                        <QualCard
                          icon={Layers}
                          label={t(language, "confluence")}
                          value={trade.confluence}
                          color="text-foreground"
                        />
                      )}
                      {trade.mistakes && (
                        <QualCard
                          icon={AlertTriangle}
                          label={t(language, "mistakes")}
                          value={trade.mistakes}
                          color="text-loss"
                        />
                      )}
                      {trade.lessons && (
                        <QualCard
                          icon={Lightbulb}
                          label={t(language, "lessons")}
                          value={trade.lessons}
                          color="text-gold"
                        />
                      )}
                    </div>
                  </div>
                )}

                {/* Notes */}
                {trade.notes && (
                  <div className="rounded-xl bg-muted/30 p-4">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">
                      {t(language, "notes")}
                    </div>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">
                      {trade.notes}
                    </p>
                  </div>
                )}

                {/* Screenshots */}
                {trade.screenshots && trade.screenshots.length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                      {t(language, "screenshots")}
                    </h4>
                    <div className="grid grid-cols-3 gap-3">
                      {trade.screenshots.map((screenshot) => {
                        const imgSrc = screenshot.url.startsWith('upload/screenshots/')
                          ? `/api/screenshots/${screenshot.url.replace('upload/screenshots/', '')}`
                          : screenshot.url;
                        return (
                        <button
                          key={screenshot.id}
                          onClick={(e) => {
                            e.stopPropagation();
                            setScreenshotViewerUrl(imgSrc);
                          }}
                          className="group relative aspect-video rounded-xl overflow-hidden border border-border hover:border-foreground/30 transition-all duration-200"
                        >
                          <img
                            src={imgSrc}
                            alt={`${screenshot.type} screenshot`}
                            className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105"
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                            <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                            <span className="text-[10px] text-white font-medium uppercase tracking-wider">
                              {screenshot.type === "analysis"
                                ? t(language, "analysisScreenshot")
                                : screenshot.type === "entry"
                                ? t(language, "entryScreenshot")
                                : t(language, "exitScreenshot")}
                            </span>
                          </div>
                        </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </>
        ) : (
          <div className="p-12 text-center">
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
