"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useStats, useTrades } from "@/lib/hooks";
import { MetricCard } from "@/components/shared/metric-card";
import { cn, getContractSize } from "@/lib/utils";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Plus,
  TrendingUp,
  TrendingDown,
  BarChart3,
  Target,
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CalendarIcon,
  Upload,
  X,
  Calculator,
  Clock,
  Loader2,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Constants ───────────────────────────────────────────────
const DEFAULT_PAIRS = ["XAUUSD", "US30", "US100", "EURUSD", "GBPUSD"];
const SESSIONS = ["LONDON", "NEW YORK", "ASIE", "OVERLAP", "MACRO CHER", "MACRO PEU CHER"];
const MARKET_CONDITIONS = ["CONTINUATION", "RETRACEMENT"];
const TIMEFRAMES_ANALYSIS = ["M15", "M30", "H1", "H4", "D1", "W1"];
const TIMEFRAMES_ENTRY = ["M1", "M5", "M15", "M30", "H1"];
const SETUPS = ["SETUP A", "SETUP A+", "SETUP B", "SETUP B+", "SETUP C"];

// ─── Types ───────────────────────────────────────────────────
interface TradeFormData {
  date: string;
  pair: string;
  customPair: string;
  direction: "LONG" | "SHORT";
  session: string;
  marketCondition: string;
  timeframeAnalysis: string;
  timeframeEntry: string;
  setup: string;
  structure: string;
  entryModel: string;
  amountToWin: string;
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  exitPrice: string;
  entryTime: string;
  exitTime: string;
  lotSize: string;
  newsEnabled: boolean;
  emotions: string;
  confluence: string;
  mistakes: string;
  lessons: string;
  notes: string;
  analysisFile: File | null;
  entryFile: File | null;
  exitFile: File | null;
}

const STRUCTURES = ["HAUSSIÈRE", "BAISSIÈRE", "RANGE"];
const ENTRY_MODELS = ["ANGLOBANTE", "LOT À 3 BOUGIES", "MARKET SHIFT"];

const initialFormData: TradeFormData = {
  date: format(new Date(), "yyyy-MM-dd"),
  pair: "",
  customPair: "",
  direction: "LONG",
  session: "",
  marketCondition: "",
  timeframeAnalysis: "",
  timeframeEntry: "",
  setup: "",
  structure: "",
  entryModel: "",
  amountToWin: "",
  entryPrice: "",
  stopLoss: "",
  takeProfit: "",
  exitPrice: "",
  entryTime: "",
  exitTime: "",
  lotSize: "",
  newsEnabled: false,
  emotions: "",
  confluence: "",
  mistakes: "",
  lessons: "",
  notes: "",
  analysisFile: null,
  entryFile: null,
  exitFile: null,
};

