"use client";

import React, { useState, useMemo, useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useTrades } from "@/lib/hooks";
import { useTimeFilter } from "@/lib/use-time-filter";
import { TimeFilterBar } from "@/components/shared/time-filter-bar";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

import {
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Clock,
  Target,
  DollarSign,
  CalendarIcon,
  BarChart3,
  Image as ImageIcon,
  ChevronDown,
  Newspaper,
  AlertTriangle,
  Lightbulb,
  Heart,
  Layers,
  X,
  Trash2,
} from "lucide-react";

import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Cell,
  Tooltip as RechartsTooltip,
} from "recharts";

import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  getDay,
  addMonths,
  subMonths,
  isSameDay,
  isSameMonth,
  isToday,
  startOfWeek,
  endOfWeek,
  parseISO,
  isValid,
} from "date-fns";
import { fr } from "date-fns/locale";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────
interface DayTradeData {
  date: Date;
  trades: TradeData[];
  totalRR: number;
  totalPnL: number;
  isProfit: boolean | null; // null = no trades
}

interface TradeData {
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

// ─── French Day Names ────────────────────────────────────────
const FRENCH_DAYS = ["DIM", "LUN", "MAR", "MER", "JEU", "VEN", "SAM"];

const FRENCH_MONTHS = [
  "Janvier", "Février", "Mars", "Avril", "Mai", "Juin",
  "Juillet", "Août", "Septembre", "Octobre", "Novembre", "Décembre",
];

const FRENCH_DAY_NAMES = [
  "Dimanche", "Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi",
];

// ─── Main Component ──────────────────────────────────────────
export function JournalTab() {
  const { user, language, setScreenshotViewerUrl, setSelectedTradeId, setShowTradeDetail } = useAppStore();
  const { period, setPeriod, filters } = useTimeFilter();
  const { trades, loading, refetch } = useTrades(filters);

  // Fetch on mount
  React.useEffect(() => { refetch(); }, [refetch]);
  const isMobile = useIsMobile();
  const isAdminUser = user?.role === "admin";

  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [expandedTradeId, setExpandedTradeId] = useState<string | null>(null);
  const [mobileDetailOpen, setMobileDetailOpen] = useState(false);

  // Delete confirmation state
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; pair: string; direction: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDeleteTrade = useCallback(async () => {
    if (!deleteTarget || isDeleting) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/trades/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Delete failed");
      }
      toast.success(language === "fr" ? "Trade supprimé !" : "Trade deleted!");
      setDeleteTarget(null);
      refetch();
    } catch (error: any) {
      toast.error(error.message || (language === "fr" ? "Erreur lors de la suppression" : "Delete failed"));
    } finally {
      setIsDeleting(false);
    }
  }, [deleteTarget, isDeleting, language, refetch]);

  // Group trades by date
  const tradesByDate = useMemo(() => {
    const map = new Map<string, DayTradeData>();

    for (const trade of trades) {
      const tradeDate = parseISO(trade.date);
      if (!isValid(tradeDate)) continue;

      const key = format(tradeDate, "yyyy-MM-dd");

      if (!map.has(key)) {
        map.set(key, {
          date: tradeDate,
          trades: [],
          totalRR: 0,
          totalPnL: 0,
          isProfit: null,
        });
      }

      const dayData = map.get(key)!;
      dayData.trades.push(trade as TradeData);
      if (trade.rr !== null) dayData.totalRR += trade.rr;
      if (trade.pnl !== null) dayData.totalPnL += trade.pnl;
    }

    // Determine profit/loss for each day
    for (const [, dayData] of map) {
      if (dayData.trades.length > 0) {
        dayData.isProfit = dayData.totalPnL >= 0;
      }
    }

    return map;
  }, [trades]);

  // Calendar grid data
  const calendarDays = useMemo(() => {
    const monthStart = startOfMonth(currentMonth);
    const monthEnd = endOfMonth(currentMonth);
    const calendarStart = startOfWeek(monthStart, { weekStartsOn: 0 }); // Sunday
    const calendarEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

    return eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  }, [currentMonth]);

  // Selected date trades
  const selectedDayTrades = useMemo(() => {
    if (!selectedDate) return null;
    const key = format(selectedDate, "yyyy-MM-dd");
    return tradesByDate.get(key) || null;
  }, [selectedDate, tradesByDate]);

  // Navigate months
  const goToPreviousMonth = useCallback(() => {
    setCurrentMonth((prev) => subMonths(prev, 1));
  }, []);

  const goToNextMonth = useCallback(() => {
    setCurrentMonth((prev) => addMonths(prev, 1));
  }, []);

  // Handle date click
  const handleDateClick = useCallback(
    (date: Date) => {
      const key = format(date, "yyyy-MM-dd");
      const dayData = tradesByDate.get(key);
      if (dayData && dayData.trades.length > 0) {
        setSelectedDate(date);
        setExpandedTradeId(null);
        if (isMobile) {
          setMobileDetailOpen(true);
        }
      }
    },
    [tradesByDate, isMobile]
  );

  // Format date header in French
  const formatDateHeader = useCallback(
    (date: Date) => {
      const dayName = FRENCH_DAY_NAMES[getDay(date)];
      const day = format(date, "d");
      const month = FRENCH_MONTHS[date.getMonth()];
      const year = date.getFullYear();
      return `${dayName} ${day} ${month} ${year}`.toUpperCase();
    },
    []
  );

  // Handle trade click for detail view
  const handleTradeDetailClick = useCallback(
    (tradeId: string) => {
      setSelectedTradeId(tradeId);
      setShowTradeDetail(true);
    },
    [setSelectedTradeId, setShowTradeDetail]
  );

  // Trade detail panel content
  const tradeDetailContent = useMemo(() => {
    if (!selectedDate || !selectedDayTrades) {
      return (
        <div className="flex flex-col items-center justify-center h-full min-h-[300px] text-center p-6">
          <CalendarIcon className="w-16 h-16 text-muted-foreground/20 mb-4" />
          <p className="text-muted-foreground text-sm">
            {t(language, "clickDate")}
          </p>
        </div>
      );
    }

    const dayTotalRR = selectedDayTrades.totalRR;
    const dayTotalPnL = selectedDayTrades.totalPnL;

    return (
      <div className="space-y-4">
        {/* Date Header */}
        <div className="space-y-2">
          <h3 className="text-sm font-bold tracking-wider text-foreground/80">
            {formatDateHeader(selectedDate)}
          </h3>
          <div className="flex items-center gap-3">
            <Badge
              variant="outline"
              className={cn(
                "text-xs font-mono gap-1",
                dayTotalPnL >= 0
                  ? "text-profit border-profit/30 bg-profit/5"
                  : "text-loss border-loss/30 bg-loss/5"
              )}
            >
              {dayTotalPnL >= 0 ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              P&L: {dayTotalPnL >= 0 ? "+" : ""}
              {dayTotalPnL.toFixed(2)}
            </Badge>
            <Badge variant="outline" className="text-xs font-mono gap-1">
              <Target className="w-3 h-3" />
              RR: {dayTotalRR.toFixed(2)}
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {selectedDayTrades.trades.length}{" "}
              {selectedDayTrades.trades.length > 1
                ? language === "fr"
                  ? "trades"
                  : "trades"
                : "trade"}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Trade Cards */}
        <div className="space-y-3">
          {selectedDayTrades.trades.map((trade, index) => (
            <TradeCard
              key={trade.id}
              trade={trade}
              index={index}
              language={language}
              isAdmin={isAdminUser}
              isExpanded={expandedTradeId === trade.id}
              onToggleExpand={() =>
                setExpandedTradeId((prev) =>
                  prev === trade.id ? null : trade.id
                )
              }
              onScreenshotClick={setScreenshotViewerUrl}
              onTradeDetailClick={handleTradeDetailClick}
              onDeleteClick={(id) => setDeleteTarget({ id, pair: trade.pair, direction: trade.direction })}
            />
          ))}
        </div>

        {/* Mini Charts */}
        {selectedDayTrades.trades.length > 1 && (
          <>
            <Separator />
            <MiniCharts
              trades={selectedDayTrades.trades}
              language={language}
            />
          </>
        )}
      </div>
    );
  }, [
    selectedDate,
    selectedDayTrades,
    language,
    expandedTradeId,
    formatDateHeader,
    setScreenshotViewerUrl,
    handleTradeDetailClick,
    isAdminUser,
    deleteTarget,
    isDeleting,
    handleDeleteTrade,
  ]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
        <div className="flex flex-col lg:flex-row gap-6">
          <div className="flex-1 lg:flex-[3]">
            <Card className="p-6">
              <Skeleton className="h-8 w-48 mb-6" />
              <div className="grid grid-cols-7 gap-2">
                {Array.from({ length: 35 }).map((_, i) => (
                  <Skeleton key={i} className="h-16 w-full rounded-lg" />
                ))}
              </div>
            </Card>
          </div>
          <div className="flex-1 lg:flex-[2]">
            <Card className="p-6 h-80">
              <Skeleton className="h-full w-full" />
            </Card>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto">
      <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
        {/* Calendar Section (Left - 60%) */}
        <div className="flex-1 lg:flex-[3]">
          <Card className="overflow-hidden">
            {/* Calendar Header */}
            <div className="p-4 md:p-6 border-b border-border space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                  {FRENCH_MONTHS[currentMonth.getMonth()]}{" "}
                  {currentMonth.getFullYear()}
                </h2>
                <div className="flex items-center gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToPreviousMonth}
                    className="h-8 w-8"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={goToNextMonth}
                    className="h-8 w-8"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
              {/* Time Filter */}
              <TimeFilterBar language={language} period={period} onPeriodChange={setPeriod} />
            </div>

            {/* Calendar Grid */}
            <div className="p-3 md:p-4">
              {/* Day Headers */}
              <div className="grid grid-cols-7 mb-2">
                {FRENCH_DAYS.map((day) => (
                  <div
                    key={day}
                    className="text-center text-xs font-semibold text-muted-foreground uppercase tracking-wider py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-1">
                {calendarDays.map((day, idx) => {
                  const key = format(day, "yyyy-MM-dd");
                  const dayData = tradesByDate.get(key);
                  const hasTrades = dayData && dayData.trades.length > 0;
                  const isCurrentMonth = isSameMonth(day, currentMonth);
                  const isSelected =
                    selectedDate && isSameDay(day, selectedDate);
                  const isTodayDate = isToday(day);

                  return (
                    <button
                      key={idx}
                      onClick={() => handleDateClick(day)}
                      disabled={!hasTrades || !isCurrentMonth}
                      className={cn(
                        "relative flex flex-col items-center justify-center rounded-lg p-1 min-h-[44px] md:min-h-[56px] transition-all duration-200 text-sm",
                        // Base styles
                        "hover:bg-muted/50",
                        // Current month vs outside
                        isCurrentMonth
                          ? "text-foreground"
                          : "text-muted-foreground/40",
                        // Today
                        isTodayDate &&
                          !isSelected &&
                          "ring-1 ring-primary/30",
                        // Selected
                        isSelected &&
                          "ring-2 ring-primary bg-primary/10",
                        // Has trades - clickable
                        hasTrades && isCurrentMonth
                          ? "cursor-pointer hover:scale-[1.02]"
                          : "cursor-default",
                        // No trades - dim
                        !hasTrades && isCurrentMonth && "opacity-60"
                      )}
                    >
                      <span
                        className={cn(
                          "text-xs md:text-sm font-medium leading-none",
                          isSelected && "text-primary font-bold"
                        )}
                      >
                        {format(day, "d")}
                      </span>
                      {hasTrades && isCurrentMonth && (
                        <>
                          {/* Color indicator dot */}
                          <div
                            className={cn(
                              "w-1.5 h-1.5 rounded-full mt-0.5",
                              dayData!.isProfit
                                ? "bg-profit"
                                : "bg-loss"
                            )}
                          />
                          {/* RR Value */}
                          <span
                            className={cn(
                              "text-[9px] md:text-[10px] font-mono leading-none mt-0.5",
                              dayData!.isProfit
                                ? "text-profit"
                                : "text-loss"
                            )}
                          >
                            {dayData!.totalRR >= 0 ? "+" : ""}
                            {dayData!.totalRR.toFixed(1)}
                          </span>
                        </>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Calendar Legend */}
            <div className="px-4 pb-4 flex items-center gap-4 text-xs text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-profit" />
                <span>{language === "fr" ? "Profit" : "Profit"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full bg-loss" />
                <span>{language === "fr" ? "Perte" : "Loss"}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded-full ring-1 ring-primary/30" />
                <span>{language === "fr" ? "Aujourd'hui" : "Today"}</span>
              </div>
            </div>
          </Card>
        </div>

        {/* Trade Detail Section (Right - 40%) */}
        {!isMobile ? (
          <div className="flex-1 lg:flex-[2]">
            <Card className="h-full overflow-hidden">
              <ScrollArea className="h-[calc(100vh-12rem)]">
                <div className="p-4 md:p-6">{tradeDetailContent}</div>
              </ScrollArea>
            </Card>
          </div>
        ) : (
          // Mobile: Sheet for trade detail
          <Sheet open={mobileDetailOpen} onOpenChange={setMobileDetailOpen}>
            <SheetContent side="bottom" className="h-[85vh] rounded-t-xl p-0">
              <SheetHeader className="p-4 border-b border-border">
                <SheetTitle className="text-sm">
                  {selectedDate
                    ? formatDateHeader(selectedDate)
                    : t(language, "tradeDetails")}
                </SheetTitle>
              </SheetHeader>
              <ScrollArea className="h-[calc(85vh-4rem)]">
                <div className="p-4">{tradeDetailContent}</div>
              </ScrollArea>
            </SheetContent>
          </Sheet>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Trash2 className="w-5 h-5 text-destructive" />
              {language === "fr" ? "Supprimer ce trade ?" : "Delete this trade?"}
            </DialogTitle>
            <DialogDescription>
              {deleteTarget && (
                language === "fr"
                  ? `Voulez-vous supprimer le trade ${deleteTarget.direction} ${deleteTarget.pair} ? Cette action est irréversible.`
                  : `Delete the ${deleteTarget.direction} ${deleteTarget.pair} trade? This action cannot be undone.`
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={handleDeleteTrade} disabled={isDeleting}>
              {isDeleting
                ? (language === "fr" ? "Suppression..." : "Deleting...")
                : (language === "fr" ? "Supprimer" : "Delete")
              }
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Trade Card Component ────────────────────────────────────
function TradeCard({
  trade,
  index,
  language,
  isAdmin,
  isExpanded,
  onToggleExpand,
  onScreenshotClick,
  onTradeDetailClick,
  onDeleteClick,
}: {
  trade: TradeData;
  index: number;
  language: "fr" | "en";
  isAdmin: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onScreenshotClick: (url: string | null) => void;
  onTradeDetailClick: (tradeId: string) => void;
  onDeleteClick: (tradeId: string) => void;
}) {
  const isLong = trade.direction === "LONG";
  const isWin = trade.result === "WIN";
  const isLoss = trade.result === "LOSS";

  return (
    <Collapsible open={isExpanded} onOpenChange={onToggleExpand}>
      <Card
        className={cn(
          "overflow-hidden transition-all duration-300 border",
          isExpanded
            ? "border-primary/30 shadow-lg shadow-primary/5"
            : "border-border hover:border-border/80",
          isWin && !isExpanded && "border-profit/20",
          isLoss && !isExpanded && "border-loss/20"
        )}
      >
        {/* Card Header - Always visible */}
        <CollapsibleTrigger asChild>
          <button className="w-full p-3 md:p-4 text-left hover:bg-muted/30 transition-colors">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                {/* Direction indicator */}
                <div
                  className={cn(
                    "w-7 h-7 rounded-full flex items-center justify-center shrink-0",
                    isLong
                      ? "bg-profit/10 text-profit"
                      : "bg-loss/10 text-loss"
                  )}
                >
                  {isLong ? (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  )}
                </div>

                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-muted-foreground">
                      {t(language, "tradeNumber")}
                      {index + 1}
                    </span>
                    <Badge
                      className={cn(
                        "text-[10px] px-1.5 py-0 h-4 font-semibold",
                        isLong
                          ? "bg-profit/15 text-profit border-profit/20"
                          : "bg-loss/15 text-loss border-loss/20"
                      )}
                    >
                      {trade.direction}
                    </Badge>
                    <ResultBadge result={trade.result} language={language} size="sm" />
                  </div>
                  <div className="flex items-center gap-2 mt-0.5">
                    <Badge
                      variant="outline"
                      className="text-[10px] font-mono px-1.5 py-0 h-4"
                    >
                      {trade.pair}
                    </Badge>
                    {trade.setup && (
                      <span className="text-[10px] text-muted-foreground">
                        {trade.setup}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* RR and expand button */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="text-right">
                  <div
                    className={cn(
                      "text-sm font-bold font-mono",
                      trade.rr !== null && trade.rr >= 1 && "text-profit",
                      trade.rr !== null && trade.rr < 1 && "text-loss",
                      trade.rr === null && "text-muted-foreground"
                    )}
                  >
                    {trade.rr !== null ? `${trade.rr.toFixed(2)}R` : "—"}
                  </div>
                  {trade.pnl !== null && (
                    <div
                      className={cn(
                        "text-[10px] font-mono",
                        trade.pnl > 0 && "text-profit",
                        trade.pnl < 0 && "text-loss",
                        trade.pnl === 0 && "text-gold"
                      )}
                    >
                      {trade.pnl >= 0 ? "+" : ""}
                      {trade.pnl.toFixed(2)}
                    </div>
                  )}
                </div>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); onDeleteClick(trade.id); }}
                    className="p-1 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                    title={language === "fr" ? "Supprimer ce trade" : "Delete this trade"}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <ChevronDown
                  className={cn(
                    "w-4 h-4 text-muted-foreground transition-transform duration-200",
                    isExpanded && "rotate-180"
                  )}
                />
              </div>
            </div>

            {/* Quick info row */}
            <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
              {trade.entryTime && (
                <div className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>
                    {trade.entryTime}
                    {trade.exitTime ? ` → ${trade.exitTime}` : ""}
                  </span>
                </div>
              )}
              {trade.duration && (
                <span>{trade.duration}</span>
              )}
              <span>{trade.session}</span>
              <span>•</span>
              <span>{trade.marketCondition}</span>
              {trade.newsEnabled && (
                <span className="flex items-center gap-0.5 text-gold">
                  <Newspaper className="w-3 h-3" />
                </span>
              )}
            </div>
          </button>
        </CollapsibleTrigger>

        {/* Expanded Content */}
        <CollapsibleContent>
          <div className="px-3 pb-3 md:px-4 md:pb-4 space-y-4 border-t border-border pt-3">
            {/* Full Parameters */}
            <div className="space-y-2">
              <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {language === "fr" ? "Paramètres" : "Parameters"}
              </h5>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                <ParamItem
                  label={t(language, "entryPrice")}
                  value={trade.entryPrice.toFixed(2)}
                  mono
                />
                <ParamItem
                  label={t(language, "stopLoss")}
                  value={trade.stopLoss.toFixed(2)}
                  mono
                  valueClass="text-loss"
                />
                <ParamItem
                  label={t(language, "takeProfit")}
                  value={trade.takeProfit.toFixed(2)}
                  mono
                  valueClass="text-profit"
                />
                {trade.exitPrice !== null && (
                  <ParamItem
                    label={t(language, "exitPrice")}
                    value={trade.exitPrice.toFixed(2)}
                    mono
                  />
                )}
                {trade.lotSize !== null && (
                  <ParamItem
                    label={t(language, "lotSize")}
                    value={trade.lotSize.toString()}
                    mono
                  />
                )}
                <ParamItem
                  label={t(language, "timeframe")}
                  value={trade.timeframe}
                  mono
                />
              </div>
            </div>

            {/* Auto-Calculated Metrics */}
            {(trade.rr !== null || trade.pnl !== null || trade.result) && (
              <div className="space-y-2">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {language === "fr" ? "Métriques" : "Metrics"}
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  {trade.rr !== null && (
                    <div className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                        RR
                      </div>
                      <div
                        className={cn(
                          "text-sm font-bold font-mono",
                          trade.rr >= 1 ? "text-profit" : "text-loss"
                        )}
                      >
                        {trade.rr.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {trade.pnl !== null && (
                    <div className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                        P&L
                      </div>
                      <div
                        className={cn(
                          "text-sm font-bold font-mono",
                          trade.pnl > 0
                            ? "text-profit"
                            : trade.pnl < 0
                            ? "text-loss"
                            : "text-gold"
                        )}
                      >
                        {trade.pnl >= 0 ? "+" : ""}
                        {trade.pnl.toFixed(2)}
                      </div>
                    </div>
                  )}
                  {trade.result && (
                    <div className="rounded-lg border border-border p-2 text-center">
                      <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-0.5">
                        {t(language, "result")}
                      </div>
                      <div className="flex justify-center">
                        <ResultBadge
                          result={trade.result}
                          language={language}
                          size="sm"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Qualitative Data */}
            {(trade.emotions ||
              trade.confluence ||
              trade.mistakes ||
              trade.lessons) && (
              <div className="space-y-2">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {language === "fr"
                    ? "Données Qualitatives"
                    : "Qualitative Data"}
                </h5>
                <div className="space-y-1.5">
                  {trade.emotions && (
                    <QualitativeItem
                      icon={Heart}
                      label={t(language, "emotions")}
                      value={trade.emotions}
                      color="text-pink-400"
                    />
                  )}
                  {trade.confluence && (
                    <QualitativeItem
                      icon={Layers}
                      label={t(language, "confluence")}
                      value={trade.confluence}
                      color="text-primary"
                    />
                  )}
                  {trade.mistakes && (
                    <QualitativeItem
                      icon={AlertTriangle}
                      label={t(language, "mistakes")}
                      value={trade.mistakes}
                      color="text-loss"
                    />
                  )}
                  {trade.lessons && (
                    <QualitativeItem
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
              <div className="rounded-lg bg-muted/30 p-2.5">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground mb-1">
                  {t(language, "notes")}
                </div>
                <p className="text-xs text-foreground/80 whitespace-pre-wrap">
                  {trade.notes}
                </p>
              </div>
            )}

            {/* Screenshots & Videos */}
            {trade.screenshots && trade.screenshots.length > 0 && (
              <div className="space-y-2">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {language === "fr" ? "Captures & Vidéos" : "Screenshots & Videos"}
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  {trade.screenshots.map((screenshot) => {
                    const mediaSrc = screenshot.url.startsWith('upload/screenshots/')
                      ? `/api/screenshots/${screenshot.url.replace('upload/screenshots/', '')}`
                      : screenshot.url;
                    const isVideo = screenshot.url.includes('/video/upload/') || /\.(mp4|webm|mov|avi|mkv|m4v)$/i.test(screenshot.url);
                    return (
                    <button
                      key={screenshot.id}
                      onClick={(e) => { e.stopPropagation(); onScreenshotClick(mediaSrc); }}
                      className="group relative aspect-video rounded-lg overflow-hidden border border-border hover:border-primary/30 transition-colors"
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
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                        <ImageIcon className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1 flex items-center justify-between">
                        <span className="text-[8px] text-white font-medium uppercase">
                          {screenshot.type === "analysis"
                            ? t(language, "analysisScreenshot")
                            : screenshot.type === "entry"
                            ? t(language, "entryScreenshot")
                            : t(language, "exitScreenshot")}
                        </span>
                        {isVideo && (
                          <span className="text-[7px] text-white/70 bg-white/20 rounded px-0.5">VID</span>
                        )}
                      </div>
                    </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* View Full Detail Button */}
            <Button
              variant="outline"
              size="sm"
              className="w-full text-xs gap-1.5"
              onClick={() => onTradeDetailClick(trade.id)}
            >
              <BarChart3 className="w-3 h-3" />
              {language === "fr"
                ? "Voir le détail complet"
                : "View full detail"}
            </Button>
          </div>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}

// ─── Result Badge ────────────────────────────────────────────
function ResultBadge({
  result,
  language,
  size = "default",
}: {
  result: string | null;
  language: "fr" | "en";
  size?: "default" | "sm";
}) {
  if (!result) return <span className="text-muted-foreground text-xs">—</span>;

  const sizeClass = size === "sm" ? "text-[10px] px-1.5 py-0 h-4" : "text-xs";

  if (result === "WIN") {
    return (
      <Badge
        className={cn(
          "bg-profit/15 text-profit border-profit/20 hover:bg-profit/20",
          sizeClass
        )}
      >
        {t(language, "win")}
      </Badge>
    );
  }
  if (result === "LOSS") {
    return (
      <Badge
        className={cn(
          "bg-loss/15 text-loss border-loss/20 hover:bg-loss/20",
          sizeClass
        )}
      >
        {t(language, "loss")}
      </Badge>
    );
  }
  return (
    <Badge
      className={cn(
        "bg-gold/15 text-gold border-gold/20 hover:bg-gold/20",
        sizeClass
      )}
    >
      {t(language, "be")}
    </Badge>
  );
}

// ─── Parameter Item ──────────────────────────────────────────
function ParamItem({
  label,
  value,
  mono,
  valueClass,
}: {
  label: string;
  value: string;
  mono?: boolean;
  valueClass?: string;
}) {
  return (
    <div className="rounded-md bg-muted/20 p-1.5">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
        {label}
      </div>
      <div
        className={cn(
          "text-xs font-semibold leading-none",
          mono && "font-mono",
          valueClass
        )}
      >
        {value}
      </div>
    </div>
  );
}

// ─── Qualitative Item ────────────────────────────────────────
function QualitativeItem({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="flex items-start gap-2">
      <Icon className={cn("w-3 h-3 mt-0.5 shrink-0", color)} />
      <div className="min-w-0">
        <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <p className="text-xs text-foreground/80 whitespace-pre-wrap">
          {value}
        </p>
      </div>
    </div>
  );
}

// ─── Mini Charts Component ───────────────────────────────────
function MiniCharts({
  trades,
  language,
}: {
  trades: TradeData[];
  language: "fr" | "en";
}) {
  // RR by trade (last 10)
  const rrChartData = useMemo(() => {
    const lastTrades = trades.slice(-10);
    return lastTrades.map((trade, i) => ({
      name: `#${i + 1}`,
      rr: trade.rr ?? 0,
      fill:
        trade.result === "WIN"
          ? "var(--color-profit)"
          : trade.result === "LOSS"
          ? "var(--color-loss)"
          : "var(--color-gold)",
    }));
  }, [trades]);

  // Cumulative P&L
  const cumulativePnLData = useMemo(() => {
    const pnls = trades.map((trade) => trade.pnl ?? 0);
    return pnls.reduce<Array<{ name: string; pnl: number }>>(
      (acc, pnl, i) => {
        const prevTotal = acc.length > 0 ? acc[acc.length - 1].pnl : 0;
        acc.push({
          name: `#${i + 1}`,
          pnl: parseFloat((prevTotal + pnl).toFixed(2)),
        });
        return acc;
      },
      []
    );
  }, [trades]);

  const chartConfig = {
    rr: {
      label: "RR",
      color: "var(--color-profit)",
    },
    pnl: {
      label: "P&L",
      color: "var(--color-primary)",
    },
  };

  return (
    <div className="space-y-4">
      <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {language === "fr" ? "Graphiques" : "Charts"}
      </h5>

      <div className="grid grid-cols-1 gap-4">
        {/* RR by Trade Bar Chart */}
        <div className="rounded-lg border border-border p-3">
          <div className="text-[10px] text-muted-foreground font-medium mb-2">
            {language === "fr" ? "RR par Trade" : "RR by Trade"}
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={rrChartData} margin={{ top: 5, right: 5, bottom: 5, left: 5 }}>
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                  width={30}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Bar dataKey="rr" radius={[3, 3, 0, 0]}>
                  {rrChartData.map((entry, index) => (
                    <Cell
                      key={`cell-${index}`}
                      fill={entry.fill}
                      opacity={0.8}
                    />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Cumulative P&L Line Chart */}
        <div className="rounded-lg border border-border p-3">
          <div className="text-[10px] text-muted-foreground font-medium mb-2">
            {language === "fr" ? "P&L Cumulé" : "Cumulative P&L"}
          </div>
          <div className="h-32">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={cumulativePnLData}
                margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
              >
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 9, fill: "var(--color-muted-foreground)" }}
                  axisLine={{ stroke: "var(--color-border)" }}
                  tickLine={false}
                  width={35}
                />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--color-card)",
                    border: "1px solid var(--color-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="pnl"
                  stroke="var(--color-primary)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: "var(--color-primary)" }}
                  activeDot={{ r: 4, fill: "var(--color-primary)" }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
    </div>
  );
}
