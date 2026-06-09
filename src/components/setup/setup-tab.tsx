"use client";

import React, { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useStats, useTrades } from "@/lib/hooks";
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
  FolderOpen,
  Database,
  UserCircle,
  BarChart3,
  Target,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  CalendarIcon,
  Upload,
  X,
  Calculator,
  Clock,
  Eye,
  ArrowLeft,
  List,
  FileEdit,
  Filter,
  ChevronDown,
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
const STRUCTURES = ["HAUSSIÈRE", "BAISSIÈRE", "RANGE"];
const ENTRY_MODELS = ["ANGLOBANTE", "LOT À 3 BOUGIES", "MARKET SHIFT"];

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
  contextFile: File | null;
  entryFile: File | null;
  exitFile: File | null;
}

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
  contextFile: null,
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

  if (!isNaN(entryPrice) && !isNaN(stopLoss) && !isNaN(takeProfit)) {
    const risk = Math.abs(entryPrice - stopLoss);
    const reward = Math.abs(takeProfit - entryPrice);
    if (risk > 0) {
      result.rr = parseFloat((reward / risk).toFixed(2));
    }
  }

  if (!isNaN(exitPrice) && !isNaN(entryPrice) && !isNaN(lotSize) && formData.exitPrice !== "") {
    const priceDiff = formData.direction === "LONG"
      ? exitPrice - entryPrice
      : entryPrice - exitPrice;
    const contractSize = getContractSize(formData.pair);
    result.pnl = parseFloat((priceDiff * lotSize * contractSize).toFixed(2));
  }

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
  }

  if (formData.entryTime && formData.exitTime) {
    const [eH, eM] = formData.entryTime.split(":").map(Number);
    const [xH, xM] = formData.exitTime.split(":").map(Number);
    if (!isNaN(eH) && !isNaN(eM) && !isNaN(xH) && !isNaN(xM)) {
      let totalMinutes = (xH * 60 + xM) - (eH * 60 + eM);
      if (totalMinutes < 0) totalMinutes += 24 * 60;
      const hours = Math.floor(totalMinutes / 60);
      const minutes = totalMinutes % 60;
      result.duration = hours > 0 ? `${hours}h ${minutes}min` : `${minutes}min`;
    }
  }

  return result;
}

