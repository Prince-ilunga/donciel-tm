"use client";

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Onglet Discipline (Pack 3 : Discipline & Risque)
// 1. Score DONCIEL (jauge radiale + 5 piliers)
// 2. Règles de risque (profil de risque)
// 3. Violations & conformité
// 4. Objectifs du mois
// ─────────────────────────────────────────────────────────────

import { ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { useTrades } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  computeDoncielScore,
  computeViolations,
  computeGoalProgress,
  GOAL_METRICS,
  DoncielScore,
  GoalMetric,
  GoalProgress,
  ScorePillars,
  ViolationsReport,
} from "@/lib/discipline";
import { monthKey, MONTH_LABELS_FR, TradeLike } from "@/lib/analytics";
import { ScoreGauge } from "@/components/discipline/score-ui";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertTriangle,
  BadgeCheck,
  CalendarRange,
  CalendarX2,
  Flame,
  Gauge,
  Info,
  Loader2,
  Plus,
  Repeat,
  Save,
  ShieldAlert,
  Target,
  Trash2,
  Trophy,
} from "lucide-react";

// ─── Types locaux ────────────────────────────────────────────

interface RiskProfileData {
  id: string;
  initialCapital: number;
  currency: string;
  riskPerTradePct: number;
  maxDailyLossPct: number;
  maxWeeklyLossPct: number;
  maxTradesPerDay: number | null;
}

interface GoalData {
  id: string;
  period: string;
  metric: string;
  target: number;
  status: string;
}

interface ProfileFormState {
  initialCapital: string;
  currency: string;
  riskPerTradePct: string;
  maxDailyLossPct: string;
  maxWeeklyLossPct: string;
  maxTradesPerDay: string; // "" = pas de limite
}

const DEFAULT_FORM: ProfileFormState = {
  initialCapital: "10000",
  currency: "USD",
  riskPerTradePct: "1",
  maxDailyLossPct: "3",
  maxWeeklyLossPct: "6",
  maxTradesPerDay: "",
};

const PILLARS: {
  key: keyof ScorePillars;
  max: number;
  labelFr: string;
  labelEn: string;
}[] = [
  { key: "discipline", max: 30, labelFr: "Discipline", labelEn: "Discipline" },
  { key: "consistency", max: 20, labelFr: "Consistance", labelEn: "Consistency" },
  { key: "risk", max: 20, labelFr: "Risque", labelEn: "Risk" },
  { key: "performance", max: 20, labelFr: "Performance", labelEn: "Performance" },
  { key: "journaling", max: 10, labelFr: "Journal", labelEn: "Journaling" },
];

