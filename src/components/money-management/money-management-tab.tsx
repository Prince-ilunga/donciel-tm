"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Wallet,
  TrendingUp,
  Target,
  CheckCircle2,
  Circle,
  RotateCcw,
  Calculator,
  Trophy,
  Clock,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ───────────────────────────────────────────────────
interface PallierData {
  capital: number;
  risque: number;
  rr: number;
  gagnants: number;
  perdants: number;
}

interface PallierConfig {
  id: number;
  trades: number;
  riskPct: number;
}

// ─── Default data from the Word document ────────────────────
const DEFAULT_PALLIERS: PallierData[] = [
  { capital: 20, risque: 2, rr: 4, gagnants: 5, perdants: 5 },
  { capital: 50, risque: 5, rr: 4, gagnants: 5, perdants: 5 },
  { capital: 125, risque: 12, rr: 4, gagnants: 5, perdants: 5 },
  { capital: 305, risque: 30, rr: 4, gagnants: 5, perdants: 5 },
  { capital: 755, risque: 75, rr: 4, gagnants: 5, perdants: 5 },
  { capital: 1880, risque: 94, rr: 4, gagnants: 10, perdants: 10 },
  { capital: 4700, risque: 235, rr: 4, gagnants: 10, perdants: 10 },
  { capital: 11750, risque: 587, rr: 4, gagnants: 10, perdants: 10 },
  { capital: 29360, risque: 1468, rr: 4, gagnants: 10, perdants: 10 },
  { capital: 73400, risque: 3670, rr: 4, gagnants: 10, perdants: 10 },
];

const PALLIER_CONFIGS: PallierConfig[] = DEFAULT_PALLIERS.map((_, i) => ({
  id: i + 1,
  trades: i < 5 ? 10 : 20,
  riskPct: i < 5 ? 10 : 5,
}));

// ─── Plan dates ─────────────────────────────────────────────
const START_DATE = new Date("2026-07-20T00:00:00");
const END_DATE = new Date("2027-12-31T23:59:59");
const INITIAL_CAPITAL = 20;
const TARGET_CAPITAL = 183500;

// ─── Helpers ────────────────────────────────────────────────
function calcPallier(d: PallierData) {
  const gainPerTrade = d.rr > 0 ? d.risque * d.rr : 0;
  const totalGains = gainPerTrade * d.gagnants;
  const totalLosses = d.risque * d.perdants;
  const newCapital = d.capital + totalGains - totalLosses;
  const actualRiskPct = d.capital > 0 ? (d.risque / d.capital) * 100 : 0;
  const netGain = totalGains - totalLosses;
  return { gainPerTrade, totalGains, totalLosses, newCapital, actualRiskPct, netGain };
}

function fmt(n: number) {
  return n.toLocaleString("fr-FR", { maximumFractionDigits: 2 });
}

// ─── Countdown hook ─────────────────────────────────────────
function useCountdown() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

// ─── Storage loaders (lazy init pattern, SSR-safe) ────────
function loadPaliers(user: { id: string } | null): PallierData[] {
  if (typeof window === "undefined") return DEFAULT_PALLIERS;
  try {
    const key = user ? `mm_paliers_${user.id}` : "mm_paliers_guest";
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as PallierData[];
      if (Array.isArray(parsed) && parsed.length === 10) return parsed;
    }
  } catch {
    /* ignore */
  }
  return DEFAULT_PALLIERS;
}

function loadValidated(user: { id: string } | null): boolean[] {
  if (typeof window === "undefined") return Array(10).fill(false);
  try {
    const key = user ? `mm_validated_${user.id}` : "mm_validated_guest";
    const raw = localStorage.getItem(key);
    if (raw) {
      const pv = JSON.parse(raw) as boolean[];
      if (Array.isArray(pv) && pv.length === 10) return pv;
    }
  } catch {
    /* ignore */
  }
  return Array(10).fill(false);
}