// ─── Main Component ──────────────────────────────────────────
export function SetupTab() {
  const { language, setSelectedTradeId, setShowTradeDetail, setShowTradeForm } = useAppStore();
  const { stats, loading: statsLoading, refetch: refetchStats } = useStats();
  const { trades, loading: tradesLoading, refetch: refetchTrades } = useTrades();

  // Sub-view state: 'main' | 'donciel-verification' | 'donciel-saisie' | 'custom-verification' | 'custom-saisie'
  const [subView, setSubView] = useState<"main" | "donciel-verification" | "donciel-saisie" | "custom-verification" | "custom-saisie">("main");
  const [showSaisieDialog, setShowSaisieDialog] = useState(false);
  const [saisieMode, setSaisieMode] = useState<"donciel" | "custom">("donciel");

  useEffect(() => {
    refetchStats();
    refetchTrades();
  }, [refetchStats, refetchTrades]);

  const statsData = (stats as any)?.stats ?? stats;

  // Filter trades for DONCIEL SETUP (standard setups A, A+, B, B+, C)
  const doncielTrades = useMemo(() =>
    trades.filter(trade => !trade.setup || SETUPS.includes(trade.setup)),
    [trades]
  );

  // Filter trades for SETUP PERSONNALISÉ (custom setups not in standard list)
  const customTrades = useMemo(() =>
    trades.filter(trade => trade.setup && !SETUPS.includes(trade.setup)),
    [trades]
  );

  const handleTradeClick = (tradeId: string) => {
    setSelectedTradeId(tradeId);
    setShowTradeDetail(true);
  };

  const handleTradeCreated = useCallback(() => {
    refetchTrades();
    refetchStats();
  }, [refetchTrades, refetchStats]);

  const openSaisie = (mode: "donciel" | "custom") => {
    setSaisieMode(mode);
    setShowSaisieDialog(true);
  };

  // ─── Main View ────────────────────────────────────
  if (subView === "main") {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t(language, "setupTab")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {t(language, "setupDescription")}
          </p>
        </div>

        {/* Setup Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
          {/* DONCIEL SETUP */}
          <Card
            className="p-6 cursor-pointer hover:border-primary/30 hover:bg-primary/5 transition-all duration-300 group"
            onClick={() => setSubView("donciel-verification")}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <Database className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{t(language, "doncielSetup")}</h3>
                <p className="text-xs text-muted-foreground">{t(language, "baseDonnees")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SetupStatCard label={t(language, "totalTrades")} value={doncielTrades.length} />
              <SetupStatCard label={t(language, "totalRR")} value={doncielTrades.reduce((s, t) => s + (t.rr ?? 0), 0).toFixed(2)} />
              <SetupStatCard label={t(language, "winRate")} value={`${doncielTrades.length > 0 ? ((doncielTrades.filter(t => t.result === "WIN").length / doncielTrades.filter(t => t.result).length) * 100 || 0).toFixed(1) : "0.0"}%`} />
              <SetupStatCard label={t(language, "avgRR")} value={doncielTrades.length > 0 ? (doncielTrades.reduce((s, t) => s + (t.rr ?? 0), 0) / doncielTrades.length).toFixed(2) : "0.00"} />
            </div>
          </Card>

          {/* SETUP PERSONNALISÉ */}
          <Card
            className="p-6 cursor-pointer hover:border-gold/30 hover:bg-gold/5 transition-all duration-300 group"
            onClick={() => setSubView("custom-verification")}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-gold/10 flex items-center justify-center group-hover:bg-gold/20 transition-colors">
                <UserCircle className="w-5 h-5 text-gold" />
              </div>
              <div>
                <h3 className="text-lg font-bold">{t(language, "setupPersonnalise")}</h3>
                <p className="text-xs text-muted-foreground">{t(language, "baseDonnees")}</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <SetupStatCard label={t(language, "totalTrades")} value={customTrades.length} />
              <SetupStatCard label={t(language, "totalRR")} value={customTrades.reduce((s, t) => s + (t.rr ?? 0), 0).toFixed(2)} />
              <SetupStatCard label={t(language, "winRate")} value={`${customTrades.length > 0 ? ((customTrades.filter(t => t.result === "WIN").length / customTrades.filter(t => t.result).length) * 100 || 0).toFixed(1) : "0.0"}%`} />
              <SetupStatCard label={t(language, "avgRR")} value={customTrades.length > 0 ? (customTrades.reduce((s, t) => s + (t.rr ?? 0), 0) / customTrades.length).toFixed(2) : "0.00"} />
            </div>
          </Card>
        </div>
      </div>
    );
  }

  // ─── Sub-views ──────────────────────────────────────
  const isDonciel = subView.startsWith("donciel");
  const currentTrades = isDonciel ? doncielTrades : customTrades;
  const title = isDonciel ? t(language, "doncielSetup") : t(language, "setupPersonnalise");
  const setupPrefix = isDonciel ? "donciel" : "custom";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => setSubView("main")} className="gap-1">
          <ArrowLeft className="w-4 h-4" />
          {t(language, "back")}
        </Button>
        <div>
          <h2 className="text-xl font-bold">{title}</h2>
        </div>
      </div>

      {/* Sub-navigation buttons */}
      <div className="flex gap-2">
        <Button
          variant={subView.endsWith("verification") ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => setSubView(`${setupPrefix}-verification` as any)}
        >
          <List className="w-4 h-4" />
          {t(language, "doncielSetupVerification")}
        </Button>
        <Button
          variant={subView.endsWith("saisie") ? "default" : "outline"}
          size="sm"
          className="gap-2"
          onClick={() => openSaisie(isDonciel ? "donciel" : "custom")}
        >
          <FileEdit className="w-4 h-4" />
          {t(language, "saisieDesTrades")}
        </Button>
      </div>

      {/* Verification View - Trade List */}
      <TradeVerificationList
        trades={currentTrades}
        language={language}
        onTradeClick={handleTradeClick}
        loading={tradesLoading}
      />

      {/* Trade Form Dialog (Saisie) */}
      <TradeFormDialog
        open={showSaisieDialog}
        onOpenChange={setShowSaisieDialog}
        language={language}
        onTradeCreated={handleTradeCreated}
        setupMode={saisieMode}
      />
    </div>
  );
}