function pillarColor(ratio: number): string {
  if (ratio >= 0.8) return "[&>div]:bg-emerald-500";
  if (ratio >= 0.5) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

function goalProgressColor(achieved: boolean): string {
  return achieved ? "[&>div]:bg-emerald-500" : "[&>div]:bg-sky-500";
}

interface ViolationRow {
  key: string;
  kindLabel: string;
  dateISO: string;
  detail: string;
  metric: string;
  limit: string;
}

// ─── Composant principal ─────────────────────────────────────

export function DisciplineTab() {
  const language = useAppStore((s) => s.language);
  const fr = language === "fr";

  const { trades, loading: tradesLoading } = useTrades();

  const [profile, setProfile] = useState<RiskProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [form, setForm] = useState<ProfileFormState>(DEFAULT_FORM);
  const [savingProfile, setSavingProfile] = useState(false);

  const [goals, setGoals] = useState<GoalData[]>([]);
  const [goalsLoading, setGoalsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newMetric, setNewMetric] = useState<GoalMetric>("RR_TOTAL");
  const [newTarget, setNewTarget] = useState("");
  const [addingGoal, setAddingGoal] = useState(false);
  const [deletingGoalId, setDeletingGoalId] = useState<string | null>(null);

  // Période = mois courant (YYYY-MM)
  const period = useMemo(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }, []);

  const hydrateForm = useCallback((p: RiskProfileData) => {
    setForm({
      initialCapital: String(p.initialCapital),
      currency: p.currency || "USD",
      riskPerTradePct: String(p.riskPerTradePct),
      maxDailyLossPct: String(p.maxDailyLossPct),
      maxWeeklyLossPct: String(p.maxWeeklyLossPct),
      maxTradesPerDay: p.maxTradesPerDay === null || p.maxTradesPerDay === undefined ? "" : String(p.maxTradesPerDay),
    });
  }, []);

  const fetchGoals = useCallback(
    async (p: string) => {
      try {
        const res = await fetch(`/api/goals?period=${p}`);
        if (res.ok) {
          const data = await res.json();
          setGoals(data.goals || []);
        }
      } catch {
        setGoals([]);
      } finally {
        setGoalsLoading(false);
      }
    },
    []
  );

  // Chargement initial : profil de risque + objectifs
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/risk-profile");
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) {
            const p: RiskProfileData | null = data.profile ?? null;
            setProfile(p);
            if (p) hydrateForm(p);
          }
        }
      } catch {
        // profil indisponible → formulaire par défaut
      } finally {
        if (!cancelled) setProfileLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrateForm]);

  // Chargement initial des objectifs (setState uniquement après await)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/goals?period=${period}`);
        if (res.ok) {
          const data = await res.json();
          if (!cancelled) setGoals(data.goals || []);
        }
      } catch {
        if (!cancelled) setGoals([]);
      } finally {
        if (!cancelled) setGoalsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [period]);

  // ─── Dérivés ───
  const score: DoncielScore = useMemo(() => computeDoncielScore(trades as TradeLike[]), [trades]);

  const violations: ViolationsReport | null = useMemo(
    () => (profile ? computeViolations(trades as TradeLike[], profile) : null),
    [trades, profile]
  );

  const monthTrades = useMemo(
    () => trades.filter((t) => monthKey(t as TradeLike) === period),
    [trades, period]
  );

  const goalProgress: GoalProgress[] = useMemo(
    () => computeGoalProgress(goals, monthTrades as TradeLike[], period, score),
    [goals, monthTrades, period, score]
  );

  const periodLabel = useMemo(() => {
    const monthIdx = parseInt(period.slice(5), 10) - 1;
    const monthFr = MONTH_LABELS_FR[monthIdx] || period;
    const monthEn = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December",
    ][monthIdx] || period;
    return fr ? `${monthFr} ${period.slice(0, 4)}` : `${monthEn} ${period.slice(0, 4)}`;
  }, [period, fr]);

  const fmtMoney = useCallback(
    (v: number) =>
      new Intl.NumberFormat(fr ? "fr-FR" : "en-US", {
        style: "currency",
        currency: profile?.currency || form.currency || "USD",
        maximumFractionDigits: 2,
      }).format(v),
    [fr, profile?.currency, form.currency]
  );

  const fmtDate = useCallback(
    (iso: string) =>
      new Date(`${iso}T00:00:00`).toLocaleDateString(fr ? "fr-FR" : "en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
    [fr]
  );

  // ─── Handlers ───

  const validateForm = useCallback(
    (): { ok: true; payload: Record<string, number | string | null> } | { ok: false; error: string } => {
    const initialCapital = parseFloat(form.initialCapital);
    const riskPerTradePct = parseFloat(form.riskPerTradePct);
    const maxDailyLossPct = parseFloat(form.maxDailyLossPct);
    const maxWeeklyLossPct = parseFloat(form.maxWeeklyLossPct);
    const maxTradesPerDay =
      form.maxTradesPerDay.trim() === "" ? null : parseInt(form.maxTradesPerDay, 10);

    if (isNaN(initialCapital) || initialCapital <= 0) {
      return { ok: false, error: fr ? "Le capital initial doit être supérieur à 0." : "Initial capital must be greater than 0." };
    }
    if (isNaN(riskPerTradePct) || riskPerTradePct < 0.1 || riskPerTradePct > 10) {
      return { ok: false, error: fr ? "Le risque par trade doit être entre 0.1 et 10 %." : "Risk per trade must be between 0.1 and 10%." };
    }
    if (isNaN(maxDailyLossPct) || maxDailyLossPct < 0.5 || maxDailyLossPct > 50) {
      return { ok: false, error: fr ? "La perte quotidienne max doit être entre 0.5 et 50 %." : "Max daily loss must be between 0.5 and 50%." };
    }
    if (isNaN(maxWeeklyLossPct) || maxWeeklyLossPct < 0.5 || maxWeeklyLossPct > 50) {
      return { ok: false, error: fr ? "La perte hebdomadaire max doit être entre 0.5 et 50 %." : "Max weekly loss must be between 0.5 and 50%." };
    }
    if (maxTradesPerDay !== null && (isNaN(maxTradesPerDay) || maxTradesPerDay < 1 || maxTradesPerDay > 100)) {
      return { ok: false, error: fr ? "Le nombre max de trades/jour doit être entre 1 et 100." : "Max trades per day must be between 1 and 100." };
    }
    return {
      ok: true,
      payload: {
        initialCapital,
        currency: form.currency,
        riskPerTradePct,
        maxDailyLossPct,
        maxWeeklyLossPct,
        maxTradesPerDay,
      },
    };
  }, [form, fr]);

  const handleSaveProfile = useCallback(async () => {
    const check = validateForm();
    if (!check.ok) {
      toast.error(check.error);
      return;
    }
    setSavingProfile(true);
    try {
      const res = await fetch("/api/risk-profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(check.payload),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.profile) {
        setProfile(data.profile as RiskProfileData);
        hydrateForm(data.profile as RiskProfileData);
        toast.success(
          fr ? "Profil de risque enregistré ✅" : "Risk profile saved ✅"
        );
      } else {
        toast.error(data.error || (fr ? "Erreur lors de l'enregistrement." : "Failed to save."));
      }
    } catch {
      toast.error(fr ? "Erreur réseau. Réessaie." : "Network error. Try again.");
    } finally {
      setSavingProfile(false);
    }
  }, [validateForm, hydrateForm, fr]);

  const handleAddGoal = useCallback(async () => {
    const target = parseFloat(newTarget);
    if (isNaN(target) || target <= 0) {
      toast.error(fr ? "La cible doit être un nombre supérieur à 0." : "Target must be a number greater than 0.");
      return;
    }
    setAddingGoal(true);
    try {
      const res = await fetch("/api/goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period, metric: newMetric, target }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        toast.success(
          data.created
            ? fr ? "Objectif créé ✅" : "Goal created ✅"
            : fr ? "Objectif mis à jour ✅" : "Goal updated ✅"
        );
        setDialogOpen(false);
        setNewTarget("");
        await fetchGoals(period);
      } else {
        toast.error(data.error || (fr ? "Erreur lors de la création." : "Failed to create goal."));
      }
    } catch {
      toast.error(fr ? "Erreur réseau. Réessaie." : "Network error. Try again.");
    } finally {
      setAddingGoal(false);
    }
  }, [newTarget, period, newMetric, fetchGoals, fr]);

  const handleDeleteGoal = useCallback(
    async (goalId: string) => {
      setDeletingGoalId(goalId);
      try {
        const res = await fetch(`/api/goals?id=${goalId}`, { method: "DELETE" });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          toast.success(fr ? "Objectif supprimé." : "Goal deleted.");
          await fetchGoals(period);
        } else {
          toast.error(data.error || (fr ? "Erreur lors de la suppression." : "Failed to delete goal."));
        }
      } catch {
        toast.error(fr ? "Erreur réseau. Réessaie." : "Network error. Try again.");
      } finally {
        setDeletingGoalId(null);
      }
    },
    [fetchGoals, period, fr]
  );

  // ─── Liste unifiée des violations récentes ───
  const violationRows: ViolationRow[] = useMemo(() => {
    if (!violations) return [];
    const rows: ViolationRow[] = [];

    for (const v of violations.dailyLossViolations) {
      rows.push({
        key: `daily-${v.dateISO}`,
        kindLabel: fr ? "Perte quotidienne" : "Daily loss",
        dateISO: v.dateISO,
        detail: `${fmtMoney(v.dayPnl)} · ${v.tradesCount} ${fr ? "trades" : "trades"}`,
        metric: `${v.lossPct} %`,
        limit: `${v.limitPct} %`,
      });
    }
    for (const v of violations.weeklyLossViolations) {
      rows.push({
        key: `weekly-${v.dateISO}`,
        kindLabel: fr ? "Perte hebdomadaire" : "Weekly loss",
        dateISO: v.dateISO,
        detail: `${fmtMoney(v.dayPnl)} · ${fr ? "semaine du" : "week of"} ${fmtDate(v.dateISO)}`,
        metric: `${v.lossPct} %`,
        limit: `${v.limitPct} %`,
      });
    }
    for (const v of violations.overRiskTrades) {
      rows.push({
        key: `overrisk-${v.tradeId}`,
        kindLabel: `${fr ? "Sur-risque" : "Over-risk"} · ${v.pair}`,
        dateISO: v.date,
        detail: fmtMoney(v.riskAmount),
        metric: `${v.riskPct} %`,
        limit: `${v.limitPct} %`,
      });
    }
    for (const v of violations.overtradingDays) {
      rows.push({
        key: `overtrade-${v.dateISO}`,
        kindLabel: fr ? "Sur-trading" : "Overtrading",
        dateISO: v.dateISO,
        detail: fr ? `${v.count} trades dans la journée` : `${v.count} trades in one day`,
        metric: `${v.count}`,
        limit: `${v.limit}`,
      });
    }

    rows.sort((a, b) => b.dateISO.localeCompare(a.dateISO));
    return rows;
  }, [violations, fmtMoney, fmtDate, fr]);

  // ─── États de chargement ───
  const globalLoading = tradesLoading && profileLoading && goalsLoading;

  if (globalLoading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
        <Card className="p-6">
          <Skeleton className="h-48 w-full" />
        </Card>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
          <Card className="p-6"><Skeleton className="h-64 w-full" /></Card>
        </div>
        <Card className="p-6"><Skeleton className="h-40 w-full" /></Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* ═══ Section 1 : Score DONCIEL ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Gauge className="w-5 h-5 text-sky-500" />
            {fr ? "Score DONCIEL" : "DONCIEL Score"}
            <Badge variant="outline" className="ml-1 font-normal text-muted-foreground">
              {fr ? `${score.tradesAnalyzed} trades analysés` : `${score.tradesAnalyzed} trades analyzed`}
            </Badge>
          </CardTitle>
          <CardDescription className="flex items-start gap-1.5">
            <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {fr
              ? "Le Score DONCIEL mesure ta discipline, pas seulement tes gains. Un trader rentable mais hors-plan n'est pas discipliné."
              : "The DONCIEL Score measures your discipline, not just your gains. A profitable but off-plan trader is not disciplined."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-6 md:gap-10 items-center">
            <div className="flex justify-center">
              <ScoreGauge
                score={score}
                ariaLabel={
                  fr
                    ? `Score DONCIEL : ${score.total} sur 100, grade ${score.grade}`
                    : `DONCIEL Score: ${score.total} out of 100, grade ${score.grade}`
                }
              />
            </div>
            <div className="space-y-4 min-w-0">
              {PILLARS.map((p) => {
                const value = score.pillars[p.key];
                const ratio = value / p.max;
                return (
                  <div key={p.key} className="space-y-1.5">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">
                        {fr ? p.labelFr : p.labelEn}
                        <span className="text-muted-foreground font-normal ml-1.5">/ {p.max}</span>
                      </span>
                      <span className="font-semibold tabular-nums">{value}</span>
                    </div>
                    <Progress
                      value={ratio * 100}
                      className={cn("h-2", pillarColor(ratio))}
                      aria-label={`${fr ? p.labelFr : p.labelEn} : ${value} / ${p.max}`}
                    />
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Section 2 : Règles de risque ═══ */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-500" />
            {fr ? "Règles de risque" : "Risk rules"}
          </CardTitle>
          <CardDescription>
            {fr
              ? "Définis ton capital et tes limites. DONCIEL TM surveille chaque trade pour toi."
              : "Define your capital and limits. DONCIEL TM monitors every trade for you."}
          </CardDescription>
          {!profile && !profileLoading && (
            <div className="mt-2 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-600 dark:text-amber-400">
              <Info className="w-4 h-4 mt-0.5 shrink-0" />
              <span>
                {fr
                  ? "Configure ton profil de risque pour activer la détection de violations."
                  : "Set up your risk profile to enable violation detection."}
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="initialCapital">
                {fr ? "Capital initial" : "Initial capital"}
              </Label>
              <Input
                id="initialCapital"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={form.initialCapital}
                onChange={(e) => setForm((f) => ({ ...f, initialCapital: e.target.value }))}
                placeholder="10000"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currency">{fr ? "Devise" : "Currency"}</Label>
              <Select
                value={form.currency}
                onValueChange={(v) => setForm((f) => ({ ...f, currency: v }))}
              >
                <SelectTrigger id="currency" className="h-11 w-full">
                  <SelectValue placeholder={fr ? "Devise" : "Currency"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="USD">USD ($)</SelectItem>
                  <SelectItem value="EUR">EUR (€)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="riskPerTradePct">
                {fr ? "Risque par trade (%)" : "Risk per trade (%)"}
              </Label>
              <Input
                id="riskPerTradePct"
                type="number"
                inputMode="decimal"
                min="0.1"
                max="10"
                step="0.1"
                value={form.riskPerTradePct}
                onChange={(e) => setForm((f) => ({ ...f, riskPerTradePct: e.target.value }))}
                placeholder="1"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxDailyLossPct">
                {fr ? "Limite perte quotidienne (%)" : "Max daily loss (%)"}
              </Label>
              <Input
                id="maxDailyLossPct"
                type="number"
                inputMode="decimal"
                min="0.5"
                max="50"
                step="0.5"
                value={form.maxDailyLossPct}
                onChange={(e) => setForm((f) => ({ ...f, maxDailyLossPct: e.target.value }))}
                placeholder="3"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxWeeklyLossPct">
                {fr ? "Limite perte hebdo (%)" : "Max weekly loss (%)"}
              </Label>
              <Input
                id="maxWeeklyLossPct"
                type="number"
                inputMode="decimal"
                min="0.5"
                max="50"
                step="0.5"
                value={form.maxWeeklyLossPct}
                onChange={(e) => setForm((f) => ({ ...f, maxWeeklyLossPct: e.target.value }))}
                placeholder="6"
                className="h-11"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxTradesPerDay">
                {fr ? "Max trades / jour" : "Max trades / day"}
                <span className="text-muted-foreground font-normal"> ({fr ? "optionnel" : "optional"})</span>
              </Label>
              <Input
                id="maxTradesPerDay"
                type="number"
                inputMode="numeric"
                min="1"
                max="100"
                step="1"
                value={form.maxTradesPerDay}
                onChange={(e) => setForm((f) => ({ ...f, maxTradesPerDay: e.target.value }))}
                placeholder={fr ? "Aucune limite" : "No limit"}
                className="h-11"
              />
            </div>
          </div>

          <div className="mt-5">
            <Button
              onClick={handleSaveProfile}
              disabled={savingProfile}
              className="min-h-11 min-w-11 bg-sky-600 hover:bg-sky-700 text-white"
            >
              {savingProfile ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              {fr ? "Enregistrer" : "Save"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ Section 3 : Violations & conformité ═══ */}
      {profile && violations && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-red-500" />
              {fr ? "Violations & conformité" : "Violations & compliance"}
              <Badge
                variant="outline"
                className={cn(
                  "ml-1",
                  violations.totalViolations === 0
                    ? "border-emerald-500/30 text-emerald-500"
                    : "border-red-500/30 text-red-500"
                )}
              >
                {fr
                  ? `${violations.totalViolations} violation${violations.totalViolations > 1 ? "s" : ""}`
                  : `${violations.totalViolations} violation${violations.totalViolations > 1 ? "s" : ""}`}
              </Badge>
            </CardTitle>
            <CardDescription>
              {fr
                ? "Détection automatique selon tes règles : pertes jour/semaine, sur-risque, sur-trading."
                : "Automatic detection based on your rules: daily/weekly losses, over-risk, overtrading."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Série propre + 4 compteurs */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              <Card
                className={cn(
                  "p-4 col-span-2 lg:col-span-1 border",
                  violations.cleanStreakDays > 0
                    ? "border-emerald-500/30 bg-emerald-500/5"
                    : "border-border"
                )}
              >
                <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
                  <Flame className="w-4 h-4 text-emerald-500" />
                  {fr ? "Série propre" : "Clean streak"}
                </div>
                <div className="mt-2 text-2xl font-bold text-emerald-500 tabular-nums">
                  🔥 {violations.cleanStreakDays}{" "}
                  <span className="text-sm font-medium text-muted-foreground">
                    {fr ? (violations.cleanStreakDays > 1 ? "jours" : "jour") : violations.cleanStreakDays > 1 ? "days" : "day"}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {fr ? "sans violation" : "without violation"}
                </p>
              </Card>

              <ViolationCounter
                label={fr ? "Pertes jour" : "Daily losses"}
                count={violations.dailyLossViolations.length}
                icon={<CalendarX2 className="w-4 h-4" />}
              />
              <ViolationCounter
                label={fr ? "Pertes semaine" : "Weekly losses"}
                count={violations.weeklyLossViolations.length}
                icon={<CalendarRange className="w-4 h-4" />}
              />
              <ViolationCounter
                label={fr ? "Trades sur-risqués" : "Over-risk trades"}
                count={violations.overRiskTrades.length}
                icon={<AlertTriangle className="w-4 h-4" />}
              />
              <ViolationCounter
                label={fr ? "Sur-trading" : "Overtrading"}
                count={violations.overtradingDays.length}
                icon={<Repeat className="w-4 h-4" />}
              />
            </div>

            {/* Détail ou carte parfaite */}
            {violations.totalViolations === 0 ? (
              <div className="flex items-center gap-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-4 text-emerald-600 dark:text-emerald-400">
                <BadgeCheck className="w-6 h-6 shrink-0" />
                <span className="font-semibold">
                  {fr
                    ? "✅ Aucune violation, discipline parfaite !"
                    : "✅ No violations, perfect discipline!"}
                </span>
              </div>
            ) : (
              <div>
                <h4 className="text-sm font-semibold mb-2">
                  {fr ? "Violations récentes" : "Recent violations"}
                </h4>
                <ScrollArea className="max-h-96">
                  <div className="space-y-2 pr-3">
                    {violationRows.map((row) => (
                      <div
                        key={row.key}
                        className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5"
                      >
                        <Badge variant="destructive" className="shrink-0 text-[10px] w-fit">
                          {fr ? "Violation" : "Violation"}
                        </Badge>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{row.kindLabel}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmtDate(row.dateISO)} · {row.detail}
                          </p>
                        </div>
                        <div className="text-sm font-semibold text-red-500 tabular-nums shrink-0">
                          {row.metric}
                          <span className="text-xs font-normal text-muted-foreground ml-1.5">
                            {fr ? "/ limite" : "/ limit"} {row.limit}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* ═══ Section 4 : Objectifs du mois ═══ */}
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-sky-500" />
                {fr ? "Objectifs du mois" : "Monthly goals"}
              </CardTitle>
              <CardDescription>{periodLabel}</CardDescription>
            </div>
            <Button
              onClick={() => setDialogOpen(true)}
              className="min-h-11 bg-sky-600 hover:bg-sky-700 text-white w-full sm:w-auto"
            >
              <Plus className="w-4 h-4" />
              {fr ? "Nouvel objectif" : "New goal"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {goalsLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : goalProgress.length === 0 ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-muted-foreground/30 px-4 py-10 text-center">
              <Trophy className="w-8 h-8 text-muted-foreground/50" />
              <div>
                <p className="font-medium">
                  {fr ? "Aucun objectif pour ce mois" : "No goals for this month"}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {fr
                    ? "Fixe-toi un objectif (RR cumulé, win rate, discipline…) pour rester concentré."
                    : "Set a goal (total R, win rate, discipline…) to stay focused."}
                </p>
              </div>
              <Button
                onClick={() => setDialogOpen(true)}
                variant="outline"
                className="min-h-11 border-sky-500/40 text-sky-500 hover:bg-sky-500/10"
              >
                <Plus className="w-4 h-4" />
                {fr ? "Créer mon premier objectif" : "Create my first goal"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {goalProgress.map((g) => {
                const meta = GOAL_METRICS.find((m) => m.value === g.metric);
                const unit = meta?.unit ?? "";
                const label = fr ? meta?.labelFr ?? g.metric : meta?.labelEn ?? g.metric;
                return (
                  <div key={`${g.metric}-${g.target}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">
                          {label}
                          <span className="text-muted-foreground font-normal ml-1.5">
                            {fr ? "cible" : "target"} : {g.target}
                            {unit ? ` ${unit}` : ""}
                          </span>
                        </p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {fr ? "actuel" : "current"} : {g.current}
                          {unit ? ` ${unit}` : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {g.achieved && (
                          <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 hover:bg-emerald-500/15">
                            {fr ? "Atteint ✅" : "Achieved ✅"}
                          </Badge>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteGoal(goals.find((go) => go.metric === g.metric)?.id || "")}
                          disabled={deletingGoalId !== null}
                          className="h-11 w-11 text-muted-foreground hover:text-red-500 hover:bg-red-500/10"
                          aria-label={fr ? `Supprimer l'objectif ${label}` : `Delete goal ${label}`}
                        >
                          {deletingGoalId === goals.find((go) => go.metric === g.metric)?.id ? (
                            <Loader2 className="w-4 h-4 animate-spin" />
                          ) : (
                            <Trash2 className="w-4 h-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                    <Progress
                      value={Math.min(100, Math.max(0, g.progressPct))}
                      className={cn("h-2.5", goalProgressColor(g.achieved))}
                      aria-label={`${label} : ${g.current} / ${g.target}`}
                    />
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ═══ Dialog : nouvel objectif ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{fr ? "Nouvel objectif" : "New goal"}</DialogTitle>
            <DialogDescription>
              {fr
                ? `Objectif pour ${periodLabel}. Un seul objectif par métrique et par mois.`
                : `Goal for ${periodLabel}. One goal per metric per month.`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="goalMetric">{fr ? "Métrique" : "Metric"}</Label>
              <Select
                value={newMetric}
                onValueChange={(v) => setNewMetric(v as GoalMetric)}
              >
                <SelectTrigger id="goalMetric" className="h-11 w-full">
                  <SelectValue placeholder={fr ? "Choisis une métrique" : "Choose a metric"} />
                </SelectTrigger>
                <SelectContent>
                  {GOAL_METRICS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {fr ? m.labelFr : m.labelEn}
                      {m.unit ? ` (${m.unit})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="goalTarget">{fr ? "Cible" : "Target"}</Label>
              <Input
                id="goalTarget"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={newTarget}
                onChange={(e) => setNewTarget(e.target.value)}
                placeholder={GOAL_METRICS.find((m) => m.value === newMetric)?.unit === "%"
                  ? "ex : 55"
                  : GOAL_METRICS.find((m) => m.value === newMetric)?.unit === "R"
                    ? "ex : 10"
                    : GOAL_METRICS.find((m) => m.value === newMetric)?.unit === "/100"
                      ? "ex : 80"
                      : GOAL_METRICS.find((m) => m.value === newMetric)?.unit === "$"
                        ? "ex : 2000"
                        : "ex : 40"}
                className="h-11"
              />
              <p className="text-xs text-muted-foreground">
                {fr ? "Doit être supérieur à 0." : "Must be greater than 0."}
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              className="min-h-11"
            >
              {fr ? "Annuler" : "Cancel"}
            </Button>
            <Button
              onClick={handleAddGoal}
              disabled={addingGoal}
              className="min-h-11 bg-sky-600 hover:bg-sky-700 text-white"
            >
              {addingGoal && <Loader2 className="w-4 h-4 animate-spin" />}
              {fr ? "Créer l'objectif" : "Create goal"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────

function ViolationCounter({
  label,
  count,
  icon,
}: {
  label: string;
  count: number;
  icon: ReactNode;
}) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium uppercase tracking-wider">
        <span className={count > 0 ? "text-red-500" : ""}>{icon}</span>
        <span className="truncate">{label}</span>
      </div>
      <div
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          count > 0 ? "text-red-500" : "text-foreground"
        )}
      >
        {count}
      </div>
    </Card>
  );
}
