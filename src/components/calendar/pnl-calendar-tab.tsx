"use client";

import React, { useMemo, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { useTrades } from "@/lib/hooks";
import {
  buildCalendarMonth,
  monthSummary,
  MONTH_LABELS_FR,
  DAY_LABELS_FR,
  type CalendarDay,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  TrendingDown,
  Target,
  Percent,
  Flame,
  BarChart3,
  ArrowDownRight,
  ArrowUpRight,
  CalendarX2,
  DollarSign,
} from "lucide-react";

const MONTH_LABELS_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// Couleurs de base (RGB) pour les intensités de heatmap
const GREEN_RGB = "16, 185, 129"; // emerald
const RED_RGB = "239, 68, 68"; // red

/** Valeur affichée pour un jour : P&L si non nul, sinon R */
function dayDisplayValue(day: CalendarDay): number {
  return day.pnl !== 0 ? day.pnl : day.r;
}

function formatMoney(v: number, locale: string): string {
  const abs = Math.abs(v).toLocaleString(locale, { maximumFractionDigits: 0 });
  return `${v > 0 ? "+" : v < 0 ? "-" : ""}${abs}`;
}

function formatR(v: number): string {
  return `${v > 0 ? "+" : ""}${v.toFixed(2)}`;
}

// ─────────────────────────────────────────────────────────────
// PnlCalendarTab — Calendrier P&L mensuel (heatmap type TradeZella)
// ─────────────────────────────────────────────────────────────
export function PnlCalendarTab() {
  const { language, setSelectedTradeId, setShowTradeDetail } = useAppStore();
  const { trades, loading } = useTrades();

  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);

  const fr = language === "fr";
  const locale = fr ? "fr-FR" : "en-US";

  // Résumé du mois (P&L, R, win rate, jours verts/rouges, drawdown)
  const summary = useMemo(
    () => monthSummary(trades, year, month),
    [trades, year, month]
  );

  // Jours du mois pour la grille
  const days = useMemo(
    () => buildCalendarMonth(trades, year, month),
    [trades, year, month]
  );

  // Échelle d'intensité : max |valeur| du mois (plancher 1 pour éviter /0)
  const maxAbs = useMemo(() => {
    const vals = days.map(dayDisplayValue).map(Math.abs);
    return Math.max(1, ...vals);
  }, [days]);

  // Cellules vides en début de grille (semaine commençant lundi)
  const leadingBlanks = useMemo(() => {
    const firstWeekday = days[0]?.weekday ?? 1; // 1 = lundi
    return firstWeekday - 1;
  }, [days]);

  const monthTitle = fr ? MONTH_LABELS_FR[month - 1] : MONTH_LABELS_EN[month - 1];

  const goToPrevMonth = () => {
    if (month === 1) { setMonth(12); setYear((y) => y - 1); }
    else setMonth((m) => m - 1);
  };
  const goToNextMonth = () => {
    if (month === 12) { setMonth(1); setYear((y) => y + 1); }
    else setMonth((m) => m + 1);
  };
  const goToCurrentMonth = () => {
    setYear(now.getFullYear());
    setMonth(now.getMonth() + 1);
  };
  const isCurrentMonth = year === now.getFullYear() && month === now.getMonth() + 1;

  const openTradeDetail = (tradeId: string) => {
    setSelectedDay(null);
    setSelectedTradeId(tradeId);
    setShowTradeDetail(true);
  };

  const dayLabels = fr ? DAY_LABELS_FR : DAY_LABELS_EN;
  const todayISO = new Date().toISOString().slice(0, 10);

  // ─── Chargement ───
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-40" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-14 w-full" /></Card>
          ))}
        </div>
        <Card className="p-4">
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* ─── En-tête + navigation ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate">
            {fr ? "Calendrier P&L" : "P&L Calendar"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1 truncate">
            {fr
              ? "Performance jour par jour — cliquez sur un jour pour voir les trades"
              : "Day-by-day performance — click a day to see its trades"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="icon"
            onClick={goToPrevMonth}
            aria-label={fr ? "Mois précédent" : "Previous month"}
            className="h-11 w-11 shrink-0"
          >
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-[130px] text-center px-2 py-2 rounded-lg bg-muted/50 border border-border/50">
            <span className="text-sm font-semibold text-foreground whitespace-nowrap">
              {monthTitle} {year}
            </span>
          </div>
          <Button
            variant="outline"
            size="icon"
            onClick={goToNextMonth}
            aria-label={fr ? "Mois suivant" : "Next month"}
            className="h-11 w-11 shrink-0"
          >
            <ChevronRight className="w-4 h-4" />
          </Button>
          {!isCurrentMonth && (
            <Button
              variant="outline"
              size="sm"
              onClick={goToCurrentMonth}
              className="h-11 gap-1.5 text-xs min-h-[44px]"
            >
              <CalendarDays className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{fr ? "Aujourd'hui" : "Today"}</span>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Résumé du mois ─── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <MonthStatCard
          label={fr ? "P&L du mois" : "Month P&L"}
          value={`${summary.totalPnL > 0 ? "+" : ""}${summary.totalPnL.toLocaleString(locale, { maximumFractionDigits: 2 })}`}
          icon={DollarSign}
          valueClass={summary.totalPnL > 0 ? "text-profit" : summary.totalPnL < 0 ? "text-loss" : undefined}
        />
        <MonthStatCard
          label={fr ? "R total" : "Total R"}
          value={formatR(summary.totalRR)}
          icon={Target}
          valueClass={summary.totalRR > 0 ? "text-profit" : summary.totalRR < 0 ? "text-loss" : undefined}
        />
        <MonthStatCard
          label={fr ? "Win rate" : "Win rate"}
          value={`${summary.winRate.toFixed(1)}%`}
          icon={Percent}
        />
        <MonthStatCard
          label={fr ? "Jours verts / rouges" : "Green / red days"}
          value={`${summary.greenDays} / ${summary.redDays}`}
          icon={Flame}
        />
        <MonthStatCard
          label={fr ? "Max drawdown" : "Max drawdown"}
          value={`-${summary.maxDrawdownR.toFixed(2)}R`}
          icon={TrendingDown}
          valueClass="text-loss"
        />
        <MonthStatCard
          label={fr ? "Trades" : "Trades"}
          value={String(summary.totalTrades)}
          icon={BarChart3}
        />
      </div>

      {/* ─── Grille calendrier ─── */}
      <Card className="p-3 md:p-4">
        {/* Jours de la semaine */}
        <div className="grid grid-cols-7 gap-1.5 md:gap-2 mb-2">
          {dayLabels.map((label) => (
            <div
              key={label}
              className="text-center text-[10px] sm:text-xs font-semibold uppercase tracking-wider text-muted-foreground py-1"
            >
              {label}
            </div>
          ))}
        </div>

        {/* Cellules */}
        <div className="grid grid-cols-7 gap-1.5 md:gap-2">
          {Array.from({ length: leadingBlanks }).map((_, i) => (
            <div key={`blank-${i}`} className="min-h-[64px] sm:min-h-[84px] rounded-lg bg-muted/20" aria-hidden="true" />
          ))}

          {days.map((day) => {
            const displayValue = dayDisplayValue(day);
            const positive = displayValue > 0;
            const negative = displayValue < 0;
            // Intensité proportionnelle : 0 trade → neutre, faible → opacité basse, fort → opacité haute
            const ratio = day.count > 0 ? Math.min(1, Math.abs(displayValue) / maxAbs) : 0;
            const opacity = day.count > 0 ? 0.14 + 0.5 * ratio : 0;
            const rgb = positive ? GREEN_RGB : negative ? RED_RGB : null;
            const isToday = day.dateISO === todayISO;

            return (
              <button
                key={day.dateISO}
                onClick={() => day.count > 0 && setSelectedDay(day)}
                disabled={day.count === 0}
                aria-label={
                  day.count > 0
                    ? fr
                      ? `${day.dayOfMonth} ${monthTitle} : ${day.count} trade(s)`
                      : `${monthTitle} ${day.dayOfMonth}: ${day.count} trade(s)`
                    : undefined
                }
                className={cn(
                  "relative flex flex-col items-start justify-between min-h-[64px] sm:min-h-[84px] p-1.5 sm:p-2 rounded-lg border text-left transition-all duration-150",
                  day.count > 0
                    ? "border-border cursor-pointer hover:ring-2 hover:ring-primary/40 hover:z-10"
                    : "border-border/40 bg-muted/20 cursor-default",
                  isToday && "ring-1 ring-primary/60"
                )}
                style={
                  day.count > 0 && rgb
                    ? { backgroundColor: `rgba(${rgb}, ${opacity.toFixed(2)})` }
                    : undefined
                }
              >
                {/* Numéro du jour */}
                <span
                  className={cn(
                    "text-[10px] sm:text-xs font-semibold",
                    isToday ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  {day.dayOfMonth}
                </span>

                {day.count > 0 ? (
                  <div className="w-full space-y-0.5">
                    {/* P&L ou R du jour */}
                    <span
                      className={cn(
                        "block text-[11px] sm:text-sm font-bold font-mono leading-tight truncate",
                        positive && "text-profit",
                        negative && "text-loss"
                      )}
                    >
                      {day.pnl !== 0 ? formatMoney(day.pnl, locale) : `${formatR(day.r)}R`}
                    </span>
                    {/* Nombre de trades */}
                    <span className="block text-[9px] sm:text-[10px] text-muted-foreground leading-none">
                      {day.count} {day.count > 1 ? "trades" : "trade"}
                    </span>
                  </div>
                ) : null}

                {/* Points W/L (max 4) */}
                {day.count > 0 && (
                  <div className="absolute top-1.5 right-1.5 flex gap-0.5" aria-hidden="true">
                    {Array.from({ length: Math.min(day.count, 4) }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "w-1 h-1 rounded-full",
                          i < day.wins ? "bg-profit" : "bg-loss"
                        )}
                      />
                    ))}
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {/* Légende */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-3 border-t border-border/50">
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {fr ? "Intensité :" : "Intensity:"}
          </span>
          <div className="flex items-center gap-1.5">
            {[0.14, 0.3, 0.5, 0.64].map((o, i) => (
              <span
                key={`g-${i}`}
                className="w-5 h-3 rounded-sm border border-border/40"
                style={{ backgroundColor: `rgba(${GREEN_RGB}, ${o})` }}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">{fr ? "Gain" : "Profit"}</span>
          </div>
          <div className="flex items-center gap-1.5">
            {[0.14, 0.3, 0.5, 0.64].map((o, i) => (
              <span
                key={`r-${i}`}
                className="w-5 h-3 rounded-sm border border-border/40"
                style={{ backgroundColor: `rgba(${RED_RGB}, ${o})` }}
              />
            ))}
            <span className="text-[10px] text-muted-foreground ml-1">{fr ? "Perte" : "Loss"}</span>
          </div>
        </div>
      </Card>

      {/* ─── État vide du mois ─── */}
      {summary.totalTrades === 0 && (
        <Card className="p-10 text-center border-dashed">
          <CalendarX2 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">
            {fr
              ? "Aucun trade ce mois-ci — commence à journaliser !"
              : "No trades this month — start journaling!"}
          </p>
          {!isCurrentMonth && (
            <Button variant="outline" size="sm" className="mt-4" onClick={goToCurrentMonth}>
              <CalendarDays className="w-4 h-4 mr-2" />
              {fr ? "Revenir au mois courant" : "Back to current month"}
            </Button>
          )}
        </Card>
      )}

      {/* ─── Dialog : trades du jour ─── */}
      <Dialog open={!!selectedDay} onOpenChange={(open) => !open && setSelectedDay(null)}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] p-0 gap-0 overflow-hidden">
          {selectedDay && (
            <>
              <DialogHeader className="p-5 pb-3 border-b border-border bg-muted/30">
                <DialogTitle className="flex items-center gap-2 text-base">
                  <CalendarDays className="w-4 h-4 text-primary" />
                  {(() => {
                    const d = new Date(selectedDay.dateISO + "T12:00:00");
                    const label = fr
                      ? d.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })
                      : d.toLocaleDateString("en-US", { weekday: "long", day: "numeric", month: "long" });
                    return <span className="capitalize">{label}</span>;
                  })()}
                </DialogTitle>
                <DialogDescription className="sr-only">
                  {fr ? "Trades de la journée" : "Trades of the day"}
                </DialogDescription>
                <div className="flex items-center gap-2 mt-2 flex-wrap">
                  <Badge
                    className={cn(
                      "font-mono text-xs",
                      selectedDay.r > 0 && "bg-profit/15 text-profit border-profit/20",
                      selectedDay.r < 0 && "bg-loss/15 text-loss border-loss/20"
                    )}
                  >
                    {formatR(selectedDay.r)}R
                  </Badge>
                  {selectedDay.pnl !== 0 && (
                    <Badge
                      className={cn(
                        "font-mono text-xs",
                        selectedDay.pnl > 0 && "bg-profit/15 text-profit border-profit/20",
                        selectedDay.pnl < 0 && "bg-loss/15 text-loss border-loss/20"
                      )}
                    >
                      {formatMoney(selectedDay.pnl, locale)}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-xs">
                    {selectedDay.count} {fr ? "trades" : "trades"}
                  </Badge>
                  <Badge variant="outline" className="text-xs text-profit">
                    {selectedDay.wins}W
                  </Badge>
                  <Badge variant="outline" className="text-xs text-loss">
                    {selectedDay.losses}L
                  </Badge>
                </div>
              </DialogHeader>

              <ScrollArea className="max-h-[55vh]">
                <div className="p-4 space-y-2">
                  {selectedDay.trades.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-6">
                      {fr ? "Aucun trade ce jour" : "No trades this day"}
                    </p>
                  ) : (
                    selectedDay.trades.map((t, idx) => {
                      const isWin = t.result === "WIN";
                      const isLoss = t.result === "LOSS";
                      return (
                        <button
                          key={t.id}
                          onClick={() => openTradeDetail(t.id)}
                          className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-muted/20 hover:bg-muted/50 hover:border-primary/30 transition-all text-left min-h-[44px]"
                        >
                          <span className="text-[10px] text-muted-foreground font-mono w-5 shrink-0">
                            #{idx + 1}
                          </span>
                          {t.direction === "LONG" ? (
                            <ArrowUpRight className="w-4 h-4 text-profit shrink-0" />
                          ) : (
                            <ArrowDownRight className="w-4 h-4 text-loss shrink-0" />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold font-mono truncate">{t.pair}</span>
                              <span className="text-[10px] text-muted-foreground truncate">
                                {t.session}
                              </span>
                            </div>
                            <span className="text-[10px] text-muted-foreground">
                              {t.direction} · {t.timeframe}
                            </span>
                          </div>
                          <div className="text-right shrink-0">
                            <div
                              className={cn(
                                "text-sm font-bold font-mono",
                                (t.rr ?? 0) > 0 && "text-profit",
                                (t.rr ?? 0) < 0 && "text-loss"
                              )}
                            >
                              {t.rr != null ? `${formatR(t.rr)}R` : "—"}
                            </div>
                            {t.pnl != null && t.pnl !== 0 && (
                              <div className="text-[10px] text-muted-foreground font-mono">
                                {formatMoney(t.pnl, locale)}
                              </div>
                            )}
                          </div>
                          <Badge
                            className={cn(
                              "text-[10px] px-1.5 shrink-0",
                              isWin && "bg-profit/15 text-profit border-profit/20",
                              isLoss && "bg-loss/15 text-loss border-loss/20",
                              !isWin && !isLoss && "bg-gold/15 text-gold border-gold/20"
                            )}
                          >
                            {t.result || "—"}
                          </Badge>
                        </button>
                      );
                    })
                  )}
                </div>
              </ScrollArea>

              <Separator />
              <div className="p-3 text-center text-[10px] text-muted-foreground">
                {fr
                  ? "Cliquez sur un trade pour ouvrir la fiche détaillée"
                  : "Click a trade to open the detail view"}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────

function MonthStatCard({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ComponentType<{ className?: string }>;
  valueClass?: string;
}) {
  return (
    <Card className="p-3 sm:p-4 metric-glow">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[10px] sm:text-xs text-muted-foreground font-medium uppercase tracking-wider truncate">
          {label}
        </span>
        <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      </div>
      <div className={cn("text-lg sm:text-xl font-bold tracking-tight font-mono truncate", valueClass)}>
        {value}
      </div>
    </Card>
  );
}
