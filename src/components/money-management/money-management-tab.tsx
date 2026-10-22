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
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
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
  Settings2,
  Quote,
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

interface MMConfig {
  initialCapital: number;
  targetMultiple: number; // ex: 10 = objectif ×10 le capital initial
  riskPct: number; // % du capital risqué par trade
  rr: number; // ratio gain:perte visé
  winRatePct: number; // % de trades gagnants attendus
  tradesPerTier: number; // trades par palier
  tierCount: number; // nombre de paliers
  startDate: string; // ISO date
  horizonMonths: number; // horizon de temps estimé
  mantra: string; // motivation personnelle de l'utilisateur
}

// ─── Default config (generic, works for anyone) ──────────────
const DEFAULT_CONFIG: MMConfig = {
  initialCapital: 100,
  targetMultiple: 10,
  riskPct: 5,
  rr: 3,
  winRatePct: 50,
  tradesPerTier: 10,
  tierCount: 10,
  startDate: new Date().toISOString().slice(0, 10),
  horizonMonths: 12,
  mantra: "",
};

const DEFAULT_MANTRA =
  "LA DISCIPLINE BAT LA PRÉDICTION. PETITS PAS, GROS RÉSULTATS — JE RESPECTE MON PLAN, TRADE APRÈS TRADE, ET MON CAPITAL GRANDIT INÉVITABLEMENT.";

// ─── Plan generation from config ─────────────────────────────
function generatePaliers(c: MMConfig): PallierData[] {
  const paliers: PallierData[] = [];
  const gagnants = Math.max(0, Math.round((c.tradesPerTier * c.winRatePct) / 100));
  const perdants = Math.max(0, c.tradesPerTier - gagnants);
  let capital = Math.max(1, c.initialCapital);
  for (let i = 0; i < Math.max(1, Math.min(30, c.tierCount)); i++) {
    const risque = +((capital * c.riskPct) / 100).toFixed(2);
    paliers.push({ capital: +capital.toFixed(2), risque, rr: c.rr, gagnants, perdants });
    const gainPerTrade = risque * c.rr;
    capital = capital + gainPerTrade * gagnants - risque * perdants;
  }
  return paliers;
}

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
function loadConfig(user: { id: string } | null): MMConfig | null {
  if (typeof window === "undefined") return null;
  try {
    const key = user ? `mm_config_${user.id}` : "mm_config_guest";
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as MMConfig;
      if (parsed && typeof parsed.initialCapital === "number" && typeof parsed.tierCount === "number") {
        return { ...DEFAULT_CONFIG, ...parsed };
      }
    }
  } catch {
    /* ignore */
  }
  return null;
}