// ─── Auto-Calculator ─────────────────────────────────────────
function calculateAuto(formData: TradeFormData) {
  const entryPrice = parseFloat(formData.entryPrice);
  const stopLoss = parseFloat(formData.stopLoss);
  const takeProfit = parseFloat(formData.takeProfit);
  const exitPrice = parseFloat(formData.exitPrice);
  const lotSize = parseFloat(formData.lotSize);

  const result: {
    rr: number | null;
    pnl: number | null;
    resultLabel: "WIN" | "LOSS" | "BE" | null;
    duration: string | null;
  } = { rr: null, pnl: null, resultLabel: null, duration: null };

  // RR calculation
  if (!isNaN(entryPrice) && !isNaN(stopLoss) && !isNaN(takeProfit)) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    if (risk > 0) {
      result.rr = parseFloat((reward / risk).toFixed(2));
    }
  }

  // P&L calculation using contract size
  if (!isNaN(exitPrice) && !isNaN(entryPrice) && !isNaN(lotSize) && formData.exitPrice !== "") {
    const priceDiff = formData.direction === "LONG"
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
    const contractSize = getContractSize(formData.pair);
    result.pnl = parseFloat((priceDiff * lotSize * contractSize).toFixed(2));
  }

  // Result determination
  if (!isNaN(exitPrice) && !isNaN(entryPrice) && !isNaN(stopLoss) && !isNaN(takeProfit) && formData.exitPrice !== "") {
    if (formData.direction === "LONG") {
      if (exitPrice >= takeProfit) result.resultLabel = "WIN";
      else if (exitPrice <= stopLoss) result.resultLabel = "LOSS";
      else result.resultLabel = "BE";
    } else {
      if (exitPrice <= takeProfit) result.resultLabel = "WIN";
      else if (exitPrice >= stopLoss) result.resultLabel = "LOSS";
      else result.resultLabel = "BE";
    }
    // Adjust RR based on result to match backend logic
    if (result.resultLabel === "LOSS") {
      result.rr = -1;
    } else if (result.resultLabel === "BE" && !isNaN(exitPrice) && formData.exitPrice !== "") {
      // Calculate partial RR for BE: actual price movement / risk
      const risk = Math.abs(entryPrice - stopLoss);
      if (risk > 0) {
        const priceDiff = formData.direction === "LONG"
          ? exitPrice - entryPrice
          : entryPrice - exitPrice;
        result.rr = parseFloat((priceDiff / risk).toFixed(2));
      }
    }
  } else if (result.rr !== null && result.rr >= 1 && isNaN(exitPrice)) {
    // If only RR is known and >= 1, we can't determine result without exit price
  }

  // Duration calculation
  if (formData.entryTime && formData.exitTime) {
    const [eH, eM] = formData.entryTime.split(":").map(Number);
    const [xH, xM] = formData.exitTime.split(":").map(Number);
    if (!isNaN(eH) && !isNaN(eM) && !isNaN(xH) && !isNaN(xM)) {
      let totalMinutes = (xH * 60 + xM) - (eH * 60 + eM);
      if (totalMinutes < 0) totalMinutes += 24 * 60; // Crosses midnight
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      result.duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
    }
  }

  return result;
}