// ─── Sub-Components ──────────────────────────────────────────

function SetupStatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg bg-muted/30 p-3">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">{label}</div>
      <div className="text-lg font-bold font-mono">{value}</div>
    </div>
  );
}

// ─── Trade Verification List ─────────────────────────────────
function TradeVerificationList({
  trades,
  language,
  onTradeClick,
  loading,
}: {
  trades: any[];
  language: "fr" | "en";
  onTradeClick: (id: string) => void;
  loading: boolean;
}) {
  const [filters, setFilters] = useState({
    condition: "",
    setup: "",
    entryModel: "",
    structure: "",
    timing: "",
  });
  const [showFilters, setShowFilters] = useState(false);

  // Stats
  const longCount = trades.filter(t => t.direction === "LONG").length;
  const shortCount = trades.filter(t => t.direction === "SHORT").length;
  const totalRR = trades.reduce((s, t) => s + (t.rr ?? 0), 0);

  // Apply filters
  const { condition, setup, entryModel, structure, timing } = filters;
  const filteredTrades = useMemo(() => {
    return trades.filter(trade => {
      if (condition && trade.marketCondition !== condition) return false;
      if (setup && trade.setup !== setup) return false;
      if (entryModel && trade.entryModel !== entryModel) return false;
      if (structure && trade.structure !== structure) return false;
      if (timing && trade.session !== timing) return false;
      return true;
    });
  }, [trades, condition, setup, entryModel, structure, timing]);

  return (
    <div className="space-y-4">
      {/* Stats bar */}
      <Card className="p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-muted-foreground" />
            <span className="text-sm font-medium">{filteredTrades.length} trades</span>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            RR Total: {totalRR.toFixed(2)}
          </Badge>
          <div className="flex items-center gap-1.5">
            <Badge className="text-[10px] bg-profit/15 text-profit border-profit/20">
              <ArrowUpRight className="w-3 h-3 mr-0.5" /> {longCount}
            </Badge>
            <Badge className="text-[10px] bg-loss/15 text-loss border-loss/20">
              <ArrowDownRight className="w-3 h-3 mr-0.5" /> {shortCount}
            </Badge>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="ml-auto gap-1"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
            {t(language, "filtres")}
            <ChevronDown className={cn("w-3 h-3 transition-transform", showFilters && "rotate-180")} />
          </Button>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mt-4 pt-4 border-t border-border">
            <Select value={filters.condition} onValueChange={v => setFilters(p => ({ ...p, condition: v === "__all__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t(language, "condition")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === "fr" ? "Toutes" : "All"}</SelectItem>
                {MARKET_CONDITIONS.map(mc => <SelectItem key={mc} value={mc}>{mc}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.setup} onValueChange={v => setFilters(p => ({ ...p, setup: v === "__all__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t(language, "setup")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === "fr" ? "Tous" : "All"}</SelectItem>
                {SETUPS.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.entryModel} onValueChange={v => setFilters(p => ({ ...p, entryModel: v === "__all__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t(language, "modelEntree")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === "fr" ? "Tous" : "All"}</SelectItem>
                {ENTRY_MODELS.map(em => <SelectItem key={em} value={em}>{em}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.structure} onValueChange={v => setFilters(p => ({ ...p, structure: v === "__all__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t(language, "structure")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === "fr" ? "Toutes" : "All"}</SelectItem>
                {STRUCTURES.map(st => <SelectItem key={st} value={st}>{st}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filters.timing} onValueChange={v => setFilters(p => ({ ...p, timing: v === "__all__" ? "" : v }))}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder={t(language, "timing")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">{language === "fr" ? "Tous" : "All"}</SelectItem>
                {SESSIONS.map(s => <SelectItem key={s} value={s}>{t(language, s.toLowerCase().replace(/\s+/g, "") as any) || s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}
      </Card>

      {/* Trade list */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-6 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : filteredTrades.length === 0 ? (
          <div className="p-12 text-center">
            <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">{t(language, "noData")}</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden md:block">
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="text-xs font-semibold uppercase tracking-wider w-12">N°</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{language === "fr" ? "Long/Short" : "Long/Short"}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "date")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider">{t(language, "setup")}</TableHead>
                    <TableHead className="text-xs font-semibold uppercase tracking-wider text-right">RR</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTrades.map((trade, idx) => (
                    <TableRow
                      key={trade.id}
                      className="cursor-pointer hover:bg-muted/50 transition-colors"
                      onClick={() => onTradeClick(trade.id)}
                    >
                      <TableCell className="text-sm font-mono text-muted-foreground">{idx + 1}</TableCell>
                      <TableCell>
                        <span className={cn(
                          "inline-flex items-center gap-1 text-xs font-semibold",
                          trade.direction === "LONG" ? "text-profit" : "text-loss"
                        )}>
                          {trade.direction === "LONG" ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                          {trade.direction}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {trade.date ? format(new Date(trade.date), "dd/MM/yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs font-mono">
                          {trade.setup || "—"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={cn(
                          "font-mono text-sm font-bold",
                          trade.rr !== null && trade.rr >= 0 ? "text-profit" : "text-loss"
                        )}>
                          {trade.rr !== null ? (trade.rr >= 0 ? "+" : "") + trade.rr.toFixed(2) : "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden divide-y divide-border">
              {filteredTrades.map((trade, idx) => (
                <button
                  key={trade.id}
                  onClick={() => onTradeClick(trade.id)}
                  className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors text-left"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono text-muted-foreground w-6">{idx + 1}</span>
                    <div className={cn(
                      "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                      trade.result === "WIN" && "bg-profit/10 text-profit",
                      trade.result === "LOSS" && "bg-loss/10 text-loss",
                      trade.result === "BE" && "bg-gold/10 text-gold",
                      !trade.result && "bg-muted text-muted-foreground"
                    )}>
                      {trade.direction === "LONG" ? <ArrowUpRight className="w-3.5 h-3.5" /> : <ArrowDownRight className="w-3.5 h-3.5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm">{trade.pair}</span>
                        <Badge variant="outline" className="text-[10px] font-mono px-1">
                          {trade.setup || "—"}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {trade.date ? format(new Date(trade.date), "dd/MM") : "—"}
                      </div>
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-3">
                    <span className={cn(
                      "font-mono text-sm font-bold",
                      trade.rr !== null && trade.rr >= 0 ? "text-profit" : "text-loss"
                    )}>
                      {trade.rr !== null ? (trade.rr >= 0 ? "+" : "") + trade.rr.toFixed(2) : "—"}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}

// ─── Result Badge ────────────────────────────────────────────
function ResultBadge({ result, language, size = "default" }: { result: string | null; language: "fr" | "en"; size?: "default" | "sm" }) {
  if (!result) return <span className="text-muted-foreground text-xs">—</span>;
  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0" : "text-xs";
  if (result === "WIN") return <Badge className={cn("bg-profit/15 text-profit border-profit/20", sizeClass)}>{t(language, "win")}</Badge>;
  if (result === "LOSS") return <Badge className={cn("bg-loss/15 text-loss border-loss/20", sizeClass)}>{t(language, "loss")}</Badge>;
  return <Badge className={cn("bg-gold/15 text-gold border-gold/20", sizeClass)}>{t(language, "be")}</Badge>;
}

// ─── Trade Form Dialog ───────────────────────────────────────
function TradeFormDialog({
  open,
  onOpenChange,
  language,
  onTradeCreated,
  setupMode,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  language: "fr" | "en";
  onTradeCreated: () => void;
  setupMode: "donciel" | "custom";
}) {
  const [formData, setFormData] = useState<TradeFormData>(initialFormData);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCustomPair, setShowCustomPair] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);
  const contextRef = useRef<HTMLInputElement>(null);
  const entryFileRef = useRef<HTMLInputElement>(null);
  const exitFileRef = useRef<HTMLInputElement>(null);

  const autoCalc = useMemo(() => calculateAuto(formData), [formData]);

  useEffect(() => {
    if (open) {
      setFormData({ ...initialFormData, date: format(new Date(), "yyyy-MM-dd") });
      setShowCustomPair(false);
    }
  }, [open]);

  const updateField = useCallback(<K extends keyof TradeFormData>(key: K, value: TradeFormData[K]) => {
    setFormData((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handlePairChange = useCallback((value: string) => {
    if (value === "__custom__") { setShowCustomPair(true); updateField("pair", ""); }
    else { setShowCustomPair(false); updateField("pair", value); }
  }, [updateField]);

  const handleSubmit = async () => {
    if (!formData.date || !formData.pair || !formData.direction || !formData.session ||
        !formData.marketCondition || !formData.timeframeAnalysis || !formData.timeframeEntry ||
        !formData.entryPrice || !formData.stopLoss || !formData.takeProfit) {
      toast.error(language === "fr" ? "Remplissez les champs obligatoires" : "Fill required fields");
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

      // Upload screenshots
      const uploadPromises: Promise<void>[] = [];
      const files: { file: File | null; type: string }[] = [
        { file: formData.contextFile, type: "context" },
        { file: formData.entryFile, type: "entry" },
        { file: formData.exitFile, type: "exit" },
      ];
      for (const { file, type } of files) {
        if (file && trade?.id) {
          uploadPromises.push((async () => {
            const fd = new FormData();
            fd.append("file", file);
            fd.append("tradeId", trade.id);
            fd.append("type", type);
            await fetch("/api/upload", { method: "POST", body: fd });
          })());
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
              {t(language, "saisieDesTrades")}
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
                      <div className={cn("text-lg font-bold font-mono", autoCalc.rr >= 1 ? "text-profit" : "text-loss")}>{autoCalc.rr.toFixed(2)}</div>
                    </div>
                  )}
                  {autoCalc.pnl !== null && (
                    <div className="text-center p-2 rounded-lg bg-background/50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">P&L</div>
                      <div className={cn("text-lg font-bold font-mono", autoCalc.pnl > 0 ? "text-profit" : autoCalc.pnl < 0 ? "text-loss" : "text-gold")}>{autoCalc.pnl >= 0 ? "+" : ""}{autoCalc.pnl.toFixed(2)}</div>
                    </div>
                  )}
                  {autoCalc.resultLabel && (
                    <div className="text-center p-2 rounded-lg bg-background/50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">{t(language, "result")}</div>
                      <ResultBadge result={autoCalc.resultLabel} language={language} />
                    </div>
                  )}
                  {autoCalc.duration && (
                    <div className="text-center p-2 rounded-lg bg-background/50">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1"><Clock className="w-3 h-3 inline mr-0.5" />{t(language, "duration")}</div>
                      <div className="text-sm font-semibold font-mono">{autoCalc.duration}</div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ─── Trade Info ──────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "fr" ? "Informations du Trade" : "Trade Information"}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Date */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "date")} *</Label>
                  <Popover open={dateOpen} onOpenChange={setDateOpen}>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal h-9", !formData.date && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {formData.date ? format(new Date(formData.date), "dd/MM/yyyy") : language === "fr" ? "Sélectionner" : "Select"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar mode="single" selected={formData.date ? new Date(formData.date) : undefined} onSelect={(date) => { if (date) { updateField("date", format(date, "yyyy-MM-dd")); setDateOpen(false); } }} initialFocus />
                    </PopoverContent>
                  </Popover>
                </div>
                {/* Pair */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "pair")} *</Label>
                  {!showCustomPair ? (
                    <Select value={formData.pair} onValueChange={handlePairChange}>
                      <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                      <SelectContent>
                        {DEFAULT_PAIRS.map(p => <SelectItem key={p} value={p}><span className="font-mono">{p}</span></SelectItem>)}
                        <SelectSeparator />
                        <SelectItem value="__custom__"><span className="text-primary text-xs">{t(language, "customPair")}</span></SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="flex gap-2">
                      <Input placeholder="EURJPY" value={formData.customPair} onChange={(e) => updateField("customPair", e.target.value.toUpperCase())} className="h-9 font-mono" />
                      <Button variant="ghost" size="sm" onClick={() => { setShowCustomPair(false); updateField("customPair", ""); }} className="shrink-0 h-9 px-2"><X className="w-4 h-4" /></Button>
                    </div>
                  )}
                </div>
                {/* Direction */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "direction")} *</Label>
                  <ToggleGroup type="single" value={formData.direction} onValueChange={(val) => { if (val) updateField("direction", val as "LONG" | "SHORT"); }} className="w-full">
                    <ToggleGroupItem value="LONG" className="flex-1 data-[state=on]:bg-profit/15 data-[state=on]:text-profit h-9 text-sm font-semibold gap-1"><ArrowUpRight className="w-3.5 h-3.5" />{t(language, "long")}</ToggleGroupItem>
                    <ToggleGroupItem value="SHORT" className="flex-1 data-[state=on]:bg-loss/15 data-[state=on]:text-loss h-9 text-sm font-semibold gap-1"><ArrowDownRight className="w-3.5 h-3.5" />{t(language, "short")}</ToggleGroupItem>
                  </ToggleGroup>
                </div>
                {/* Session */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "session")} *</Label>
                  <Select value={formData.session} onValueChange={(v) => updateField("session", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {SESSIONS.map(s => <SelectItem key={s} value={s}>{t(language, s.toLowerCase().replace(/\s+/g, "") as any) || s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Market Condition */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "marketCondition")} *</Label>
                  <Select value={formData.marketCondition} onValueChange={(v) => updateField("marketCondition", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {MARKET_CONDITIONS.map(mc => <SelectItem key={mc} value={mc}>{t(language, mc.toLowerCase() as any) || mc}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* TF Analysis */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{language === "fr" ? "TF Analyse" : "Analysis TF"} *</Label>
                  <Select value={formData.timeframeAnalysis} onValueChange={(v) => updateField("timeframeAnalysis", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES_ANALYSIS.map(tf => <SelectItem key={tf} value={tf}><span className="font-mono">{tf}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* TF Entry */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{language === "fr" ? "TF Entrée" : "Entry TF"} *</Label>
                  <Select value={formData.timeframeEntry} onValueChange={(v) => updateField("timeframeEntry", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {TIMEFRAMES_ENTRY.map(tf => <SelectItem key={tf} value={tf}><span className="font-mono">{tf}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Setup */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "setup")}</Label>
                  <Select value={formData.setup} onValueChange={(v) => updateField("setup", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {SETUPS.map(s => <SelectItem key={s} value={s}><span className="font-mono font-semibold">{s}</span></SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Structure */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "structureField")}</Label>
                  <Select value={formData.structure} onValueChange={(v) => updateField("structure", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {STRUCTURES.map(st => <SelectItem key={st} value={st}>{t(language, st.toLowerCase().replace(/è/g, "e").replace(/é/g, "e") as any) || st}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                {/* Entry Model */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "entryModelField")}</Label>
                  <Select value={formData.entryModel} onValueChange={(v) => updateField("entryModel", v)}>
                    <SelectTrigger className="w-full h-9"><SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} /></SelectTrigger>
                    <SelectContent>
                      {ENTRY_MODELS.map(em => <SelectItem key={em} value={em}>{em}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Price & Timing ──────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "fr" ? "Prix & Timing" : "Price & Timing"}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "entryPrice")} *</Label>
                  <Input type="number" step="any" placeholder="0.00" value={formData.entryPrice} onChange={(e) => updateField("entryPrice", e.target.value)} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "stopLoss")} *</Label>
                  <Input type="number" step="any" placeholder="0.00" value={formData.stopLoss} onChange={(e) => updateField("stopLoss", e.target.value)} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "takeProfit")} *</Label>
                  <Input type="number" step="any" placeholder="0.00" value={formData.takeProfit} onChange={(e) => updateField("takeProfit", e.target.value)} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "exitPrice")}</Label>
                  <Input type="number" step="any" placeholder="0.00" value={formData.exitPrice} onChange={(e) => updateField("exitPrice", e.target.value)} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "lotSize")}</Label>
                  <Input type="number" step="any" placeholder="0.00" value={formData.lotSize} onChange={(e) => updateField("lotSize", e.target.value)} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "entryTime")}</Label>
                  <Input type="time" value={formData.entryTime} onChange={(e) => updateField("entryTime", e.target.value)} className="h-9 font-mono" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "exitTime")}</Label>
                  <Input type="time" value={formData.exitTime} onChange={(e) => updateField("exitTime", e.target.value)} className="h-9 font-mono" />
                </div>
              </div>
            </div>

            <Separator />

            {/* ─── Psychology ──────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {language === "fr" ? "Psychologie" : "Psychology"}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "emotions")}</Label>
                  <Textarea value={formData.emotions} onChange={(e) => updateField("emotions", e.target.value)} className="min-h-[60px] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "confluence")}</Label>
                  <Textarea value={formData.confluence} onChange={(e) => updateField("confluence", e.target.value)} className="min-h-[60px] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "mistakes")}</Label>
                  <Textarea value={formData.mistakes} onChange={(e) => updateField("mistakes", e.target.value)} className="min-h-[60px] text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">{t(language, "lessons")}</Label>
                  <Textarea value={formData.lessons} onChange={(e) => updateField("lessons", e.target.value)} className="min-h-[60px] text-sm" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">{t(language, "notes")}</Label>
                <Textarea value={formData.notes} onChange={(e) => updateField("notes", e.target.value)} className="min-h-[60px] text-sm" />
              </div>
            </div>

            <Separator />

            {/* ─── Screenshots ──────────────── */}
            <div className="space-y-4">
              <h4 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {t(language, "screenshots")}
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Context Screenshot */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{language === "fr" ? "Contexte" : "Context"}</Label>
                  <input ref={contextRef} type="file" accept="image/*" className="hidden" onChange={(e) => updateField("contextFile", e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" className="w-full h-9 gap-2" onClick={() => contextRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                    {formData.contextFile ? formData.contextFile.name.slice(0, 20) : (language === "fr" ? "Choisir" : "Choose")}
                  </Button>
                  {formData.contextFile && (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                      <img src={URL.createObjectURL(formData.contextFile)} alt="Context" className="w-full h-full object-cover" />
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 bg-background/80" onClick={() => updateField("contextFile", null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {/* Entry Screenshot */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{language === "fr" ? "Entrée" : "Entry"}</Label>
                  <input ref={entryFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => updateField("entryFile", e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" className="w-full h-9 gap-2" onClick={() => entryFileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                    {formData.entryFile ? formData.entryFile.name.slice(0, 20) : (language === "fr" ? "Choisir" : "Choose")}
                  </Button>
                  {formData.entryFile && (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                      <img src={URL.createObjectURL(formData.entryFile)} alt="Entry" className="w-full h-full object-cover" />
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 bg-background/80" onClick={() => updateField("entryFile", null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
                {/* Exit Screenshot */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{language === "fr" ? "Sortie" : "Exit"}</Label>
                  <input ref={exitFileRef} type="file" accept="image/*" className="hidden" onChange={(e) => updateField("exitFile", e.target.files?.[0] || null)} />
                  <Button type="button" variant="outline" className="w-full h-9 gap-2" onClick={() => exitFileRef.current?.click()}>
                    <Upload className="w-3.5 h-3.5" />
                    {formData.exitFile ? formData.exitFile.name.slice(0, 20) : (language === "fr" ? "Choisir" : "Choose")}
                  </Button>
                  {formData.exitFile && (
                    <div className="relative aspect-video rounded-lg overflow-hidden border border-border">
                      <img src={URL.createObjectURL(formData.exitFile)} alt="Exit" className="w-full h-full object-cover" />
                      <Button variant="ghost" size="icon" className="absolute top-1 right-1 h-6 w-6 bg-background/80" onClick={() => updateField("exitFile", null)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border flex justify-end gap-2 shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t(language, "cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-2">
            {isSubmitting ? <Clock className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {t(language, "save")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
