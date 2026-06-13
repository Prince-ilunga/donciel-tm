"use client";

import React, { useMemo, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useStats, useTrades } from "@/lib/hooks";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Target,
  TrendingUp,
  BarChart3,
  DollarSign,
  Calculator,
  CheckCircle2,
  Circle,
  Play,
  Video,
  Trophy,
} from "lucide-react";

// ─── Phase Config ──────────────────────────────────────────────
const PHASE_1_CYCLES = 4;
const PHASE_1_TRADES_PER_CYCLE = 25;
const PHASE_2_CYCLES = 4;
const PHASE_2_TRADES_PER_CYCLE = 50;
const TOTAL_TRADES_TARGET = 300;
const TOTAL_CYCLES = 8;

// ─── Main Component ────────────────────────────────────────────
export function ExecutionTab() {
  const { language } = useAppStore();
  const { stats, loading: statsLoading, refetch: refetchStats } = useStats();
  const { trades, loading: tradesLoading, refetch: refetchTrades } = useTrades();

  useEffect(() => {
    refetchStats();
    refetchTrades();
  }, [refetchStats, refetchTrades]);

  const statsData = (stats as any)?.stats ?? stats;
  const totalTrades = statsData?.totalTrades ?? 0;
  const totalRR = statsData?.totalRR ?? 0;
  const avgRR = statsData?.avgRR ?? 0;
  const totalPnL = statsData?.totalPnL ?? 0;

  // Calculate cycles completed
  const phase1CompletedCycles = Math.min(
    PHASE_1_CYCLES,
    Math.floor(Math.max(0, totalTrades) / PHASE_1_TRADES_PER_CYCLE)
  );
  const phase1RemainingTrades = Math.max(0, PHASE_1_CYCLES * PHASE_1_TRADES_PER_CYCLE - totalTrades);
  const phase2StartTrades = PHASE_1_CYCLES * PHASE_1_TRADES_PER_CYCLE;

  const phase2CompletedCycles = totalTrades > phase2StartTrades
    ? Math.min(PHASE_2_CYCLES, Math.floor((totalTrades - phase2StartTrades) / PHASE_2_TRADES_PER_CYCLE))
    : 0;

  const totalCyclesCompleted = phase1CompletedCycles + phase2CompletedCycles;

  // Progress percentage
  const progressPercent = Math.min(100, (totalTrades / TOTAL_TRADES_TARGET) * 100);

  // Cycle details
  const getCycleStatus = (cycleIndex: number, phase: 1 | 2) => {
    const tradesPerCycle = phase === 1 ? PHASE_1_TRADES_PER_CYCLE : PHASE_2_TRADES_PER_CYCLE;
    const phaseStart = phase === 1 ? 0 : phase2StartTrades;
    const cycleStart = phaseStart + cycleIndex * tradesPerCycle;
    const cycleEnd = cycleStart + tradesPerCycle;

    if (totalTrades >= cycleEnd) return { status: "completed" as const, progress: 100, tradesInCycle: tradesPerCycle };
    if (totalTrades > cycleStart) return { status: "in_progress" as const, progress: ((totalTrades - cycleStart) / tradesPerCycle) * 100, tradesInCycle: totalTrades - cycleStart };
    return { status: "locked" as const, progress: 0, tradesInCycle: 0 };
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            {t(language, "executionDonciel")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr" ? "Progression en 8 cycles vers 300 trades" : "8-cycle progression towards 300 trades"}
          </p>
        </div>

      </div>

      {/* ─── Top Stats ─────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        {/* Progression totale */}
        <Card className="p-4 relative overflow-hidden">
          <div className="absolute top-0 left-0 right-0 h-1 bg-primary/20">
            <div className="h-full bg-primary transition-all duration-500" style={{ width: `${progressPercent}%` }} />
          </div>
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {t(language, "progressionTotal")}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono">{totalTrades}</span>
            <span className="text-sm text-muted-foreground">/ {TOTAL_TRADES_TARGET} {t(language, "tradesTarget")}</span>
          </div>
          <Progress value={progressPercent} className="h-1.5 mt-2" />
        </Card>

        {/* Cycles validés */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 className="w-4 h-4 text-profit" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {t(language, "cyclesValide")}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-bold font-mono text-profit">{totalCyclesCompleted}</span>
            <span className="text-sm text-muted-foreground">/ {TOTAL_CYCLES}</span>
          </div>
          <div className="flex gap-1 mt-2">
            {Array.from({ length: TOTAL_CYCLES }).map((_, i) => (
              <div
                key={i}
                className={cn(
                  "h-2 flex-1 rounded-full transition-colors",
                  i < totalCyclesCompleted ? "bg-profit" : "bg-muted"
                )}
              />
            ))}
          </div>
        </Card>

        {/* RR Cumulé + Montant gagné */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {t(language, "rrCumule")} + {t(language, "montantGagne")}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-2xl font-bold font-mono", totalRR >= 0 ? "text-profit" : "text-loss")}>
              {totalRR >= 0 ? "+" : ""}{totalRR.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">RR</span>
          </div>
          <div className="flex items-baseline gap-1.5 mt-1">
            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
            <span className={cn("text-lg font-bold font-mono", totalPnL >= 0 ? "text-profit" : "text-loss")}>
              {totalPnL >= 0 ? "+" : ""}{totalPnL.toFixed(2)}$
            </span>
          </div>
        </Card>

        {/* RR Moyen */}
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Calculator className="w-4 h-4 text-primary" />
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-medium">
              {t(language, "rrMoyen")}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className={cn("text-2xl font-bold font-mono", avgRR >= 0 ? "text-profit" : "text-loss")}>
              {avgRR >= 0 ? "+" : ""}{avgRR.toFixed(2)}
            </span>
            <span className="text-xs text-muted-foreground">RR</span>
          </div>
          {statsData?.winRate !== undefined && (
            <Badge variant="outline" className="mt-2 text-[10px]">
              WR: {(statsData.winRate ?? 0).toFixed(1)}%
            </Badge>
          )}
        </Card>
      </div>

      <Separator />

      {/* ─── PHASE INITIALE ────────────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            <Video className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-base font-bold uppercase tracking-wider">
              {t(language, "phaseInitiale")} — {t(language, "videosDuSetup")}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t(language, "evolutionApprentissage")}
            </p>
          </div>
        </div>
        <Card className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-xl bg-primary/5 border border-primary/10 flex items-center justify-center">
              <Play className="w-8 h-8 text-primary/40" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">
                {language === "fr"
                  ? "Regardez les vidéos du setup pour commencer votre apprentissage DONCIEL."
                  : "Watch setup videos to start your DONCIEL learning journey."}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-2 gap-2"
                onClick={() => useAppStore.getState().setActiveTab("videos")}
              >
                <Video className="w-3.5 h-3.5" />
                {language === "fr" ? "Voir les vidéos" : "Watch videos"}
              </Button>
            </div>
          </div>
        </Card>
      </div>

      <Separator />

      {/* ─── PHASE 1 ───────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-profit/10 flex items-center justify-center">
            <Trophy className="w-4 h-4 text-profit" />
          </div>
          <div>
            <h3 className="text-base font-bold uppercase tracking-wider">
              {t(language, "phase1")} : 100 trades
            </h3>
            <p className="text-xs text-muted-foreground">
              {PHASE_1_CYCLES} cycles × {PHASE_1_TRADES_PER_CYCLE} {t(language, "tradesPerCycle")}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            {Math.min(totalTrades, 100)}/100
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: PHASE_1_CYCLES }).map((_, i) => {
            const cycle = getCycleStatus(i, 1);
            return (
              <Card
                key={`p1c${i}`}
                className={cn(
                  "p-4 transition-all duration-300 cursor-default",
                  cycle.status === "completed" && "border-profit/30 bg-profit/5",
                  cycle.status === "in_progress" && "border-primary/30 bg-primary/5",
                  cycle.status === "locked" && "opacity-50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {t(language, "cycle")} {i + 1}
                  </span>
                  {cycle.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-profit" />
                  ) : cycle.status === "in_progress" ? (
                    <Play className="w-4 h-4 text-primary" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono">
                    {cycle.tradesInCycle}
                  </span>
                  <span className="text-xs text-muted-foreground">/ {PHASE_1_TRADES_PER_CYCLE}</span>
                </div>
                <Progress
                  value={cycle.progress}
                  className={cn(
                    "h-1.5 mt-2",
                    cycle.status === "completed" && "[&>div]:bg-profit",
                    cycle.status === "in_progress" && "[&>div]:bg-primary"
                  )}
                />
              </Card>
            );
          })}
        </div>
      </div>

      <Separator />

      {/* ─── PHASE 2 ───────────────────────────────── */}
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gold/10 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-gold" />
          </div>
          <div>
            <h3 className="text-base font-bold uppercase tracking-wider">
              {t(language, "phase2")} : 200 trades
            </h3>
            <p className="text-xs text-muted-foreground">
              {PHASE_2_CYCLES} cycles × {PHASE_2_TRADES_PER_CYCLE} {t(language, "tradesPerCycle")}
            </p>
          </div>
          <Badge variant="outline" className="ml-auto text-xs font-mono">
            {Math.min(Math.max(totalTrades - 100, 0), 200)}/200
          </Badge>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: PHASE_2_CYCLES }).map((_, i) => {
            const cycle = getCycleStatus(i, 2);
            const isLocked = totalTrades < phase2StartTrades;
            return (
              <Card
                key={`p2c${i}`}
                className={cn(
                  "p-4 transition-all duration-300 cursor-default",
                  cycle.status === "completed" && "border-gold/30 bg-gold/5",
                  cycle.status === "in_progress" && "border-primary/30 bg-primary/5",
                  (cycle.status === "locked" || isLocked) && "opacity-50"
                )}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">
                    {t(language, "cycle")} {i + 1}
                  </span>
                  {cycle.status === "completed" ? (
                    <CheckCircle2 className="w-4 h-4 text-gold" />
                  ) : cycle.status === "in_progress" ? (
                    <Play className="w-4 h-4 text-primary" />
                  ) : (
                    <Circle className="w-4 h-4 text-muted-foreground/30" />
                  )}
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-xl font-bold font-mono">
                    {isLocked ? 0 : cycle.tradesInCycle}
                  </span>
                  <span className="text-xs text-muted-foreground">/ {PHASE_2_TRADES_PER_CYCLE}</span>
                </div>
                <Progress
                  value={isLocked ? 0 : cycle.progress}
                  className={cn(
                    "h-1.5 mt-2",
                    cycle.status === "completed" && "[&>div]:bg-gold",
                    cycle.status === "in_progress" && "[&>div]:bg-primary"
                  )}
                />
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
}