// ─── Main Component ──────────────────────────────────────────
export function DashboardTab() {
  const { language, showTradeForm, setShowTradeForm, setSelectedTradeId, setShowTradeDetail } = useAppStore();
  const { stats, loading: statsLoading, refetch: refetchStats } = useStats();
  const { trades, loading: tradesLoading, refetch: refetchTrades } = useTrades();

  // Fetch data on mount
  useEffect(() => {
    refetchStats();
    refetchTrades();
  }, [refetchStats, refetchTrades]);

  // Stats data - API returns { stats: { ... } }
  const statsData = (stats as any)?.stats ?? stats;

  const recentTrades = useMemo(() => trades.slice(0, 10), [trades]);

  const handleTradeClick = (tradeId: string) => {
    setSelectedTradeId(tradeId);
    setShowTradeDetail(true);
  };

  const handleTradeCreated = useCallback(() => {
    refetchTrades();
    refetchStats();
  }, [refetchTrades, refetchStats]);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            DONCIEL<sup className="text-[10px] text-primary ml-0.5">TM</sup>
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr" ? "Vue d'ensemble de vos performances" : "Overview of your performance"}
          </p>
        </div>
        <Button
          onClick={() => setShowTradeForm(true)}
          className="gap-2 shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all duration-300"
          size="lg"
        >
          <Plus className="w-4 h-4" />
          {t(language, "addTrade")}
        </Button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 md:gap-4">
        {statsLoading ? (
          Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4 metric-glow">
              <Skeleton className="h-3 w-20 mb-2" />
              <Skeleton className="h-8 w-16" />
            </Card>
          ))
        ) : (
          <>
            <MetricCard
              label={t(language, "totalTrades")}
              value={statsData?.totalTrades ?? 0}
              icon={BarChart3}
              trend="neutral"
            />
            <MetricCard
              label={t(language, "winRate")}
              value={`${(statsData?.winRate ?? 0).toFixed(1)}%`}
              icon={statsData?.winRate >= 50 ? TrendingUp : TrendingDown}
              trend={statsData?.winRate >= 50 ? "up" : "down"}
            />
            <MetricCard
              label={t(language, "totalRR")}
              value={(statsData?.totalRR ?? 0).toFixed(2)}
              icon={Target}
              trend={statsData?.totalRR > 0 ? "up" : "neutral"}
            />
            <MetricCard
              label={t(language, "avgRR")}
              value={(statsData?.avgRR ?? 0).toFixed(2)}
              icon={Calculator}
              trend={statsData?.avgRR > 0 ? "up" : "neutral"}
            />
            <MetricCard
              label={t(language, "totalPnL")}
              value={`${(statsData?.totalPnL ?? 0) >= 0 ? "+" : ""}${(statsData?.totalPnL ?? 0).toFixed(2)}`}
              icon={DollarSign}
              trend={(statsData?.totalPnL ?? 0) > 0 ? "up" : (statsData?.totalPnL ?? 0) < 0 ? "down" : "neutral"}
            />
          </>
        )}
      </div>

      {/* Quick Stats Badges */}
      {!statsLoading && statsData && (
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className="text-profit border-profit/30 bg-profit/5 gap-1">
            <TrendingUp className="w-3 h-3" />
            {statsData.wins ?? 0} {t(language, "win")}
          </Badge>
          <Badge variant="outline" className="text-loss border-loss/30 bg-loss/5 gap-1">
            <TrendingDown className="w-3 h-3" />
            {statsData.losses ?? 0} {t(language, "loss")}
          </Badge>
          <Badge variant="outline" className="text-gold border-gold/30 bg-gold/5 gap-1">
            <Minus className="w-3 h-3" />
            {statsData.bes ?? 0} {t(language, "be")}
          </Badge>
          {statsData.profitFactor > 0 && (
            <Badge variant="outline" className="border-border gap-1">
              PF: {statsData.profitFactor === Infinity ? "∞" : statsData.profitFactor.toFixed(2)}
            </Badge>
          )}
        </div>
      )}

      {/* Recent Trades */}
      <Card className="overflow-hidden">
        <div className="p-4 md:p-6 border-b border-border">
          <div className="flex items-center justify-between">
            <h3 className="text-lg font-semibold">
              {language === "fr" ? "Trades Récents" : "Recent Trades"}
            </h3>
            <Badge variant="secondary" className="text-xs">
              {trades.length} {language === "fr" ? "total" : "total"}
            </Badge>
          </div>
        </div>

        {tradesLoading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : recentTrades.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{t(language, "noData")}</p>
            <p className="text-sm text-muted-foreground/70 mt-1">
              {language === "fr" ? "Ajoutez votre premier trade pour commencer" : "Add your first trade to get started"}
            </p>
            <Button
              onClick={() => setShowTradeForm(true)}
              variant="outline"
              className="mt-4 gap-2"
            >
              <Plus className="w-4 h-4" />
              {t(language, "addTrade")}
            </Button>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "date")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "pair")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "direction")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "session")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "rr")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "pnl")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "result")}</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentTrades.map((trade) => (
                    <TableRow
                      key={trade.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => handleTradeClick(trade.id)}
                    >
                      <TableCell className="text-sm">
                        {trade.date ? format(new Date(trade.date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-xs">
                          {trade.pair}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold",
                          trade.direction === "LONG" ? "text-profit" : "text-loss"
                        )}>
                          {trade.direction === "LONG" ? (
                            <ArrowUpRight className="w-3 h-3" />
                          ) : (
                            <ArrowDownRight className="w-3 h-3" />
                          )}
                          {trade.direction}
                        </span>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {trade.session}
                      </TableCell>
                      <TableCell className="font-mono text-sm font-medium">
                        {trade.rr !== null ? trade.rr.toFixed(2) : "—"}
                      </TableCell>
                      <TableCell className={cn(
                        "font-mono text-sm font-semibold",
                        trade.pnl !== null && trade.pnl > 0 && "text-profit",
                        trade.pnl !== null && trade.pnl < 0 && "text-loss",
                        trade.pnl !== null && trade.pnl === 0 && "text-gold"
                      )}>
                        {trade.pnl !== null ? `${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}` : "—"}
                      </TableCell>
                      <TableCell>
                        <ResultBadge result={trade.result} language={language} />
                      </TableCell>
                      <TableCell>
                        <Eye className="w-4 h-4 text-muted-foreground/50" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {recentTrades.map((trade) => (
                <button
                  key={trade.id}
                  onClick={() => handleTradeClick(trade.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center shrink-0",
                      trade.result === "WIN" && "bg-profit/10 text-profit",
                      trade.result === "LOSS" && "bg-loss/10 text-loss",
                      trade.result === "BE" && "bg-gold/10 text-gold",
                      !trade.result && "bg-muted text-muted-foreground"
                    )}>
                      {trade.direction === "LONG" ? (
                        <ArrowUpRight className="w-4 h-4" />
                      ) : (
                        <ArrowDownRight className="w-4 h-4" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{trade.pair}</span>
                        <ResultBadge result={trade.result} language={language} size="sm" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                        <span>{trade.date ? format(new Date(trade.date), "dd/MM") : "—"}</span>
                        <span>•</span>
                        <span>{trade.session}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <div className={cn(
                      "font-mono text-sm font-semibold",
                      trade.pnl !== null && trade.pnl > 0 && "text-profit",
                      trade.pnl !== null && trade.pnl < 0 && "text-loss",
                      trade.pnl !== null && trade.pnl === 0 && "text-gold"
                    )}>
                      {trade.pnl !== null ? `${trade.pnl >= 0 ? "+" : ""}${trade.pnl.toFixed(2)}` : "—"}
                    </div>
                    {trade.rr !== null && (
                      <div className="text-xs text-muted-foreground font-mono">
                        RR: {trade.rr.toFixed(2)}
                      </div>
                    )}
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Trade Form Dialog */}
      <TradeFormDialog
        open={showTradeForm}
        onOpenChange={setShowTradeForm}
        language={language}
        onTradeCreated={handleTradeCreated}
      />
    </div>
  );
}

// ─── Result Badge ────────────────────────────────────────────
function ResultBadge({ result, language, size = "default" }: { result: string | null; language: "fr" | "en"; size?: "default" | "sm" }) {
  if (!result) return <span className="text-muted-foreground text-xs">—</span>;

  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs";

  if (result === "WIN") {
    return (
      <Badge className={cn("bg-profit/15 text-profit border-profit/20 hover:bg-profit/20", sizeClass)}>
        {t(language, "win")}
      </Badge>
    );
  }
  if (result === "LOSS") {
    return (
      <Badge className={cn("bg-loss/15 text-loss border-loss/20 hover:bg-loss/20", sizeClass)}>
        {t(language, "loss")}
      </Badge>
    );
  }
  return (
    <Badge className={cn("bg-gold/15 text-gold border-gold/20 hover:bg-gold/20", sizeClass)}>
      {t(language, "be")}
    </Badge>
  );
}

// ─── Trade Form Dialog ───────────────────────────────────────
function TradeFormDialog({
  open,
  onOpenChange,
  language,
  onTradeCreated,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "fr" | "en";
  onTradeCreated: () => void;
}) {
  const [formData, setFormData] = useState<TradeFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomPair, setShowCustomPair] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const analysisRef = useRef<HTMLInputElement>(null);
  const entryFileRef = useRef<HTMLInputElement>(null);
  const exitFileRef = useRef<HTMLInputElement>(null);

  // Auto-calculator
  const autoCalc = useMemo(() => calculateAuto(formData), [formData]);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setFormData({
        ...initialFormData,
        date: format(new Date(), "yyyy-MM-dd"),
      });
      setShowCustomPair(false);
    }
  }, [open]);

  const updateField = useCallback(<K extends keyof TradeFormData>(key: K, value: TradeFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePairChange = useCallback((value: string) => {
    if (value === "__custom__") {
      setShowCustomPair(true);
      updateField("pair", "");
    } else {
      setShowCustomPair(false);
      updateField("pair", value);
    }
  }, [updateField]);

  const handleFileChange = useCallback((key: "analysisFile" | "entryFile" | "exitFile", file: File | null) => {
    updateField(key, file);
  }, [updateField]);

  const handleSubmit = async () => {
    // Validation
    if (!formData.date) {
      toast.error(language === "fr" ? "La date est requise" : "Date is required");
      return;
    }
    if (!formData.pair && !formData.customPair) {
      toast.error(language === "fr" ? "La paire est requise" : "Pair is required");
      return;
    }
    if (!formData.direction) {
      toast.error(language === "fr" ? "La direction est requise" : "Direction is required");
      return;
    }
    if (!formData.session) {
      toast.error(language === "fr" ? "La session est requise" : "Session is required");
      return;
    }
    if (!formData.marketCondition) {
      toast.error(language === "fr" ? "La condition du marché est requise" : "Market condition is required");
      return;
    }
    if (!formData.timeframeAnalysis) {
      toast.error(language === "fr" ? "Le timeframe d'analyse est requis" : "Analysis timeframe is required");
      return;
    }
    if (!formData.timeframeEntry) {
      toast.error(language === "fr" ? "Le timeframe d'entrée est requis" : "Entry timeframe is required");
      return;
    }
    if (!formData.entryPrice || isNaN(parseFloat(formData.entryPrice))) {
      toast.error(language === "fr" ? "Le prix d'entrée est requis" : "Entry price is required");
      return;
    }
    if (!formData.stopLoss || isNaN(parseFloat(formData.stopLoss))) {
      toast.error(language === "fr" ? "Le stop loss est requis" : "Stop loss is required");
      return;
    }
    if (!formData.takeProfit || isNaN(parseFloat(formData.takeProfit))) {
      toast.error(language === "fr" ? "Le take profit est requis" : "Take profit is required");
      return;
    }

    setIsSubmitting(true);

    try {
      const pair = showCustomPair ? formData.customPair.toUpperCase() : formData.pair;
      const exitPrice = formData.exitPrice !== "" ? parseFloat(formData.exitPrice) : null;
      const lotSize = formData.lotSize !== "" ? parseFloat(formData.lotSize) : null;

      const tradeData: Record<string, unknown> = {
        date: formData.date,
        pair,
        direction: formData.direction,
        session: formData.session,
        marketCondition: formData.marketCondition,
        timeframe: `${formData.timeframeAnalysis}/${formData.timeframeEntry}`,
        setup: formData.setup || null,
        structure: formData.structure || null,
        entryModel: formData.entryModel || null,
        amountToWin: formData.amountToWin ? parseFloat(formData.amountToWin) : null,
        entryPrice: parseFloat(formData.entryPrice),
        stopLoss: parseFloat(formData.stopLoss),
        takeProfit: parseFloat(formData.takeProfit),
        exitPrice,
        entryTime: formData.entryTime || null,
        exitTime: formData.exitTime || null,
        duration: autoCalc.duration || null,
        lotSize,
        rr: autoCalc.rr,
        pnl: autoCalc.pnl,
        result: autoCalc.resultLabel,
        newsEnabled: formData.newsEnabled,
        emotions: formData.emotions || null,
        confluence: formData.confluence || null,
        mistakes: formData.mistakes || null,
        lessons: formData.lessons || null,
        notes: formData.notes || null,
      };

      const res = await fetch("/api/trades", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(tradeData),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Error creating trade");
      }

      const { trade } = await res.json();

      // Upload screenshots if any
      const uploadPromises: Promise<void>[] = [];
      const files: { file: File | null; type: string }[] = [
        { file: formData.analysisFile, type: "analysis" },
        { file: formData.entryFile, type: "entry" },
        { file: formData.exitFile, type: "exit" },
      ];

      for (const { file, type } of files) {
        if (file && trade?.id) {
          uploadPromises.push(
            (async () => {
              const fd = new FormData();
              fd.append("file", file);
              fd.append("tradeId", trade.id);
              fd.append("type", type);
              const uploadRes = await fetch("/api/upload", { method: "POST", body: fd });
              if (!uploadRes.ok) {
                console.error(`Failed to upload ${type} screenshot`);
                toast.warning(language === "fr" ? `Capture "${type}" non sauvegardée` : `"${type}" screenshot not saved`);
              }
            })()
          );
        }
      }

      await Promise.all(uploadPromises);

      toast.success(language === "fr" ? "Trade ajouté avec succès !" : "Trade added successfully!");
      onOpenChange(false);
      onTradeCreated();
    } catch (error: any) {
      toast.error(error.message || (language === "fr" ? "Erreur lors de la création" : "Error creating trade"));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] p-0 gap-0 overflow-hidden flex flex-col">
        <div className="p-6 border-b border-border shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                <Plus className="w-4 h-4 text-primary" />
              </div>
              {t(language, "tradeForm")}
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              {language === "fr" ? "Remplissez les détails de votre trade" : "Fill in your trade details"}
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Auto-calculator display */}
            {(autoCalc.rr !== null || autoCalc.pnl !== null || autoCalc.resultLabel !== null) && (
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                  <Calculator className="w-4 h-4" />
                  {language === "fr" ? "Calculs Automatiques" : "Auto-Calculated"}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {autoCalc.rr !== null && (
                    <div className="text-center p-2 rounded-lg bg-background/50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">RR</div>
                      <div className={cn(
                        "text-lg font-bold font-mono",
                        autoCalc.rr >= 1 ? "text-profit" : "text-loss"
                      )}>
                        {autoCalc.rr.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {autoCalc.pnl !== null && (
                    <div className="text-center p-2 rounded-lg bg-background/50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">P&L</div>
                      <div className={cn(
                        "text-lg font-bold font-mono",
                        autoCalc.pnl > 0 ? "text-profit" : autoCalc.pnl < 0 ? "text-loss" : "text-gold"
                      )}>
                        {autoCalc.pnl >= 0 ? "+" : ""}{autoCalc.pnl.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {autoCalc.resultLabel && (
                    <div className="text-center p-2 rounded-lg bg-background/50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        {t(language, "result")}
                      </div>
                      <ResultBadge result={autoCalc.resultLabel} language={language} />
                    </div>
                  )}
                  {autoCalc.duration && (
                    <div className="text-center p-2 rounded-lg bg-background/50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
                        <Clock className="w-3 h-3 inline mr-0.5" />
                        {t(language, "duration")}
                      </div>
                      <div className="text-sm font-semibold font-mono">{autoCalc.duration}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Core Trade Info ──────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "fr" ? "Informations du Trade" : "Trade Information"}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "date")} *</Label>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className={cn(
                          "w-full justify-start text-left font-normal h-9",
                          !formData.date && "text-muted-foreground"
                        )}
                      >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? format(new Date(formData.date), "dd/MM/yyyy") : language === "fr" ? "Sélectionner une date" : "Pick a date"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={formData.date ? new Date(formData.date) : undefined}
                        onSelect={(date) => {
                          if (date) {
                            updateField("date", format(date, "yyyy-MM-dd"));
                            setDateOpen(false);
                          }
                        }}
                        initialFocus
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* Pair */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "pair")} *</Label>
                  {!showCustomPair ? (
                    <Select value={formData.pair} onValueChange={handlePairChange}>
                      <SelectTrigger className="w-full h-9">
                        <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                      </SelectTrigger>
                      <SelectContent>
                        {DEFAULT_PAIRS.map((p) => (
                          <SelectItem key={p} value={p}>
                            <span className="font-mono">{p}</span>
                          </SelectItem>
                        ))}
                        <SelectSeparator />
                        <SelectItem value="__custom__">
                          <span className="text-primary text-xs">{t(language, "customPair")}</span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input
                        placeholder="EURJPY"
                        value={formData.customPair}
                        onChange={(e) => updateField("customPair", e.target.value.toUpperCase())}
                        className="h-9 font-mono"
                      />
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setShowCustomPair(false);
                          updateField("customPair", "");
                        }}
                        className="shrink-0 h-9 px-2"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </div>

                {/* Direction */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "direction")} *</Label>
                  <ToggleGroup
                    type="single"
                    value={formData.direction}
                    onValueChange={(val) => {
                      if (val) updateField("direction", val as "LONG" | "SHORT");
                    }}
                    className="w-full"
                  >
                    <ToggleGroupItem
                      value="LONG"
                      className="flex-1 data-[state=on]:bg-profit/15 data-[state=on]:text-profit data-[state=on]:border-profit/30 h-9 text-sm font-semibold gap-1"
                    >
                      <ArrowUpRight className="w-3.5 h-3.5" />
                      {t(language, "long")}
                    </ToggleGroupItem>
                    <ToggleGroupItem
                      value="SHORT"
                      className="flex-1 data-[state=on]:bg-loss/15 data-[state=on]:text-loss data-[state=on]:border-loss/30 h-9 text-sm font-semibold gap-1"
                    >
                      <ArrowDownRight className="w-3.5 h-3.5" />
                      {t(language, "short")}
                    </ToggleGroupItem>
                  </ToggleGroup>
                </div>

                {/* Session */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "session")} *</Label>
                  <Select value={formData.session} onValueChange={(v) => updateField("session", v)}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {SESSIONS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {t(language, s.toLowerCase().replace(/\s+/g, "") as any) || s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Market Condition */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "marketCondition")} *</Label>
                  <Select value={formData.marketCondition} onValueChange={(v) => updateField("marketCondition", v)}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {MARKET_CONDITIONS.map((mc) => (
                        <SelectItem key={mc} value={mc}>
                          {t(language, mc.toLowerCase() as any) || mc}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timeframe Analysis */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">
                    {language === "fr" ? "TF Analyse" : "Analysis TF"} *
                  </Label>
                  <Select value={formData.timeframeAnalysis} onValueChange={(v) => updateField("timeframeAnalysis", v)}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES_ANALYSIS.map((tf) => (
                        <SelectItem key={tf} value={tf}>
                          <span className="font-mono">{tf}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Timeframe Entry */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">
                    {language === "fr" ? "TF Entrée" : "Entry TF"} *
                  </Label>
                  <Select value={formData.timeframeEntry} onValueChange={(v) => updateField("timeframeEntry", v)}>
                    <SelectTrigger className="w-full h-9">
                      <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES_ENTRY.map((tf) => (
                        <SelectItem key={tf} value={tf}>
                          <span className="font-mono">{tf}</span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Setup */}
              <div className="space-y-1.5 trade-field">
                <Label className="text-xs font-medium">{t(language, "setup")}</Label>
                <Select value={formData.setup} onValueChange={(v) => updateField("setup", v)}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder={language === "fr" ? "Sélectionner un setup" : "Select a setup"} />
                  </SelectTrigger>
                  <SelectContent>
                    {SETUPS.map((s) => (
                      <SelectItem key={s} value={s}>
                        <span className="font-mono font-semibold">{s}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Structure */}
              <div className="space-y-1.5 trade-field">
                <Label className="text-xs font-medium">{t(language, "structureField")}</Label>
                <Select value={formData.structure} onValueChange={(v) => updateField("structure", v)}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    {STRUCTURES.map((st) => (
                      <SelectItem key={st} value={st}>
                        {t(language, st.toLowerCase().replace(/è/g, "e").replace(/é/g, "e") as any) || st}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Entry Model */}
              <div className="space-y-1.5 trade-field">
                <Label className="text-xs font-medium">{t(language, "entryModelField")}</Label>
                <Select value={formData.entryModel} onValueChange={(v) => updateField("entryModel", v)}>
                  <SelectTrigger className="w-full h-9">
                    <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                  </SelectTrigger>
                  <SelectContent>
                    {ENTRY_MODELS.map((em) => (
                      <SelectItem key={em} value={em}>
                        {em}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <Separator />

            {/* ─── Price & Timing ──────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "fr" ? "Prix & Timing" : "Price & Timing"}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Entry Price */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "entryPrice")} *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formData.entryPrice}
                    onChange={(e) => updateField("entryPrice", e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>

                {/* Stop Loss */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium text-loss">{t(language, "stopLoss")} *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formData.stopLoss}
                    onChange={(e) => updateField("stopLoss", e.target.value)}
                    className="h-9 font-mono border-loss/30 focus-visible:border-loss/50"
                  />
                </div>

                {/* Take Profit */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium text-profit">{t(language, "takeProfit")} *</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formData.takeProfit}
                    onChange={(e) => updateField("takeProfit", e.target.value)}
                    className="h-9 font-mono border-profit/30 focus-visible:border-profit/50"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Exit Price */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "exitPrice")}</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00 (optionnel)"
                    value={formData.exitPrice}
                    onChange={(e) => updateField("exitPrice", e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>

                {/* Lot Size */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "lotSize")}</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.01"
                    value={formData.lotSize}
                    onChange={(e) => updateField("lotSize", e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>

                {/* Amount to Win */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "amountToWin")}</Label>
                  <Input
                    type="number"
                    step="any"
                    placeholder="0.00"
                    value={formData.amountToWin}
                    onChange={(e) => updateField("amountToWin", e.target.value)}
                    className="h-9 font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {/* Entry Time */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "entryTime")}</Label>
                  <Input
                    type="time"
                    value={formData.entryTime}
                    onChange={(e) => updateField("entryTime", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Exit Time */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "exitTime")}</Label>
                  <Input
                    type="time"
                    value={formData.exitTime}
                    onChange={(e) => updateField("exitTime", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Duration (auto) */}
                {autoCalc.duration && (
                  <div className="space-y-1.5 col-span-2">
                    <Label className="text-xs font-medium">{t(language, "duration")}</Label>
                    <div className="h-9 px-3 flex items-center rounded-md border border-primary/20 bg-primary/5 text-sm font-mono">
                      <Clock className="w-3.5 h-3.5 mr-2 text-primary" />
                      {autoCalc.duration}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            {/* ─── Psychology & Notes ─────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "fr" ? "Psychologie & Notes" : "Psychology & Notes"}
              </h4>

              {/* News Toggle */}
              <div className="flex items-center justify-between trade-field p-3 rounded-lg border border-border bg-muted/30">
                <Label className="text-xs font-medium cursor-pointer">{t(language, "news")}</Label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">
                    {formData.newsEnabled ? t(language, "yes") : t(language, "no")}
                  </span>
                  <Switch
                    checked={formData.newsEnabled}
                    onCheckedChange={(checked) => updateField("newsEnabled", checked)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Emotions */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "emotions")}</Label>
                  <Input
                    placeholder={language === "fr" ? "Confiant, stressé..." : "Confident, stressed..."}
                    value={formData.emotions}
                    onChange={(e) => updateField("emotions", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Confluences */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "confluence")}</Label>
                  <Input
                    placeholder={language === "fr" ? "S/R, trend, OB..." : "S/R, trend, OB..."}
                    value={formData.confluence}
                    onChange={(e) => updateField("confluence", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Mistakes */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "mistakes")}</Label>
                  <Input
                    placeholder={language === "fr" ? "Entrée trop tôt..." : "Entry too early..."}
                    value={formData.mistakes}
                    onChange={(e) => updateField("mistakes", e.target.value)}
                    className="h-9"
                  />
                </div>

                {/* Lessons */}
                <div className="space-y-1.5 trade-field">
                  <Label className="text-xs font-medium">{t(language, "lessons")}</Label>
                  <Input
                    placeholder={language === "fr" ? "Attendre la confirmation..." : "Wait for confirmation..."}
                    value={formData.lessons}
                    onChange={(e) => updateField("lessons", e.target.value)}
                    className="h-9"
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="space-y-1.5 trade-field">
                <Label className="text-xs font-medium">{t(language, "notes")}</Label>
                <Textarea
                  placeholder={language === "fr" ? "Notes supplémentaires..." : "Additional notes..."}
                  value={formData.notes}
                  onChange={(e) => updateField("notes", e.target.value)}
                  className="min-h-[80px] resize-none"
                />
              </div>
            </div>

            <Separator />

            {/* ─── Screenshots ────────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t(language, "screenshots")}
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Analysis Screenshot */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "analysisScreenshot")}</Label>
                  <FileUpload
                    ref={analysisRef}
                    file={formData.analysisFile}
                    onChange={(f) => handleFileChange("analysisFile", f)}
                    language={language}
                  />
                </div>

                {/* Entry Screenshot */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "entryScreenshot")}</Label>
                  <FileUpload
                    ref={entryFileRef}
                    file={formData.entryFile}
                    onChange={(f) => handleFileChange("entryFile", f)}
                    language={language}
                  />
                </div>

                {/* Exit Screenshot */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "exitScreenshot")}</Label>
                  <FileUpload
                    ref={exitFileRef}
                    file={formData.exitFile}
                    onChange={(f) => handleFileChange("exitFile", f)}
                    language={language}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex items-center justify-end gap-3 shrink-0">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
          >
            {t(language, "cancel")}
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="gap-2 min-w-[120px]"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                {language === "fr" ? "Enregistrement..." : "Saving..."}
              </>
            ) : (
              <>
                {t(language, "save")}
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ─── File Upload Component ───────────────────────────────────
const FileUpload = React.forwardRef<
  HTMLInputElement,
  {
    file: File | null;
    onChange: (file: File | null) => void;
    language: "fr" | "en";
  }
>(({ file, onChange, language }, ref) => {
  const preview = useMemo(() => {
    if (file) {
      return URL.createObjectURL(file);
    }
    return null;
  }, [file]);

  return (
    <div className="relative">
      {preview ? (
        <div className="relative group rounded-lg overflow-hidden border border-border aspect-video">
          <img
            src={preview}
            alt="Preview"
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onChange(null)}
              className="text-white hover:text-white hover:bg-white/20"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => (ref as React.RefObject<HTMLInputElement>)?.current?.click()}
          className="w-full aspect-video rounded-lg border-2 border-dashed border-border hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2 cursor-pointer group"
        >
          <Upload className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
          <span className="text-xs text-muted-foreground group-hover:text-primary transition-colors">
            {language === "fr" ? "Télécharger" : "Upload"}
          </span>
        </button>
      )}
      <input
        ref={ref}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0] ?? null;
          onChange(f);
        }}
      />
    </div>
  );
});

FileUpload.displayName = "FileUpload";