// ─── Main Component ─────────────────────────────────────────
export function MoneyManagementTab() {
  const { user, language } = useAppStore();

  const storageKey = user ? `mm_paliers_${user.id}` : "mm_paliers_guest";
  const validatedKey = user ? `mm_validated_${user.id}` : "mm_validated_guest";

  const [paliers, setPaliers] = useState<PallierData[]>(() => loadPaliers(user));
  const [validated, setValidated] = useState<boolean[]>(() => loadValidated(user));

  // Persist to localStorage whenever values change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(paliers));
    } catch {
      /* ignore */
    }
  }, [paliers, storageKey]);

  useEffect(() => {
    try {
      localStorage.setItem(validatedKey, JSON.stringify(validated));
    } catch {
      /* ignore */
    }
  }, [validated, validatedKey]);

  const updatePallier = useCallback(
    (index: number, field: keyof PallierData, value: number) => {
      setPaliers((prev) => {
        const next = [...prev];
        next[index] = { ...next[index], [field]: isNaN(value) ? 0 : value };
        return next;
      });
    },
    []
  );

  const toggleValidate = useCallback((index: number) => {
    setValidated((prev) => {
      const next = [...prev];
      next[index] = !next[index];
      return next;
    });
  }, []);

  const resetAll = useCallback(() => {
    setPaliers(DEFAULT_PALLIERS);
    setValidated(Array(10).fill(false));
    toast.success(
      language === "fr"
        ? "Paliers réinitialisés aux valeurs du document"
        : "Tiers reset to document values"
    );
  }, [language]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalTrades = PALLIER_CONFIGS.reduce((s, p) => s + p.trades, 0);
    const totalGagnants = paliers.reduce((s, p) => s + p.gagnants, 0);
    const totalPerdants = paliers.reduce((s, p) => s + p.perdants, 0);
    const finalCapital = paliers.length ? calcPallier(paliers[9]).newCapital : TARGET_CAPITAL;
    const totalRR = paliers.reduce((s, p) => s + p.rr * p.gagnants, 0);
    const validatedCount = validated.filter(Boolean).length;
    return { totalTrades, totalGagnants, totalPerdants, finalCapital, totalRR, validatedCount };
  }, [paliers, validated]);

  const now = useCountdown();
  const countdown = useMemo(() => {
    const beforeStart = now < START_DATE;
    const afterEnd = now > END_DATE;
    if (beforeStart) {
      const ms = START_DATE.getTime() - now.getTime();
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      const label = language === "fr" ? `Démarre dans ${d}j ${h}h` : `Starts in ${d}d ${h}h`;
      return { label, beforeStart: true, afterEnd: false, days: d, hours: h, minutes: 0, seconds: 0 };
    }
    if (afterEnd) {
      const label = language === "fr" ? "Plan terminé" : "Plan completed";
      return { label, beforeStart: false, afterEnd: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    }
    const ms = END_DATE.getTime() - now.getTime();
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    const label = `${d}j ${h}h ${m}m ${s}s`;
    return { label, beforeStart: false, afterEnd: false, days: d, hours: h, minutes: m, seconds: s };
  }, [now, language]);

  const progressPct = stats.validatedCount > 0 ? (stats.validatedCount / 10) * 100 : 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* ─── Header ─── */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Wallet className="w-6 h-6 text-primary" />
            {language === "fr" ? "MONEY MANAGEMENT" : "MONEY MANAGEMENT"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr"
              ? "Croissance progressive d'un petit capital sur 1 an et demi — 10 paliers à valider"
              : "Progressive growth of a small capital over 1.5 years — 10 tiers to validate"}
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={resetAll} className="gap-2 shrink-0">
          <RotateCcw className="w-3.5 h-3.5" />
          {language === "fr" ? "Réinitialiser" : "Reset"}
        </Button>
      </div>

      {/* ─── Countdown + Progress ─── */}
      <Card className="p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row gap-5 items-stretch lg:items-center">
          {/* Countdown */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <Clock className="w-3.5 h-3.5" />
              {language === "fr" ? "Compteur de la montante" : "Count-up timer"}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl md:text-4xl font-bold font-mono tabular-nums text-foreground">
                {countdown.label}
              </span>
              {countdown.beforeStart && (
                <Badge variant="secondary" className="text-xs">
                  {language === "fr" ? "Départ le 20 juil. 2026" : "Starts Jul 20, 2026"}
                </Badge>
              )}
              {countdown.afterEnd && (
                <Badge className="bg-profit text-white text-xs">
                  <Trophy className="w-3 h-3 mr-1" />
                  {language === "fr" ? "Atteint" : "Reached"}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5">
              {language === "fr"
                ? "Du 15 juil. 2026 au 31 déc. 2027 (1 an et demi)"
                : "From Jul 15, 2026 to Dec 31, 2027 (1.5 years)"}
            </p>
          </div>

          <Separator orientation="vertical" className="hidden lg:block h-16" />

          {/* Progress validation */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" />
                {language === "fr" ? "Paliers validés" : "Tiers validated"}
              </span>
              <span className="text-sm font-bold font-mono">{stats.validatedCount}/10</span>
            </div>
            <Progress value={progressPct} className="h-2.5" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {language === "fr"
                ? "Cochez chaque palier au fur et à mesure de l'évolution de vos positions"
                : "Check each tier as your positions evolve"}
            </p>
          </div>
        </div>
      </Card>

      {/* ─── Summary Stats ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <Wallet className="w-3 h-3" />
            {language === "fr" ? "Capital Initial" : "Initial Capital"}
          </div>
          <div className="text-xl font-bold font-mono">${fmt(INITIAL_CAPITAL)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <TrendingUp className="w-3 h-3" />
            {language === "fr" ? "Gain Prévu" : "Expected Gain"}
          </div>
          <div className="text-xl font-bold font-mono text-profit">${fmt(TARGET_CAPITAL)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <Target className="w-3 h-3" />
            {language === "fr" ? "Total Trades" : "Total Trades"}
          </div>
          <div className="text-xl font-bold font-mono">{stats.totalTrades}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <Sparkles className="w-3 h-3" />
            {language === "fr" ? "Total RR" : "Total RR"}
          </div>
          <div className="text-xl font-bold font-mono">{fmt(stats.totalRR)}R</div>
        </Card>
      </div>

      {/* ─── 10 Palliers ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {language === "fr" ? "Les 10 Paliers" : "The 10 Tiers"}
          </h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {language === "fr" ? "Palettes modifiables — calcul automatique" : "Editable palettes — automatic calculation"}
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {paliers.map((p, i) => (
            <PallierCard
              key={i}
              index={i}
              data={p}
              config={PALLIER_CONFIGS[i]}
              validated={validated[i]}
              language={language}
              onUpdate={updatePallier}
              onToggleValidate={toggleValidate}
            />
          ))}
        </div>
      </div>

      {/* ─── Results summary ─── */}
      <Card className="p-5">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-2">
          <Trophy className="w-4 h-4 text-primary" />
          {language === "fr" ? "Résultats Globaux" : "Global Results"}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {language === "fr" ? "Total Trades" : "Total Trades"}
            </div>
            <div className="text-lg font-bold font-mono">{stats.totalTrades}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {language === "fr" ? "Gagnants" : "Winners"}
            </div>
            <div className="text-lg font-bold font-mono text-profit">{stats.totalGagnants}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {language === "fr" ? "Perdants" : "Losers"}
            </div>
            <div className="text-lg font-bold font-mono text-loss">{stats.totalPerdants}</div>
          </div>
          <div>
            <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {language === "fr" ? "Capital Final" : "Final Capital"}
            </div>
            <div className="text-lg font-bold font-mono text-profit">${fmt(stats.finalCapital)}</div>
          </div>
        </div>
      </Card>

      {/* ─── Citation ─── */}
      <Card className="p-6 md:p-8 relative overflow-hidden bg-gradient-to-br from-primary/8 via-card to-primary/8 border-primary/20">
        <div className="absolute top-3 left-4 text-6xl text-primary/15 font-serif leading-none select-none pointer-events-none">
          &ldquo;
        </div>
        <div className="relative">
          <blockquote className="text-center text-foreground/90 font-medium leading-relaxed text-sm md:text-base italic max-w-3xl mx-auto">
            {language === "fr"
              ? "PRINCE CE N'EST PAS LA PEINE DE COURIR VITE, TU PEUX ALLER PAS À PAS ET RÉALISER TES RÊVES. SI TU VEUX COURIR VITE, RAPPELLE-TOI QUE TU N'AS PAS COMMENCÉ AUJOURD'HUI SANS SUCCÈS, SOIS DISCIPLINÉ ET RESPECTE CE PLAN, TA VIE VA CHANGER À JAMAIS !"
              : "PRINCE, THERE IS NO NEED TO RUN FAST, YOU CAN GO STEP BY STEP AND ACHIEVE YOUR DREAMS. IF YOU WANT TO RUN FAST, REMEMBER THAT YOU DID NOT START TODAY WITHOUT SUCCESS, BE DISCIPLINED AND RESPECT THIS PLAN, YOUR LIFE WILL CHANGE FOREVER!"}
          </blockquote>
          <div className="text-center mt-3 text-xs text-muted-foreground uppercase tracking-widest">
            — {language === "fr" ? "Plan Money Management" : "Money Management Plan"}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ─── Pallier Card (Palette) ─────────────────────────────────
function PallierCard({
  index,
  data,
  config,
  validated,
  language,
  onUpdate,
  onToggleValidate,
}: {
  index: number;
  data: PallierData;
  config: PallierConfig;
  validated: boolean;
  language: "fr" | "en";
  onUpdate: (index: number, field: keyof PallierData, value: number) => void;
  onToggleValidate: (index: number) => void;
}) {
  const calc = useMemo(() => calcPallier(data), [data]);
  const num = index + 1;

  const fieldCls = "h-8 text-sm font-mono px-2 bg-background border-border focus-visible:ring-primary";

  return (
    <Card className={cn("p-4 transition-all", validated ? "border-profit/40 bg-profit/5 shadow-sm" : "border-border")}>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm shrink-0", validated ? "bg-profit text-white" : "bg-primary/10 text-primary")}>
            {num}
          </div>
          <div>
            <div className="text-sm font-semibold leading-tight">
              {language === "fr" ? "PALLIER" : "TIER"} {num}
            </div>
            <div className="text-[11px] text-muted-foreground leading-tight">
              {config.trades} {language === "fr" ? "trades" : "trades"} · {language === "fr" ? "Risque" : "Risk"} {config.riskPct}%
            </div>
          </div>
        </div>
        <Button
          variant={validated ? "default" : "outline"}
          size="sm"
          onClick={() => onToggleValidate(index)}
          className={cn("gap-1.5 h-8 text-xs shrink-0", validated && "bg-profit hover:bg-profit/90 text-white")}
        >
          {validated ? (
            <>
              <CheckCircle2 className="w-3.5 h-3.5" />
              {language === "fr" ? "Validé" : "Validated"}
            </>
          ) : (
            <>
              <Circle className="w-3.5 h-3.5" />
              {language === "fr" ? "Valider" : "Validate"}
            </>
          )}
        </Button>
      </div>

      {/* Editable fields */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 mb-3">
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {language === "fr" ? "Capital ($)" : "Capital ($)"}
          </Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={data.capital}
            onChange={(e) => onUpdate(index, "capital", parseFloat(e.target.value))}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {language === "fr" ? "Risque/Pos ($)" : "Risk/Pos ($)"}
          </Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={data.risque}
            onChange={(e) => onUpdate(index, "risque", parseFloat(e.target.value))}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">RR (1:x)</Label>
          <Input
            type="number"
            min={0}
            step="any"
            value={data.rr}
            onChange={(e) => onUpdate(index, "rr", parseFloat(e.target.value))}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {language === "fr" ? "Gagnants" : "Winners"}
          </Label>
          <Input
            type="number"
            min={0}
            step="1"
            value={data.gagnants}
            onChange={(e) => onUpdate(index, "gagnants", parseInt(e.target.value, 10))}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {language === "fr" ? "Perdants" : "Losers"}
          </Label>
          <Input
            type="number"
            min={0}
            step="1"
            value={data.perdants}
            onChange={(e) => onUpdate(index, "perdants", parseInt(e.target.value, 10))}
            className={fieldCls}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] uppercase tracking-wider text-muted-foreground">
            {language === "fr" ? "Risque réel %" : "Actual Risk %"}
          </Label>
          <div className="h-8 flex items-center px-2 rounded-md border border-dashed border-border bg-muted/30 text-sm font-mono">
            {fmt(calc.actualRiskPct)}%
          </div>
        </div>
      </div>

      {/* Auto-calculator */}
      <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 space-y-2">
        <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary font-semibold">
          <Calculator className="w-3 h-3" />
          {language === "fr" ? "Calcul Automatique" : "Auto Calculation"}
        </div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
          <CalcRow label={language === "fr" ? "Gain/trade" : "Gain/trade"} value={`$${fmt(calc.gainPerTrade)}`} />
          <CalcRow label={language === "fr" ? "Total gains" : "Total gains"} value={`$${fmt(calc.totalGains)}`} valueClass="text-profit" />
          <CalcRow label={language === "fr" ? "Total pertes" : "Total losses"} value={`-$${fmt(calc.totalLosses)}`} valueClass="text-loss" />
          <CalcRow label={language === "fr" ? "Net palier" : "Tier net"} value={`${calc.netGain >= 0 ? "+" : ""}$${fmt(calc.netGain)}`} valueClass={calc.netGain >= 0 ? "text-profit" : "text-loss"} />
        </div>
        <Separator className="my-1" />
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
            {language === "fr" ? "Total Solde" : "Total Balance"}
          </span>
          <span className="text-base font-bold font-mono text-primary flex items-center gap-1">
            <ArrowRight className="w-3.5 h-3.5" />${fmt(calc.newCapital)}
          </span>
        </div>
      </div>
    </Card>
  );
}

function CalcRow({
  label,
  value,
  valueClass,
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground truncate">{label}</span>
      <span className={cn("font-mono font-semibold tabular-nums", valueClass)}>{value}</span>
    </div>
  );
}