function loadPaliers(user: { id: string } | null): PallierData[] {
  if (typeof window === "undefined") return [];
  try {
    const key = user ? `mm_paliers_${user.id}` : "mm_paliers_guest";
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as PallierData[];
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch {
    /* ignore */
  }
  return [];
}

function loadValidated(user: { id: string } | null, count: number): boolean[] {
  const fallback = () => Array(count).fill(false);
  if (typeof window === "undefined") return fallback();
  try {
    const key = user ? `mm_validated_${user.id}` : "mm_validated_guest";
    const raw = localStorage.getItem(key);
    if (raw) {
      const pv = JSON.parse(raw) as boolean[];
      if (Array.isArray(pv) && pv.length === count) return pv;
    }
  } catch {
    /* ignore */
  }
  return fallback();
}

// ─── Main Component ─────────────────────────────────────────
export function MoneyManagementTab() {
  const { user, language } = useAppStore();

  const storageKey = user ? `mm_paliers_${user.id}` : "mm_paliers_guest";
  const validatedKey = user ? `mm_validated_${user.id}` : "mm_validated_guest";
  const configKey = user ? `mm_config_${user.id}` : "mm_config_guest";

  const [config, setConfig] = useState<MMConfig>(() => loadConfig(user) || DEFAULT_CONFIG);
  const [paliers, setPaliers] = useState<PallierData[]>(() => {
    const stored = loadPaliers(user);
    return stored.length > 0 ? stored : generatePaliers(loadConfig(user) || DEFAULT_CONFIG);
  });
  const [validated, setValidated] = useState<boolean[]>(() => {
    const stored = loadPaliers(user);
    const count = stored.length > 0 ? stored.length : generatePaliers(loadConfig(user) || DEFAULT_CONFIG).length;
    return loadValidated(user, count);
  });
  const [configOpen, setConfigOpen] = useState(false);
  const [mantraOpen, setMantraOpen] = useState(false);

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

  useEffect(() => {
    try {
      localStorage.setItem(configKey, JSON.stringify(config));
    } catch {
      /* ignore */
    }
  }, [config, configKey]);

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

  const handleGenerate = useCallback(() => {
    const generated = generatePaliers(config);
    setPaliers(generated);
    setValidated(Array(generated.length).fill(false));
    setConfigOpen(false);
    toast.success(
      language === "fr"
        ? `Plan généré : ${generated.length} paliers, objectif ×${config.targetMultiple}`
        : `Plan generated: ${generated.length} tiers, ×${config.targetMultiple} target`
    );
  }, [config, language]);

  const resetAll = useCallback(() => {
    const c = { ...DEFAULT_CONFIG, mantra: config.mantra };
    setConfig(c);
    const generated = generatePaliers(c);
    setPaliers(generated);
    setValidated(Array(generated.length).fill(false));
    toast.success(
      language === "fr"
        ? "Plan réinitialisé (ta motivation personnelle conservée)"
        : "Plan reset (your personal mantra kept)"
    );
  }, [language, config.mantra]);

  // Aggregate stats
  const stats = useMemo(() => {
    const totalTrades = paliers.reduce((s, p) => s + p.gagnants + p.perdants, 0);
    const totalGagnants = paliers.reduce((s, p) => s + p.gagnants, 0);
    const totalPerdants = paliers.reduce((s, p) => s + p.perdants, 0);
    const finalCapital = paliers.length ? calcPallier(paliers[paliers.length - 1]).newCapital : config.initialCapital;
    const targetCapital = config.initialCapital * config.targetMultiple;
    const totalRR = paliers.reduce((s, p) => s + p.rr * p.gagnants, 0);
    const validatedCount = validated.filter(Boolean).length;
    return { totalTrades, totalGagnants, totalPerdants, finalCapital, targetCapital, totalRR, validatedCount };
  }, [paliers, validated, config]);

  const now = useCountdown();
  const countdown = useMemo(() => {
    const start = new Date(config.startDate + "T00:00:00");
    const end = new Date(start);
    end.setMonth(end.getMonth() + Math.max(1, config.horizonMonths));
    const beforeStart = now < start;
    const afterEnd = now > end;
    const fr = language === "fr";
    if (beforeStart) {
      const ms = start.getTime() - now.getTime();
      const d = Math.floor(ms / 86400000);
      const h = Math.floor((ms % 86400000) / 3600000);
      return {
        label: fr ? `Démarre dans ${d}j ${h}h` : `Starts in ${d}d ${h}h`,
        beforeStart: true,
        afterEnd: false,
      };
    }
    if (afterEnd) {
      return { label: fr ? "Horizon atteint" : "Horizon reached", beforeStart: false, afterEnd: true };
    }
    const ms = end.getTime() - now.getTime();
    const d = Math.floor(ms / 86400000);
    const h = Math.floor((ms % 86400000) / 3600000);
    const m = Math.floor((ms % 3600000) / 60000);
    const s = Math.floor((ms % 60000) / 1000);
    return { label: `${d}j ${h}h ${m}m ${s}s`, beforeStart: false, afterEnd: false };
  }, [now, language, config.startDate, config.horizonMonths]);

  const progressPct = paliers.length > 0 ? (stats.validatedCount / paliers.length) * 100 : 0;

  const currentMantra = config.mantra.trim() || DEFAULT_MANTRA;

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
              ? "Ton plan de croissance personnalisé — configure-le selon TA vision, TES moyens et TES objectifs"
              : "Your personalized growth plan — configure it for YOUR vision, YOUR means and YOUR goals"}
          </p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={() => setConfigOpen(true)} className="gap-2">
            <Settings2 className="w-3.5 h-3.5" />
            {language === "fr" ? "Configurer" : "Configure"}
          </Button>
          <Button variant="outline" size="sm" onClick={resetAll} className="gap-2">
            <RotateCcw className="w-3.5 h-3.5" />
            {language === "fr" ? "Réinitialiser" : "Reset"}
          </Button>
        </div>
      </div>

      {/* ─── Countdown + Progress ─── */}
      <Card className="p-5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5 pointer-events-none" />
        <div className="relative flex flex-col lg:flex-row gap-5 items-stretch lg:items-center">
          {/* Countdown */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              <Clock className="w-3.5 h-3.5" />
              {language === "fr" ? "Temps avant la fin de l'horizon" : "Time to horizon end"}
            </div>
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-3xl md:text-4xl font-bold font-mono tabular-nums text-foreground">
                {countdown.label}
              </span>
              {countdown.beforeStart && (
                <Badge variant="secondary" className="text-xs">
                  {language === "fr" ? `Départ le ${config.startDate}` : `Starts ${config.startDate}`}
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
                ? `Du ${config.startDate} + ${config.horizonMonths} mois (horizon configurable)`
                : `From ${config.startDate} + ${config.horizonMonths} months (configurable horizon)`}
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
              <span className="text-sm font-bold font-mono">
                {stats.validatedCount}/{paliers.length}
              </span>
            </div>
            <Progress value={progressPct} className="h-2.5" />
            <p className="text-xs text-muted-foreground mt-1.5">
              {language === "fr"
                ? "Coche chaque palier au fur et à mesure de l'évolution de tes positions"
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
          <div className="text-xl font-bold font-mono">${fmt(config.initialCapital)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <Target className="w-3 h-3" />
            {language === "fr" ? `Objectif (×${config.targetMultiple})` : `Target (×${config.targetMultiple})`}
          </div>
          <div className="text-xl font-bold font-mono text-profit">${fmt(stats.targetCapital)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <TrendingUp className="w-3 h-3" />
            {language === "fr" ? "Capital Final Prévu" : "Projected Final Capital"}
          </div>
          <div className="text-xl font-bold font-mono">${fmt(stats.finalCapital)}</div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground mb-1">
            <Sparkles className="w-3 h-3" />
            {language === "fr" ? "Total RR" : "Total RR"}
          </div>
          <div className="text-xl font-bold font-mono">{fmt(stats.totalRR)}R</div>
        </Card>
      </div>

      {/* ─── Paliers ─── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            {language === "fr"
              ? `Les ${paliers.length} Paliers — ${config.riskPct}% de risque · RR 1:${config.rr} · ${config.winRatePct}% de réussite`
              : `${paliers.length} Tiers — ${config.riskPct}% risk · RR 1:${config.rr} · ${config.winRatePct}% win rate`}
          </h3>
          <span className="text-xs text-muted-foreground hidden sm:inline">
            {language === "fr" ? "Paliers modifiables — calcul automatique" : "Editable tiers — automatic calculation"}
          </span>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {paliers.map((p, i) => (
            <PallierCard
              key={i}
              index={i}
              data={p}
              trades={p.gagnants + p.perdants}
              validated={validated[i] || false}
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

      {/* ─── Mantra personnel ─── */}
      <Card className="p-6 md:p-8 relative overflow-hidden bg-gradient-to-br from-primary/8 via-card to-primary/8 border-primary/20">
        <div className="absolute top-3 left-4 text-6xl text-primary/15 font-serif leading-none select-none pointer-events-none">
          &ldquo;
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setMantraOpen(true)}
          className="absolute top-3 right-3 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <Quote className="w-3.5 h-3.5" />
          {language === "fr" ? "Personnaliser" : "Customize"}
        </Button>
        <div className="relative">
          <blockquote className="text-center text-foreground/90 font-medium leading-relaxed text-sm md:text-base italic max-w-3xl mx-auto">
            {currentMantra}
          </blockquote>
          <div className="text-center mt-3 text-xs text-muted-foreground uppercase tracking-widest">
            — {user?.name || (language === "fr" ? "Ta motivation" : "Your motivation")}
          </div>
        </div>
      </Card>

      {/* ─── Config Dialog ─── */}
      <Dialog open={configOpen} onOpenChange={setConfigOpen}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-primary" />
              {language === "fr" ? "Configurer mon plan" : "Configure my plan"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Définis ton capital, ton niveau de risque et ton objectif. Le plan se génère automatiquement."
                : "Set your capital, risk level and target. The plan generates automatically."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <NumberField
              label={language === "fr" ? "Capital initial ($)" : "Initial capital ($)"}
              value={config.initialCapital}
              min={1}
              step="any"
              onChange={(v) => setConfig((c) => ({ ...c, initialCapital: v }))}
            />
            <NumberField
              label={language === "fr" ? "Objectif (multiplicateur)" : "Target (multiple)"}
              value={config.targetMultiple}
              min={1.1}
              step="any"
              onChange={(v) => setConfig((c) => ({ ...c, targetMultiple: v }))}
              hint={language === "fr" ? "×10 = dix fois ton capital" : "×10 = ten times your capital"}
            />
            <NumberField
              label={language === "fr" ? "Risque / trade (%)" : "Risk / trade (%)"}
              value={config.riskPct}
              min={0.1}
              max={100}
              step="any"
              onChange={(v) => setConfig((c) => ({ ...c, riskPct: v }))}
            />
            <NumberField
              label="RR (1:x)"
              value={config.rr}
              min={0.1}
              step="any"
              onChange={(v) => setConfig((c) => ({ ...c, rr: v }))}
            />
            <NumberField
              label={language === "fr" ? "Réussite attendue (%)" : "Expected win rate (%)"}
              value={config.winRatePct}
              min={1}
              max={100}
              step="any"
              onChange={(v) => setConfig((c) => ({ ...c, winRatePct: v }))}
            />
            <NumberField
              label={language === "fr" ? "Trades par palier" : "Trades per tier"}
              value={config.tradesPerTier}
              min={1}
              step="1"
              onChange={(v) => setConfig((c) => ({ ...c, tradesPerTier: v }))}
            />
            <NumberField
              label={language === "fr" ? "Nombre de paliers" : "Number of tiers"}
              value={config.tierCount}
              min={1}
              max={30}
              step="1"
              onChange={(v) => setConfig((c) => ({ ...c, tierCount: v }))}
            />
            <NumberField
              label={language === "fr" ? "Horizon (mois)" : "Horizon (months)"}
              value={config.horizonMonths}
              min={1}
              step="1"
              onChange={(v) => setConfig((c) => ({ ...c, horizonMonths: v }))}
            />
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-muted-foreground">
                {language === "fr" ? "Date de début" : "Start date"}
              </Label>
              <Input
                type="date"
                value={config.startDate}
                onChange={(e) => setConfig((c) => ({ ...c, startDate: e.target.value }))}
                className="h-9"
              />
            </div>
          </div>

          <div className="rounded-lg bg-primary/5 border border-primary/15 p-3 text-xs space-y-1">
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === "fr" ? "Objectif de capital" : "Capital target"}</span>
              <span className="font-mono font-bold">${fmt(config.initialCapital * config.targetMultiple)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">{language === "fr" ? "Gains/palier attendus" : "Expected gains/tier"}</span>
              <span className="font-mono font-bold">
                {Math.round((config.tradesPerTier * config.winRatePct) / 100)} {language === "fr" ? "gagnants /" : "winners /"} {config.tradesPerTier} {language === "fr" ? "trades" : "trades"}
              </span>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setConfigOpen(false)}>
              {language === "fr" ? "Annuler" : "Cancel"}
            </Button>
            <Button onClick={handleGenerate} className="gap-1.5">
              <Calculator className="w-4 h-4" />
              {language === "fr" ? "Générer le plan" : "Generate plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Mantra Dialog ─── */}
      <Dialog open={mantraOpen} onOpenChange={setMantraOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Quote className="w-4 h-4 text-primary" />
              {language === "fr" ? "Ta motivation personnelle" : "Your personal mantra"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr"
                ? "Écris la phrase qui te motive à respecter ton plan. Elle s'affichera ici chaque jour."
                : "Write the sentence that motivates you to stick to your plan. It will show here every day."}
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={config.mantra}
            onChange={(e) => setConfig((c) => ({ ...c, mantra: e.target.value }))}
            placeholder={DEFAULT_MANTRA}
            rows={4}
            className="text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setMantraOpen(false)}>
              {language === "fr" ? "Fermer" : "Close"}
            </Button>
            <Button
              onClick={() => {
                setMantraOpen(false);
                toast.success(language === "fr" ? "Motivation enregistrée" : "Mantra saved");
              }}
            >
              {language === "fr" ? "Enregistrer" : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Number field helper ────────────────────────────────────
function NumberField({
  label,
  value,
  min,
  max,
  step,
  onChange,
  hint,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: string;
  onChange: (v: number) => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="h-9 font-mono"
      />
      {hint && <p className="text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ─── Pallier Card (Palette) ─────────────────────────────────
function PallierCard({
  index,
  data,
  trades,
  validated,
  language,
  onUpdate,
  onToggleValidate,
}: {
  index: number;
  data: PallierData;
  trades: number;
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
              {trades} {language === "fr" ? "trades" : "trades"} · {language === "fr" ? "Risque" : "Risk"} {fmt(calc.actualRiskPct)}%
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
