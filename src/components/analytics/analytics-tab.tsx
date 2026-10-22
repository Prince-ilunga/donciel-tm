"use client";

import React, { useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { useTrades } from "@/lib/hooks";
import { useTimeFilter } from "@/lib/use-time-filter";
import { TimeFilterBar } from "@/components/shared/time-filter-bar";
import {
  breakdown,
  dimensionLabel,
  DIMENSIONS,
  type BreakdownDimension,
  type GroupStats,
} from "@/lib/analytics";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  Radar,
  Compass,
  Trophy,
  AlertTriangle,
  BarChart3,
  Inbox,
} from "lucide-react";

// Palette : saphir pour les barres positives, rouge pour les négatives
const BAR_POSITIVE = "#38bdf8";
const BAR_NEGATIVE = "#ef4444";

interface Row extends GroupStats {
  key: string;
  label: string;
}

function truncateLabel(s: string, max = 16): string {
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

// ─────────────────────────────────────────────────────────────
// AnalyticsTab — Analyse 360° par dimension (breakdown)
// ─────────────────────────────────────────────────────────────
export function AnalyticsTab() {
  const { language } = useAppStore();
  const { period, setPeriod, filters } = useTimeFilter("all");
  const { trades, loading } = useTrades(filters);
  const [dimension, setDimension] = React.useState<BreakdownDimension>("pair");

  const fr = language === "fr";

  // Lignes : stats par groupe de la dimension, triées par RR total décroissant
  const rows = useMemo<Row[]>(() => {
    const groups = breakdown(trades, dimension);
    return Object.entries(groups)
      .map(([key, g]) => ({
        key,
        label: dimensionLabel(dimension, key, language),
        ...g,
      }))
      .sort((a, b) => b.totalRR - a.totalRR);
  }, [trades, dimension, language]);

  // Données du graphique (top 15 pour la lisibilité)
  const chartData = useMemo(
    () => rows.slice(0, 15).map((r) => ({ ...r, labelShort: truncateLabel(r.label) })),
    [rows]
  );

  // 🏆 Meilleur / ⚠️ Pire groupe (espérance moyenne en R, min 3 trades)
  const { best, worst } = useMemo(() => {
    const eligible = rows.filter((r) => r.count >= 3);
    if (eligible.length === 0) return { best: null, worst: null };
    const sorted = [...eligible].sort((a, b) => b.expectancy - a.expectancy);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    return { best: top, worst: top.key !== bottom.key ? bottom : null };
  }, [rows]);

  const hasData = trades.length > 0 && rows.length > 0;
  const chartHeight = Math.max(220, chartData.length * 34 + 40);

  // ─── Chargement ───
  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
        <Skeleton className="h-8 w-56" />
        <div className="flex flex-wrap gap-3">
          <Skeleton className="h-10 w-56" />
          <Skeleton className="h-10 w-72" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 2 }).map((_, i) => (
            <Card key={i} className="p-6"><Skeleton className="h-56 w-full" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* ─── En-tête ─── */}
      <div className="min-w-0">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground truncate flex items-center gap-2">
          <Radar className="w-5 h-5 sm:w-6 sm:h-6 text-primary shrink-0" />
          {fr ? "Analytics 360°" : "360° Analytics"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1 truncate">
          {fr
            ? "Découpe ta performance sous tous les angles : paire, session, setup, heure…"
            : "Slice your performance from every angle: pair, session, setup, hour…"}
        </p>
      </div>

      {/* ─── Filtres : période + dimension ─── */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <TimeFilterBar language={language} period={period} onPeriodChange={setPeriod} className="w-fit" />
        <div className="flex items-center gap-2 sm:ml-auto">
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider shrink-0">
            {fr ? "Dimension" : "Dimension"}
          </span>
          <Select value={dimension} onValueChange={(v) => setDimension(v as BreakdownDimension)}>
            <SelectTrigger className="w-full sm:w-[240px] min-h-[44px]" aria-label={fr ? "Choisir la dimension" : "Choose dimension"}>
              <SelectValue placeholder={fr ? "Dimension" : "Dimension"} />
            </SelectTrigger>
            <SelectContent>
              {DIMENSIONS.map((d) => (
                <SelectItem key={d.value} value={d.value}>
                  {fr ? d.labelFr : d.labelEn}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* ─── État vide ─── */}
      {!hasData ? (
        <Card className="p-12 text-center border-dashed">
          <Inbox className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground font-medium">
            {fr
              ? "Aucun trade sur cette période — élargis le filtre ou journalise tes trades."
              : "No trades in this period — widen the filter or journal your trades."}
          </p>
        </Card>
      ) : (
        <>
          {/* ─── Cartes Meilleur / Pire ─── */}
          {(best || worst) && (
            <div className={cn("grid gap-3", best && worst ? "grid-cols-1 md:grid-cols-2" : "grid-cols-1")}>
              {best && (
                <Card className="p-4 md:p-5 border-profit/30 bg-profit/[0.04]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-profit/15 text-profit flex items-center justify-center shrink-0">
                      <Trophy className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {fr ? "🏆 Meilleur" : "🏆 Best"} ({fr ? "≥ 3 trades" : "≥ 3 trades"})
                      </div>
                      <div className="text-base sm:text-lg font-bold text-foreground mt-0.5 truncate">
                        {best.label}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className="bg-profit/15 text-profit border-profit/20 font-mono text-xs">
                          {best.expectancy >= 0 ? "+" : ""}{best.expectancy.toFixed(2)}R {fr ? "moy." : "avg."}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{best.count} {fr ? "trades" : "trades"}</Badge>
                        <Badge variant="outline" className="text-[10px] text-profit">{best.winRate.toFixed(0)}% WR</Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">{best.totalRR >= 0 ? "+" : ""}{best.totalRR.toFixed(2)}R</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
              {worst && (
                <Card className="p-4 md:p-5 border-loss/30 bg-loss/[0.04]">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-loss/15 text-loss flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-5 h-5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
                        {fr ? "⚠️ Pire" : "⚠️ Worst"} ({fr ? "≥ 3 trades" : "≥ 3 trades"})
                      </div>
                      <div className="text-base sm:text-lg font-bold text-foreground mt-0.5 truncate">
                        {worst.label}
                      </div>
                      <div className="flex items-center gap-2 mt-2 flex-wrap">
                        <Badge className="bg-loss/15 text-loss border-loss/20 font-mono text-xs">
                          {worst.expectancy >= 0 ? "+" : ""}{worst.expectancy.toFixed(2)}R {fr ? "moy." : "avg."}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">{worst.count} {fr ? "trades" : "trades"}</Badge>
                        <Badge variant="outline" className="text-[10px] text-profit">{worst.winRate.toFixed(0)}% WR</Badge>
                        <Badge variant="outline" className="text-[10px] font-mono">{worst.totalRR >= 0 ? "+" : ""}{worst.totalRR.toFixed(2)}R</Badge>
                      </div>
                    </div>
                  </div>
                </Card>
              )}
            </div>
          )}

          {/* ─── Graphique : barres horizontales triées par RR total ─── */}
          <Card className="p-4 md:p-6">
            <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Compass className="w-4 h-4 text-primary" />
                {fr ? "RR total par" : "Total RR by"}{" "}
                <span className="text-primary">{fr ? DIMENSIONS.find((d) => d.value === dimension)?.labelFr.toLowerCase() : DIMENSIONS.find((d) => d.value === dimension)?.labelEn.toLowerCase()}</span>
              </h3>
              <span className="text-[10px] text-muted-foreground">
                {fr ? "Trié par RR total décroissant" : "Sorted by total RR (desc)"}
              </span>
            </div>
            {chartData.length === 0 ? (
              <div className="h-40 flex items-center justify-center text-sm text-muted-foreground">
                {fr ? "Aucune donnée pour cette dimension" : "No data for this dimension"}
              </div>
            ) : (
              <div style={{ height: chartHeight }} className="w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={chartData}
                    layout="vertical"
                    margin={{ top: 4, right: 30, left: 8, bottom: 4 }}
                  >
                    <CartesianGrid strokeDasharray="3,3" stroke="var(--border)" horizontal={false} />
                    <XAxis
                      type="number"
                      tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="labelShort"
                      width={110}
                      tick={{ fill: "var(--foreground)", fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "var(--muted)", opacity: 0.4 }}
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--popover-foreground)",
                        fontSize: "12px",
                      }}
                      formatter={(value: number | string, name: string) => {
                        if (name === "totalRR") return [`${Number(value).toFixed(2)}R`, fr ? "RR total" : "Total RR"];
                        return [value, name];
                      }}
                      labelFormatter={(_label: string) => {
                        // Affiche le nom complet (non tronqué) dans le tooltip
                        const full = chartData.find((d) => d.labelShort === _label);
                        return full?.label ?? _label;
                      }}
                    />
                    <Bar dataKey="totalRR" radius={[0, 4, 4, 0]} maxBarSize={22}>
                      {chartData.map((d, i) => (
                        <Cell key={i} fill={d.totalRR >= 0 ? BAR_POSITIVE : BAR_NEGATIVE} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </Card>

          {/* ─── Tableau détaillé (desktop) / cartes (mobile) ─── */}
          <Card className="p-4 md:p-6">
            <h3 className="text-sm font-semibold flex items-center gap-2 mb-4">
              <BarChart3 className="w-4 h-4 text-primary" />
              {fr ? "Détail par groupe" : "Group breakdown"}
              <Badge variant="outline" className="text-[10px] ml-1">{rows.length}</Badge>
            </h3>

            {/* Mobile : cartes empilées */}
            <div className="block md:hidden space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {rows.map((r) => (
                <div key={r.key} className="rounded-xl border border-border bg-muted/20 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold truncate">{r.label}</span>
                    <span
                      className={cn(
                        "text-sm font-bold font-mono shrink-0",
                        r.totalRR > 0 && "text-profit",
                        r.totalRR < 0 && "text-loss"
                      )}
                    >
                      {r.totalRR >= 0 ? "+" : ""}{r.totalRR.toFixed(2)}R
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 mt-2 text-center">
                    <MiniStat label={fr ? "Trades" : "Trades"} value={String(r.count)} />
                    <MiniStat label="WR" value={`${r.winRate.toFixed(0)}%`} />
                    <MiniStat label={fr ? "RR moy." : "Avg RR"} value={`${r.avgRR >= 0 ? "+" : ""}${r.avgRR.toFixed(2)}`} />
                    <MiniStat
                      label="P&L"
                      value={`${r.totalPnL >= 0 ? "+" : ""}${r.totalPnL.toFixed(0)}`}
                      className={r.totalPnL > 0 ? "text-profit" : r.totalPnL < 0 ? "text-loss" : undefined}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop : tableau */}
            <div className="hidden md:block">
              <ScrollArea className="max-h-[440px]">
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="font-semibold">{fr ? "Groupe" : "Group"}</TableHead>
                      <TableHead className="font-semibold text-center">{fr ? "Trades" : "Trades"}</TableHead>
                      <TableHead className="font-semibold text-center">{fr ? "Win rate" : "Win rate"}</TableHead>
                      <TableHead className="font-semibold text-center">{fr ? "RR total" : "Total RR"}</TableHead>
                      <TableHead className="font-semibold text-center">{fr ? "RR moyen" : "Avg RR"}</TableHead>
                      <TableHead className="font-semibold text-right">{fr ? "P&L" : "P&L"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((r) => (
                      <TableRow key={r.key}>
                        <TableCell className="font-medium max-w-[220px]">
                          <span className="truncate block" title={r.label}>{r.label}</span>
                        </TableCell>
                        <TableCell className="text-center font-mono">{r.count}</TableCell>
                        <TableCell className="text-center">
                          <span
                            className={cn(
                              "font-mono text-xs font-semibold",
                              r.winRate >= 50 ? "text-profit" : "text-loss"
                            )}
                          >
                            {r.winRate.toFixed(1)}%
                          </span>
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-center font-mono font-semibold",
                            r.totalRR > 0 && "text-profit",
                            r.totalRR < 0 && "text-loss"
                          )}
                        >
                          {r.totalRR >= 0 ? "+" : ""}{r.totalRR.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-center font-mono",
                            r.avgRR > 0 && "text-profit",
                            r.avgRR < 0 && "text-loss"
                          )}
                        >
                          {r.avgRR >= 0 ? "+" : ""}{r.avgRR.toFixed(2)}
                        </TableCell>
                        <TableCell
                          className={cn(
                            "text-right font-mono font-semibold",
                            r.totalPnL > 0 && "text-profit",
                            r.totalPnL < 0 && "text-loss"
                          )}
                        >
                          {r.totalPnL >= 0 ? "+" : ""}{r.totalPnL.toLocaleString(fr ? "fr-FR" : "en-US", { maximumFractionDigits: 2 })}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────

function MiniStat({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className="rounded-lg bg-background/60 border border-border/40 py-1.5 px-1">
      <div className="text-[9px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("text-xs font-bold font-mono", className)}>{value}</div>
    </div>
  );
}
