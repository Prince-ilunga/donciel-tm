"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
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
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import {
  BookOpen,
  Plus,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle,
  Target,
  TrendingUp,
  TrendingDown,
  Shield,
  AlertTriangle,
  Save,
  Loader2,
  ArrowLeft,
  Search,
  ChevronRight,
  Circle,
  Minus,
  BarChart3,
  FileText,
  Tag,
  ClipboardList,
  ImagePlus,
  X,
  Camera,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
  Zap,
  Activity,
  Clock,
  Layers,
  Gauge,
  Star,
  Flame,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

// ─── Types ──────────────────────────────────────────────
interface Screenshot {
  id: string;
  url: string;
  type: string;
  caption: string | null;
}

interface Playbook {
  id: string;
  userId: string;
  name: string;
  description: string | null;
  category: string | null;
  direction: string | null;
  marketCondition: string | null;
  session: string | null;
  timeframe: string | null;
  entryRules: string[] | null;
  exitRules: string[] | null;
  stopLossRules: string | null;
  takeProfitRules: string | null;
  riskPerTrade: number | null;
  targetRR: number | null;
  trailingStopRules: string | null;
  checklist: { text: string; checked: boolean }[] | null;
  tags: string[] | null;
  notes: string | null;
  status: string;
  color: string | null;
  createdAt: string;
  updatedAt: string;
  screenshots: Screenshot[];
  _count?: { trades: number };
}

interface PlaybookPerformance {
  totalTrades: number;
  winCount: number;
  lossCount: number;
  beCount: number;
  winRate: number;
  avgRR: number;
  totalPnl: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  bestRR: number;
  worstRR: number;
}

// ─── Constants ──────────────────────────────────────────
const CATEGORIES = [
  { id: "BREAKOUT", label_fr: "Breakout", label_en: "Breakout", icon: Zap },
  { id: "RETRACE", label_fr: "Retrace", label_en: "Retrace", icon: TrendingDown },
  { id: "TREND_FOLLOW", label_fr: "Suivi de Tendance", label_en: "Trend Follow", icon: TrendingUp },
  { id: "REVERSAL", label_fr: "Renversement", label_en: "Reversal", icon: ArrowDownRight },
  { id: "RANGE", label_fr: "Range", label_en: "Range", icon: Minus },
  { id: "CUSTOM", label_fr: "Personnalisé", label_en: "Custom", icon: Star },
];

const DIRECTIONS = [
  { id: "LONG", label_fr: "LONG", label_en: "LONG", icon: ArrowUpRight, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  { id: "SHORT", label_fr: "SHORT", label_en: "SHORT", icon: ArrowDownRight, color: "text-red-500 bg-red-500/10 border-red-500/30" },
  { id: "BOTH", label_fr: "LES DEUX", label_en: "BOTH", icon: Activity, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
];

const STATUSES = [
  { id: "ACTIVE", label_fr: "Actif", label_en: "Active", color: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  { id: "PAUSED", label_fr: "En Pause", label_en: "Paused", color: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  { id: "ARCHIVED", label_fr: "Archivé", label_en: "Archived", color: "bg-gray-500/10 text-gray-500 dark:text-gray-400 border-gray-500/30" },
];

const COLORS = [
  { value: "#10b981", name_fr: "Émeraude", name_en: "Emerald" },
  { value: "#3b82f6", name_fr: "Bleu", name_en: "Blue" },
  { value: "#f59e0b", name_fr: "Ambre", name_en: "Amber" },
  { value: "#ef4444", name_fr: "Rouge", name_en: "Red" },
  { value: "#8b5cf6", name_fr: "Violet", name_en: "Violet" },
  { value: "#ec4899", name_fr: "Rose", name_en: "Pink" },
  { value: "#06b6d4", name_fr: "Cyan", name_en: "Cyan" },
  { value: "#f97316", name_fr: "Orange", name_en: "Orange" },
];

const SCREENSHOT_TYPES = [
  { id: "example_win", label_fr: "Exemple Gain", label_en: "Win Example" },
  { id: "example_loss", label_fr: "Exemple Perte", label_en: "Loss Example" },
  { id: "reference", label_fr: "Référence", label_en: "Reference" },
];

const MARKET_CONDITIONS = [
  { id: "TRENDING", label_fr: "Tendance", label_en: "Trending" },
  { id: "RANGING", label_fr: "Range", label_en: "Ranging" },
  { id: "VOLATILE", label_fr: "Volatile", label_en: "Volatile" },
  { id: "QUIET", label_fr: "Calme", label_en: "Quiet" },
  { id: "NEWS_DRIVEN", label_fr: "News", label_en: "News Driven" },
];

const SESSIONS = [
  { id: "LONDON", label_fr: "LONDON", label_en: "LONDON" },
  { id: "NEW_YORK", label_fr: "NEW YORK", label_en: "NEW YORK" },
  { id: "ASIA", label_fr: "ASIE", label_en: "ASIA" },
  { id: "OVERLAP", label_fr: "OVERLAP", label_en: "OVERLAP" },
];

const TIMEFRAMES = [
  "M1", "M5", "M15", "M30", "H1", "H4", "D1", "W1",
];

// ─── Helpers ────────────────────────────────────────────
function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function getCategoryObj(id: string | null) {
  return CATEGORIES.find(c => c.id === id) || CATEGORIES[CATEGORIES.length - 1];
}

function getDirectionObj(id: string | null) {
  return DIRECTIONS.find(d => d.id === id) || DIRECTIONS[DIRECTIONS.length - 1];
}

function getStatusObj(id: string) {
  return STATUSES.find(s => s.id === id) || STATUSES[0];
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
}

// ─── Playbook Hooks ─────────────────────────────────────
function usePlaybooks() {
  const [playbooks, setPlaybooks] = useState<Playbook[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPlaybooks = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/playbooks");
      if (res.ok) {
        const data = await res.json();
        setPlaybooks(data.playbooks || []);
      }
    } catch {
      setPlaybooks([]);
    }
    setLoading(false);
  }, []);

  return { playbooks, loading, refetch: fetchPlaybooks };
}

function usePlaybookPerformance(playbookId: string | null) {
  const [performance, setPerformance] = useState<PlaybookPerformance | null>(null);
  const [loading, setLoading] = useState(false);

  const fetchPerformance = useCallback(async () => {
    if (!playbookId) { return; }
    setLoading(true);
    try {
      const res = await fetch(`/api/playbooks/${playbookId}/performance`);
      if (res.ok) {
        const data = await res.json();
        setPerformance(data.performance || data);
      }
    } catch {
      setPerformance(null);
    }
    setLoading(false);
  }, [playbookId]);

  return { performance, loading, refetch: fetchPerformance, fetchPerformance };
}

// ─── Playbook Card ──────────────────────────────────────
function PlaybookCard({
  playbook,
  isSelected,
  language,
  onClick,
}: {
  playbook: Playbook;
  isSelected: boolean;
  language: "fr" | "en";
  onClick: () => void;
}) {
  const cat = getCategoryObj(playbook.category);
  const dir = getDirectionObj(playbook.direction);
  const status = getStatusObj(playbook.status);
  const tradeCount = playbook._count?.trades || 0;
  const tags = playbook.tags || [];

  return (
    <Card
      className={cn(
        "p-4 cursor-pointer transition-all duration-200 hover:shadow-md border",
        isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm ring-1 ring-primary/20"
          : "border-border hover:border-primary/30"
      )}
      onClick={onClick}
    >
      <div className="flex items-start gap-3">
        {/* Color dot */}
        <div
          className="w-3 h-3 rounded-full mt-1.5 shrink-0 ring-2 ring-offset-1 ring-offset-background"
          style={{ backgroundColor: playbook.color || "#10b981", ringColor: playbook.color || "#10b981" }}
        />
        <div className="flex-1 min-w-0">
          {/* Name and status */}
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-sm truncate">{playbook.name}</h3>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 shrink-0", status.color)}>
              {language === "fr" ? status.label_fr : status.label_en}
            </Badge>
          </div>

          {/* Category and Direction */}
          <div className="flex items-center gap-1.5 mb-2 flex-wrap">
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0 gap-1">
              {React.createElement(cat.icon, { className: "w-2.5 h-2.5" })}
              {language === "fr" ? cat.label_fr : cat.label_en}
            </Badge>
            <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0", dir.color)}>
              {language === "fr" ? dir.label_fr : dir.label_en}
            </Badge>
          </div>

          {/* Quick stats */}
          <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1">
              <BarChart3 className="w-3 h-3" />
              {tradeCount} {language === "fr" ? "trades" : "trades"}
            </span>
          </div>

          {/* Tags preview */}
          {tags.length > 0 && (
            <div className="flex items-center gap-1 mt-1.5 flex-wrap">
              {tags.slice(0, 3).map((tag) => (
                <span key={tag} className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  {tag}
                </span>
              ))}
              {tags.length > 3 && (
                <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>
              )}
            </div>
          )}
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
      </div>
    </Card>
  );
}

// ─── Playbook Detail View ───────────────────────────────
function PlaybookDetail({
  playbook,
  language,
  onEdit,
  onDelete,
  onBack,
}: {
  playbook: Playbook;
  language: "fr" | "en";
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}) {
  const { performance, loading: perfLoading, refetch: refetchPerf, fetchPerformance } = usePlaybookPerformance(playbook.id);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const entryRules = playbook.entryRules || [];
  const exitRules = playbook.exitRules || [];
  const tags = playbook.tags || [];
  const [checklistItems, setChecklistItems] = useState<{ text: string; checked: boolean }[]>(playbook.checklist || []);
  const cat = getCategoryObj(playbook.category);
  const dir = getDirectionObj(playbook.direction);
  const status = getStatusObj(playbook.status);

  // Fetch performance on mount
  useEffect(() => { fetchPerformance(); }, [fetchPerformance]);

  const checkedCount = checklistItems.filter(c => c.checked).length;
  const checklistProgress = checklistItems.length > 0 ? (checkedCount / checklistItems.length) * 100 : 0;

  const handleToggleChecklist = async (index: number) => {
    const updated = [...checklistItems];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    setChecklistItems(updated);
    setSavingChecklist(true);
    try {
      await fetch(`/api/playbooks/${playbook.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: JSON.stringify(updated) }),
      });
    } catch {
      toast.error(language === "fr" ? "Erreur de sauvegarde" : "Save error");
    }
    setSavingChecklist(false);
  };

  return (
    <div className="space-y-4">
      {/* Back button (mobile) */}
      <Button variant="ghost" size="sm" onClick={onBack} className="gap-1.5 md:hidden">
        <ArrowLeft className="w-4 h-4" />
        {language === "fr" ? "Retour" : "Back"}
      </Button>

      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div
            className="w-4 h-4 rounded-full mt-1 shrink-0"
            style={{ backgroundColor: playbook.color || "#10b981" }}
          />
          <div className="min-w-0">
            <h2 className="text-xl font-bold tracking-tight truncate">{playbook.name}</h2>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="secondary" className="text-[11px] gap-1">
                {React.createElement(cat.icon, { className: "w-3 h-3" })}
                {language === "fr" ? cat.label_fr : cat.label_en}
              </Badge>
              <Badge variant="outline" className={cn("text-[11px]", dir.color)}>
                {language === "fr" ? dir.label_fr : dir.label_en}
              </Badge>
              <Badge variant="outline" className={cn("text-[11px]", status.color)}>
                {language === "fr" ? status.label_fr : status.label_en}
              </Badge>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <Button variant="outline" size="sm" onClick={onEdit} className="gap-1.5">
            <Edit3 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{language === "fr" ? "Modifier" : "Edit"}</span>
          </Button>
          <Button variant="outline" size="sm" onClick={onDelete} className="gap-1.5 text-destructive hover:text-destructive">
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Performance Stats */}
      <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">
            {language === "fr" ? "Performance" : "Performance"}
          </span>
          {perfLoading && <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />}
        </div>
        {performance ? (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className={cn("text-lg font-bold", performance.winRate >= 50 ? "text-emerald-500" : "text-red-500")}>
                {performance.winRate.toFixed(1)}%
              </div>
              <div className="text-[10px] text-muted-foreground">{language === "fr" ? "Win Rate" : "Win Rate"}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className="text-lg font-bold text-primary">{performance.totalTrades}</div>
              <div className="text-[10px] text-muted-foreground">{language === "fr" ? "Trades" : "Trades"}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className={cn("text-lg font-bold", performance.totalPnl >= 0 ? "text-emerald-500" : "text-red-500")}>
                {formatCurrency(performance.totalPnl)}
              </div>
              <div className="text-[10px] text-muted-foreground">P&L</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className={cn("text-lg font-bold", performance.avgRR >= 0 ? "text-emerald-500" : "text-red-500")}>
                {performance.avgRR.toFixed(2)}R
              </div>
              <div className="text-[10px] text-muted-foreground">{language === "fr" ? "RR Moyen" : "Avg RR"}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className="text-lg font-bold text-amber-500">{performance.profitFactor === Infinity ? '∞' : performance.profitFactor.toFixed(2)}</div>
              <div className="text-[10px] text-muted-foreground">{language === "fr" ? "Facteur de Profit" : "Profit Factor"}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className="text-lg font-bold text-emerald-500">{formatCurrency(performance.avgWin)}</div>
              <div className="text-[10px] text-muted-foreground">{language === "fr" ? "Gain Moyen" : "Avg Win"}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className="text-lg font-bold text-red-500">{formatCurrency(performance.avgLoss)}</div>
              <div className="text-[10px] text-muted-foreground">{language === "fr" ? "Perte Moyenne" : "Avg Loss"}</div>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/60">
              <div className="text-lg font-bold text-primary">{performance.bestRR.toFixed(2)}R</div>
              <div className="text-[10px] text-muted-foreground">{language === "fr" ? "Meilleur RR" : "Best RR"}</div>
            </div>
          </div>
        ) : !perfLoading ? (
          <div className="text-center py-6 text-sm text-muted-foreground">
            {language === "fr" ? "Aucune donnée de performance" : "No performance data"}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-lg" />
            ))}
          </div>
        )}
      </Card>

      {/* Overview */}
      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <BookOpen className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold">{language === "fr" ? "Vue d'ensemble" : "Overview"}</span>
        </div>
        {playbook.description && (
          <p className="text-sm text-muted-foreground mb-3 whitespace-pre-wrap">{playbook.description}</p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {playbook.direction && (
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-[10px] text-muted-foreground mb-0.5">{language === "fr" ? "Direction" : "Direction"}</div>
              <Badge variant="outline" className={cn("text-[11px]", dir.color)}>
                {language === "fr" ? dir.label_fr : dir.label_en}
              </Badge>
            </div>
          )}
          {playbook.marketCondition && (
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-[10px] text-muted-foreground mb-0.5">{language === "fr" ? "Condition" : "Condition"}</div>
              <span className="text-xs font-medium">{playbook.marketCondition}</span>
            </div>
          )}
          {playbook.session && (
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-[10px] text-muted-foreground mb-0.5">{language === "fr" ? "Session" : "Session"}</div>
              <span className="text-xs font-medium">{playbook.session}</span>
            </div>
          )}
          {playbook.timeframe && (
            <div className="p-2 rounded-lg bg-muted/50">
              <div className="text-[10px] text-muted-foreground mb-0.5">{language === "fr" ? "Timeframe" : "Timeframe"}</div>
              <span className="text-xs font-medium">{playbook.timeframe}</span>
            </div>
          )}
        </div>
      </Card>

      {/* Entry Rules */}
      {entryRules.length > 0 && (
        <Card className="p-4 border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
              {language === "fr" ? "Règles d'Entrée" : "Entry Rules"}
            </span>
          </div>
          <ol className="space-y-2">
            {entryRules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{rule}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Exit Rules */}
      {exitRules.length > 0 && (
        <Card className="p-4 border-red-500/20 bg-red-500/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <XCircle className="w-4 h-4 text-red-500" />
            <span className="text-sm font-semibold text-red-600 dark:text-red-400">
              {language === "fr" ? "Règles de Sortie" : "Exit Rules"}
            </span>
          </div>
          <ol className="space-y-2">
            {exitRules.map((rule, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold shrink-0 mt-0.5">
                  {i + 1}
                </span>
                <span className="text-muted-foreground">{rule}</span>
              </li>
            ))}
          </ol>
        </Card>
      )}

      {/* Risk Management */}
      {(playbook.stopLossRules || playbook.takeProfitRules || playbook.trailingStopRules || playbook.riskPerTrade || playbook.targetRR) && (
        <Card className="p-4 border-amber-500/20 bg-amber-500/[0.02]">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-amber-500" />
            <span className="text-sm font-semibold text-amber-600 dark:text-amber-400">
              {language === "fr" ? "Gestion du Risque" : "Risk Management"}
            </span>
          </div>
          <div className="space-y-3">
            {playbook.stopLossRules && (
              <div>
                <div className="text-[11px] font-medium text-red-500 mb-1 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {language === "fr" ? "Stop Loss" : "Stop Loss"}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{playbook.stopLossRules}</p>
              </div>
            )}
            {playbook.takeProfitRules && (
              <div>
                <div className="text-[11px] font-medium text-emerald-500 mb-1 flex items-center gap-1">
                  <Target className="w-3 h-3" />
                  {language === "fr" ? "Take Profit" : "Take Profit"}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{playbook.takeProfitRules}</p>
              </div>
            )}
            {playbook.trailingStopRules && (
              <div>
                <div className="text-[11px] font-medium text-cyan-500 mb-1 flex items-center gap-1">
                  <Gauge className="w-3 h-3" />
                  {language === "fr" ? "Trailing Stop" : "Trailing Stop"}
                </div>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{playbook.trailingStopRules}</p>
              </div>
            )}
            <div className="flex items-center gap-4">
              {playbook.riskPerTrade && (
                <div className="p-2 rounded-lg bg-red-500/5 border border-red-500/10">
                  <div className="text-[10px] text-muted-foreground">{language === "fr" ? "Risque par Trade" : "Risk per Trade"}</div>
                  <div className="text-sm font-bold text-red-500">{playbook.riskPerTrade}%</div>
                </div>
              )}
              {playbook.targetRR && (
                <div className="p-2 rounded-lg bg-emerald-500/5 border border-emerald-500/10">
                  <div className="text-[10px] text-muted-foreground">{language === "fr" ? "RR Cible" : "Target RR"}</div>
                  <div className="text-sm font-bold text-emerald-500">{playbook.targetRR}R</div>
                </div>
              )}
            </div>
          </div>
        </Card>
      )}

      {/* Checklist */}
      {checklistItems.length > 0 && (
        <Card className="p-4 border-emerald-500/20 bg-emerald-500/[0.02]">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-emerald-500" />
              <span className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                {language === "fr" ? "Checklist" : "Checklist"}
              </span>
              {savingChecklist && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
            </div>
            <span className="text-[10px] text-muted-foreground">{checkedCount}/{checklistItems.length}</span>
          </div>
          <Progress value={checklistProgress} className="h-1.5 mb-3" />
          <div className="space-y-2">
            {checklistItems.map((item, i) => (
              <label key={i} className="flex items-center gap-2 cursor-pointer group">
                <Checkbox
                  checked={item.checked}
                  onCheckedChange={() => handleToggleChecklist(i)}
                  className="data-[state=checked]:bg-emerald-500 data-[state=checked]:border-emerald-500"
                />
                <span className={cn(
                  "text-sm transition-colors",
                  item.checked ? "line-through text-muted-foreground" : "text-foreground"
                )}>
                  {item.text}
                </span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Tag className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{language === "fr" ? "Tags" : "Tags"}</span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {tags.map((tag) => (
              <Badge key={tag} variant="outline" className="text-[11px] px-2 py-0.5 text-primary border-primary/20">
                {tag}
              </Badge>
            ))}
          </div>
        </Card>
      )}

      {/* Screenshots */}
      {playbook.screenshots && playbook.screenshots.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{language === "fr" ? "Captures d'écran" : "Screenshots"}</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {playbook.screenshots.map((ss) => {
              const ssType = SCREENSHOT_TYPES.find(s => s.id === ss.type);
              return (
                <div key={ss.id} className="relative group rounded-lg overflow-hidden border bg-muted/30">
                  <img
                    src={ss.url}
                    alt={ss.caption || ss.type}
                    className="w-full h-28 object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5">
                    <span className="text-[9px] text-white font-medium">
                      {ssType ? (language === "fr" ? ssType.label_fr : ssType.label_en) : ss.type}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Notes */}
      {playbook.notes && (
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold">{language === "fr" ? "Notes" : "Notes"}</span>
          </div>
          <p className="text-sm text-muted-foreground whitespace-pre-wrap">{playbook.notes}</p>
        </Card>
      )}

      {/* Created date */}
      <div className="text-[10px] text-muted-foreground text-right pt-1">
        {language === "fr" ? "Créé le" : "Created"} {format(new Date(playbook.createdAt), "MMM d, yyyy")}
        {playbook.updatedAt !== playbook.createdAt && (
          <> · {language === "fr" ? "Modifié le" : "Updated"} {format(new Date(playbook.updatedAt), "MMM d, yyyy")}</>
        )}
      </div>
    </div>
  );
}

// ─── Playbook Form ──────────────────────────────────────
function PlaybookForm({
  playbook,
  language,
  onSave,
  onCancel,
}: {
  playbook: Playbook | null;
  language: "fr" | "en";
  onSave: (data: any) => void;
  onCancel: () => void;
}) {
  const isEditing = !!playbook;
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState("basic");

  // Basic info
  const [name, setName] = useState(playbook?.name || "");
  const [description, setDescription] = useState(playbook?.description || "");
  const [category, setCategory] = useState(playbook?.category || "");
  const [direction, setDirection] = useState(playbook?.direction || "");
  const [marketCondition, setMarketCondition] = useState(playbook?.marketCondition || "");
  const [session, setSession] = useState(playbook?.session || "");
  const [timeframe, setTimeframe] = useState(playbook?.timeframe || "");
  const [status, setStatus] = useState(playbook?.status || "ACTIVE");
  const [color, setColor] = useState(playbook?.color || "#10b981");

  // Rules
  const [entryRules, setEntryRules] = useState<string[]>(
    playbook?.entryRules || []
  );
  const [exitRules, setExitRules] = useState<string[]>(
    playbook?.exitRules || []
  );
  const [newEntryRule, setNewEntryRule] = useState("");
  const [newExitRule, setNewExitRule] = useState("");

  // Risk
  const [stopLossRules, setStopLossRules] = useState(playbook?.stopLossRules || "");
  const [takeProfitRules, setTakeProfitRules] = useState(playbook?.takeProfitRules || "");
  const [trailingStopRules, setTrailingStopRules] = useState(playbook?.trailingStopRules || "");
  const [riskPerTrade, setRiskPerTrade] = useState<string>(playbook?.riskPerTrade?.toString() || "");
  const [targetRR, setTargetRR] = useState<string>(playbook?.targetRR?.toString() || "");

  // Checklist
  const [checklist, setChecklist] = useState<{ text: string; checked: boolean }[]>(
    playbook?.checklist || []
  );
  const [newChecklistItem, setNewChecklistItem] = useState("");

  // Tags
  const [tags, setTags] = useState<string[]>(playbook?.tags || []);
  const [newTag, setNewTag] = useState("");

  // Screenshots
  const [screenshots, setScreenshots] = useState<Screenshot[]>(playbook?.screenshots || []);
  const [screenshotType, setScreenshotType] = useState("example_win");
  const [screenshotCaption, setScreenshotCaption] = useState("");

  const handleAddEntryRule = () => {
    if (newEntryRule.trim()) {
      setEntryRules([...entryRules, newEntryRule.trim()]);
      setNewEntryRule("");
    }
  };

  const handleRemoveEntryRule = (index: number) => {
    setEntryRules(entryRules.filter((_, i) => i !== index));
  };

  const handleAddExitRule = () => {
    if (newExitRule.trim()) {
      setExitRules([...exitRules, newExitRule.trim()]);
      setNewExitRule("");
    }
  };

  const handleRemoveExitRule = (index: number) => {
    setExitRules(exitRules.filter((_, i) => i !== index));
  };

  const handleAddChecklistItem = () => {
    if (newChecklistItem.trim()) {
      setChecklist([...checklist, { text: newChecklistItem.trim(), checked: false }]);
      setNewChecklistItem("");
    }
  };

  const handleRemoveChecklistItem = (index: number) => {
    setChecklist(checklist.filter((_, i) => i !== index));
  };

  const handleAddTag = () => {
    if (newTag.trim() && !tags.includes(newTag.trim())) {
      setTags([...tags, newTag.trim()]);
      setNewTag("");
    }
  };

  const handleRemoveTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  const handleSubmit = async () => {
    if (!name.trim()) {
      toast.error(language === "fr" ? "Le nom est requis" : "Name is required");
      return;
    }
    setSaving(true);

    const data: any = {
      name: name.trim(),
      description: description.trim() || null,
      category: category || null,
      direction: direction || null,
      marketCondition: marketCondition || null,
      session: session || null,
      timeframe: timeframe || null,
      status,
      color,
      entryRules: JSON.stringify(entryRules),
      exitRules: JSON.stringify(exitRules),
      stopLossRules: stopLossRules.trim() || null,
      takeProfitRules: takeProfitRules.trim() || null,
      trailingStopRules: trailingStopRules.trim() || null,
      riskPerTrade: riskPerTrade ? parseFloat(riskPerTrade) : null,
      targetRR: targetRR ? parseFloat(targetRR) : null,
      checklist: JSON.stringify(checklist),
      tags: JSON.stringify(tags),
      notes: null,
    };

    try {
      const url = isEditing ? `/api/playbooks/${playbook.id}` : "/api/playbooks";
      const method = isEditing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (res.ok) {
        toast.success(
          isEditing
            ? (language === "fr" ? "Playbook mis à jour" : "Playbook updated")
            : (language === "fr" ? "Playbook créé" : "Playbook created")
        );
        onSave(await res.json());
      } else {
        toast.error(language === "fr" ? "Erreur de sauvegarde" : "Save error");
      }
    } catch {
      toast.error(language === "fr" ? "Erreur de sauvegarde" : "Save error");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold">
          {isEditing
            ? (language === "fr" ? "Modifier le Playbook" : "Edit Playbook")
            : (language === "fr" ? "Nouveau Playbook" : "New Playbook")}
        </h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel}>
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button size="sm" onClick={handleSubmit} disabled={saving} className="gap-1.5">
            {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
            {language === "fr" ? "Enregistrer" : "Save"}
          </Button>
        </div>
      </div>

      {/* Form Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full flex-wrap">
          <TabsTrigger value="basic" className="gap-1 text-xs">
            <BookOpen className="w-3 h-3" />
            <span className="hidden sm:inline">{language === "fr" ? "Infos" : "Info"}</span>
          </TabsTrigger>
          <TabsTrigger value="rules" className="gap-1 text-xs">
            <CheckCircle className="w-3 h-3" />
            <span className="hidden sm:inline">{language === "fr" ? "Règles" : "Rules"}</span>
          </TabsTrigger>
          <TabsTrigger value="risk" className="gap-1 text-xs">
            <Shield className="w-3 h-3" />
            <span className="hidden sm:inline">{language === "fr" ? "Risque" : "Risk"}</span>
          </TabsTrigger>
          <TabsTrigger value="checklist" className="gap-1 text-xs">
            <ClipboardList className="w-3 h-3" />
            <span className="hidden sm:inline">{language === "fr" ? "Checklist" : "Checklist"}</span>
          </TabsTrigger>
          <TabsTrigger value="tags" className="gap-1 text-xs">
            <Tag className="w-3 h-3" />
            <span className="hidden sm:inline">{language === "fr" ? "Tags" : "Tags"}</span>
          </TabsTrigger>
          <TabsTrigger value="screenshots" className="gap-1 text-xs">
            <Camera className="w-3 h-3" />
            <span className="hidden sm:inline">{language === "fr" ? "Captures" : "Screens"}</span>
          </TabsTrigger>
        </TabsList>

        {/* Basic Info Tab */}
        <TabsContent value="basic" className="space-y-4 mt-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="sm:col-span-2">
              <Label className="text-xs">{language === "fr" ? "Nom du Playbook" : "Playbook Name"} *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={language === "fr" ? "Ex: Breakout Londres" : "e.g., London Breakout"}
                className="mt-1"
              />
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">{language === "fr" ? "Description" : "Description"}</Label>
              <Textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={language === "fr" ? "Décrivez votre playbook..." : "Describe your playbook..."}
                className="mt-1 min-h-[80px]"
              />
            </div>
            <div>
              <Label className="text-xs">{language === "fr" ? "Catégorie" : "Category"}</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      <div className="flex items-center gap-1.5">
                        {React.createElement(cat.icon, { className: "w-3 h-3" })}
                        {language === "fr" ? cat.label_fr : cat.label_en}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{language === "fr" ? "Direction" : "Direction"}</Label>
              <Select value={direction} onValueChange={setDirection}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {DIRECTIONS.map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {language === "fr" ? d.label_fr : d.label_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{language === "fr" ? "Condition du Marché" : "Market Condition"}</Label>
              <Select value={marketCondition} onValueChange={setMarketCondition}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {MARKET_CONDITIONS.map((mc) => (
                    <SelectItem key={mc.id} value={mc.id}>
                      {language === "fr" ? mc.label_fr : mc.label_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{language === "fr" ? "Session" : "Session"}</Label>
              <Select value={session} onValueChange={setSession}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {SESSIONS.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {language === "fr" ? s.label_fr : s.label_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{language === "fr" ? "Timeframe" : "Timeframe"}</Label>
              <Select value={timeframe} onValueChange={setTimeframe}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue placeholder={language === "fr" ? "Sélectionner" : "Select"} />
                </SelectTrigger>
                <SelectContent>
                  {TIMEFRAMES.map((tf) => (
                    <SelectItem key={tf} value={tf}>{tf}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">{language === "fr" ? "Statut" : "Status"}</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="mt-1 w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUSES.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {language === "fr" ? s.label_fr : s.label_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label className="text-xs">{language === "fr" ? "Couleur" : "Color"}</Label>
              <div className="flex items-center gap-2 mt-1">
                {COLORS.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    className={cn(
                      "w-7 h-7 rounded-full transition-all border-2",
                      color === c.value ? "border-foreground scale-110" : "border-transparent hover:scale-105"
                    )}
                    style={{ backgroundColor: c.value }}
                    onClick={() => setColor(c.value)}
                    title={language === "fr" ? c.name_fr : c.name_en}
                  />
                ))}
              </div>
            </div>
          </div>
        </TabsContent>

        {/* Rules Tab */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          {/* Entry Rules */}
          <Card className="p-4 border-emerald-500/20">
            <div className="flex items-center gap-2 mb-3">
              <CheckCircle className="w-4 h-4 text-emerald-500" />
              <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {language === "fr" ? "Règles d'Entrée" : "Entry Rules"}
              </Label>
            </div>
            <div className="space-y-2 mb-3">
              {entryRules.map((rule, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm">{rule}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemoveEntryRule(i)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newEntryRule}
                onChange={(e) => setNewEntryRule(e.target.value)}
                placeholder={language === "fr" ? "Nouvelle règle d'entrée..." : "New entry rule..."}
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddEntryRule())}
              />
              <Button variant="outline" size="sm" onClick={handleAddEntryRule} className="gap-1 shrink-0">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </Card>

          {/* Exit Rules */}
          <Card className="p-4 border-red-500/20">
            <div className="flex items-center gap-2 mb-3">
              <XCircle className="w-4 h-4 text-red-500" />
              <Label className="text-xs font-semibold text-red-600 dark:text-red-400">
                {language === "fr" ? "Règles de Sortie" : "Exit Rules"}
              </Label>
            </div>
            <div className="space-y-2 mb-3">
              {exitRules.map((rule, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className="flex items-center justify-center w-5 h-5 rounded-full bg-red-500/10 text-red-600 dark:text-red-400 text-[10px] font-bold shrink-0 mt-0.5">
                    {i + 1}
                  </span>
                  <span className="flex-1 text-sm">{rule}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemoveExitRule(i)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Input
                value={newExitRule}
                onChange={(e) => setNewExitRule(e.target.value)}
                placeholder={language === "fr" ? "Nouvelle règle de sortie..." : "New exit rule..."}
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExitRule())}
              />
              <Button variant="outline" size="sm" onClick={handleAddExitRule} className="gap-1 shrink-0">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Risk Tab */}
        <TabsContent value="risk" className="space-y-4 mt-4">
          <Card className="p-4 border-amber-500/20">
            <div className="flex items-center gap-2 mb-4">
              <Shield className="w-4 h-4 text-amber-500" />
              <Label className="text-xs font-semibold text-amber-600 dark:text-amber-400">
                {language === "fr" ? "Gestion du Risque" : "Risk Management"}
              </Label>
            </div>
            <div className="space-y-4">
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <AlertTriangle className="w-3 h-3 text-red-500" />
                  {language === "fr" ? "Règles Stop Loss" : "Stop Loss Rules"}
                </Label>
                <Textarea
                  value={stopLossRules}
                  onChange={(e) => setStopLossRules(e.target.value)}
                  placeholder={language === "fr" ? "Ex: Stop sous le plus bas récent..." : "e.g., Stop below recent low..."}
                  className="min-h-[80px]"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Target className="w-3 h-3 text-emerald-500" />
                  {language === "fr" ? "Règles Take Profit" : "Take Profit Rules"}
                </Label>
                <Textarea
                  value={takeProfitRules}
                  onChange={(e) => setTakeProfitRules(e.target.value)}
                  placeholder={language === "fr" ? "Ex: Sortie partielle à 1R..." : "e.g., Partial exit at 1R..."}
                  className="min-h-[80px]"
                />
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1 mb-1">
                  <Gauge className="w-3 h-3 text-cyan-500" />
                  {language === "fr" ? "Règles Trailing Stop" : "Trailing Stop Rules"}
                </Label>
                <Textarea
                  value={trailingStopRules}
                  onChange={(e) => setTrailingStopRules(e.target.value)}
                  placeholder={language === "fr" ? "Ex: Trailing après 1R atteint..." : "e.g., Trail after 1R hit..."}
                  className="min-h-[80px]"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">{language === "fr" ? "Risque par Trade (%)" : "Risk per Trade (%)"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={riskPerTrade}
                    onChange={(e) => setRiskPerTrade(e.target.value)}
                    placeholder="1.0"
                    className="mt-1"
                  />
                </div>
                <div>
                  <Label className="text-xs">{language === "fr" ? "RR Cible" : "Target RR"}</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    value={targetRR}
                    onChange={(e) => setTargetRR(e.target.value)}
                    placeholder="2.0"
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          </Card>
        </TabsContent>

        {/* Checklist Tab */}
        <TabsContent value="checklist" className="space-y-4 mt-4">
          <Card className="p-4 border-emerald-500/20">
            <div className="flex items-center gap-2 mb-3">
              <ClipboardList className="w-4 h-4 text-emerald-500" />
              <Label className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                {language === "fr" ? "Checklist" : "Checklist"}
              </Label>
            </div>
            <div className="space-y-2 mb-3">
              {checklist.map((item, i) => (
                <div key={i} className="flex items-center gap-2">
                  <Checkbox checked={item.checked} disabled className="shrink-0" />
                  <span className="flex-1 text-sm">{item.text}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive shrink-0"
                    onClick={() => handleRemoveChecklistItem(i)}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
              {checklist.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-2">
                  {language === "fr" ? "Aucun élément de checklist" : "No checklist items"}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newChecklistItem}
                onChange={(e) => setNewChecklistItem(e.target.value)}
                placeholder={language === "fr" ? "Nouvel élément..." : "New item..."}
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddChecklistItem())}
              />
              <Button variant="outline" size="sm" onClick={handleAddChecklistItem} className="gap-1 shrink-0">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Tags Tab */}
        <TabsContent value="tags" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Tag className="w-4 h-4 text-primary" />
              <Label className="text-xs font-semibold">{language === "fr" ? "Tags" : "Tags"}</Label>
            </div>
            <div className="flex items-center gap-1.5 flex-wrap mb-3">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[11px] px-2 py-0.5 text-primary border-primary/20 gap-1">
                  {tag}
                  <button
                    type="button"
                    onClick={() => handleRemoveTag(tag)}
                    className="hover:text-destructive transition-colors"
                  >
                    <X className="w-2.5 h-2.5" />
                  </button>
                </Badge>
              ))}
              {tags.length === 0 && (
                <p className="text-sm text-muted-foreground">{language === "fr" ? "Aucun tag" : "No tags"}</p>
              )}
            </div>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                placeholder={language === "fr" ? "Nouveau tag..." : "New tag..."}
                className="text-sm"
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddTag())}
              />
              <Button variant="outline" size="sm" onClick={handleAddTag} className="gap-1 shrink-0">
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </Card>
        </TabsContent>

        {/* Screenshots Tab */}
        <TabsContent value="screenshots" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Camera className="w-4 h-4 text-primary" />
              <Label className="text-xs font-semibold">{language === "fr" ? "Captures d'écran" : "Screenshots"}</Label>
            </div>
            {screenshots.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mb-4">
                {screenshots.map((ss) => {
                  const ssType = SCREENSHOT_TYPES.find(s => s.id === ss.type);
                  return (
                    <div key={ss.id} className="relative group rounded-lg overflow-hidden border bg-muted/30">
                      <img
                        src={ss.url}
                        alt={ss.caption || ss.type}
                        className="w-full h-24 object-cover"
                      />
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/60 to-transparent p-1.5 flex items-center justify-between">
                        <span className="text-[9px] text-white font-medium">
                          {ssType ? (language === "fr" ? ssType.label_fr : ssType.label_en) : ss.type}
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-4 w-4 p-0 text-white hover:text-destructive"
                          onClick={() => setScreenshots(screenshots.filter(s => s.id !== ss.id))}
                        >
                          <X className="w-2.5 h-2.5" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <div className="flex items-center gap-2">
              <Select value={screenshotType} onValueChange={setScreenshotType}>
                <SelectTrigger className="w-[140px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SCREENSHOT_TYPES.map((st) => (
                    <SelectItem key={st.id} value={st.id}>
                      {language === "fr" ? st.label_fr : st.label_en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={screenshotCaption}
                onChange={(e) => setScreenshotCaption(e.target.value)}
                placeholder={language === "fr" ? "Légende (optionnel)" : "Caption (optional)"}
                className="text-sm flex-1"
              />
              <Button variant="outline" size="sm" className="gap-1 shrink-0">
                <ImagePlus className="w-3 h-3" />
                <span className="hidden sm:inline">{language === "fr" ? "Ajouter" : "Add"}</span>
              </Button>
            </div>
            <p className="text-[10px] text-muted-foreground mt-2">
              {language === "fr"
                ? "Les captures d'écran seront liées après la création du playbook."
                : "Screenshots can be linked after playbook creation."}
            </p>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

// ─── Delete Confirmation Dialog ─────────────────────────
function DeleteDialog({
  open,
  onClose,
  onConfirm,
  playbookName,
  language,
  deleting,
}: {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  playbookName: string;
  language: "fr" | "en";
  deleting: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-destructive" />
            {language === "fr" ? "Supprimer le Playbook" : "Delete Playbook"}
          </DialogTitle>
          <DialogDescription>
            {language === "fr"
              ? `Êtes-vous sûr de vouloir supprimer "${playbookName}" ? Cette action est irréversible.`
              : `Are you sure you want to delete "${playbookName}"? This action cannot be undone.`}
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose} disabled={deleting}>
            {language === "fr" ? "Annuler" : "Cancel"}
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={deleting} className="gap-1.5">
            {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
            {language === "fr" ? "Supprimer" : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Component ─────────────────────────────────────
export function PlaybookTab() {
  const { language } = useAppStore();
  const { playbooks, loading, refetch } = usePlaybooks();

  // View state
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"list" | "detail" | "form">("list");
  const [editingPlaybook, setEditingPlaybook] = useState<Playbook | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<Playbook | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Fetch on mount
  useEffect(() => { refetch(); }, [refetch]);

  // Selected playbook
  const selectedPlaybook = useMemo(
    () => playbooks.find(p => p.id === selectedId) || null,
    [playbooks, selectedId]
  );

  // Filtered playbooks
  const filteredPlaybooks = useMemo(() => {
    let result = [...playbooks];

    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(q) ||
        p.description?.toLowerCase().includes(q) ||
        (p.tags || []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    if (filterStatus) {
      result = result.filter(p => p.status === filterStatus);
    }

    if (filterCategory) {
      result = result.filter(p => p.category === filterCategory);
    }

    // Sort: Active first, then Paused, then Archived; within same status, by updatedAt desc
    const statusOrder: Record<string, number> = { ACTIVE: 0, PAUSED: 1, ARCHIVED: 2 };
    result.sort((a, b) => {
      const so = (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3);
      if (so !== 0) return so;
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
    });

    return result;
  }, [playbooks, searchQuery, filterStatus, filterCategory]);

  // Stats
  const activeCount = playbooks.filter(p => p.status === "ACTIVE").length;
  const totalTrades = playbooks.reduce((acc, p) => acc + (p._count?.trades || 0), 0);

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setViewMode("detail");
  };

  const handleNew = () => {
    setEditingPlaybook(null);
    setViewMode("form");
  };

  const handleEdit = (playbook: Playbook) => {
    setEditingPlaybook(playbook);
    setViewMode("form");
  };

  const handleFormSave = (_result: any) => {
    setViewMode("detail");
    setEditingPlaybook(null);
    refetch();
  };

  const handleFormCancel = () => {
    if (editingPlaybook && selectedId) {
      setViewMode("detail");
    } else {
      setViewMode("list");
    }
    setEditingPlaybook(null);
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/playbooks/${deleteTarget.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(language === "fr" ? "Playbook supprimé" : "Playbook deleted");
        if (selectedId === deleteTarget.id) {
          setSelectedId(null);
          setViewMode("list");
        }
        refetch();
      } else {
        toast.error(language === "fr" ? "Erreur de suppression" : "Delete error");
      }
    } catch {
      toast.error(language === "fr" ? "Erreur de suppression" : "Delete error");
    }
    setDeleting(false);
    setDeleteTarget(null);
  };

  const handleBackToList = () => {
    setSelectedId(null);
    setViewMode("list");
  };

  // Stats cards
  const statsCards = [
    {
      icon: BookOpen,
      label: language === "fr" ? "Playbooks" : "Playbooks",
      value: playbooks.length,
      color: "text-primary",
    },
    {
      icon: Flame,
      label: language === "fr" ? "Actifs" : "Active",
      value: activeCount,
      color: "text-emerald-500",
    },
    {
      icon: BarChart3,
      label: language === "fr" ? "Trades Total" : "Total Trades",
      value: totalTrades,
      color: "text-amber-500",
    },
  ];

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {language === "fr" ? "Playbook" : "Playbook"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr"
              ? "Définissez et suivez vos configurations de trading"
              : "Define and track your trading setups"}
          </p>
        </div>
        <Button size="sm" onClick={handleNew} className="gap-1.5">
          <Plus className="w-4 h-4" />
          {language === "fr" ? "Nouveau Playbook" : "New Playbook"}
        </Button>
      </div>

      {/* ─── Stats Bar ─────────────────────────────── */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        {statsCards.map((stat) => (
          <Card key={stat.label} className="p-3 flex items-center gap-3">
            <div className={cn("p-2 rounded-lg bg-muted/50", stat.color)}>
              <stat.icon className="w-4 h-4" />
            </div>
            <div>
              <div className="text-lg font-bold">{stat.value}</div>
              <div className="text-[10px] text-muted-foreground">{stat.label}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* ─── Main Layout ────────────────────────────── */}
      <div className="flex gap-4">
        {/* Left Panel - List */}
        <div className={cn(
          "transition-all duration-300",
          viewMode === "detail" || viewMode === "form"
            ? "hidden md:block md:w-[340px] lg:w-[380px] shrink-0"
            : "w-full"
        )}>
          {/* Search and Filters */}
          <div className="mb-3 space-y-2">
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={language === "fr" ? "Rechercher un playbook..." : "Search playbooks..."}
                  className="pl-8 h-8 text-sm"
                />
              </div>
              <Button
                variant={showFilters ? "secondary" : "outline"}
                size="sm"
                className="h-8 gap-1"
                onClick={() => setShowFilters(!showFilters)}
              >
                <Layers className="w-3.5 h-3.5" />
              </Button>
            </div>

            {showFilters && (
              <div className="flex items-center gap-2 flex-wrap">
                <Select value={filterStatus || ""} onValueChange={(v) => setFilterStatus(v || null)}>
                  <SelectTrigger className="h-7 text-[11px] w-[120px]">
                    <SelectValue placeholder={language === "fr" ? "Statut" : "Status"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{language === "fr" ? "Tous" : "All"}</SelectItem>
                    {STATUSES.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {language === "fr" ? s.label_fr : s.label_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={filterCategory || ""} onValueChange={(v) => setFilterCategory(v || null)}>
                  <SelectTrigger className="h-7 text-[11px] w-[130px]">
                    <SelectValue placeholder={language === "fr" ? "Catégorie" : "Category"} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">{language === "fr" ? "Toutes" : "All"}</SelectItem>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {language === "fr" ? c.label_fr : c.label_en}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {(filterStatus || filterCategory) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-[11px] text-muted-foreground"
                    onClick={() => { setFilterStatus(null); setFilterCategory(null); }}
                  >
                    {language === "fr" ? "Réinitialiser" : "Reset"}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Playbook List */}
          <ScrollArea className="h-[calc(100vh-320px)]">
            {loading ? (
              <div className="space-y-3 pr-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i} className="p-4">
                    <div className="flex items-start gap-3">
                      <Skeleton className="w-3 h-3 rounded-full mt-1.5" />
                      <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-5 w-1/2" />
                        <Skeleton className="h-3 w-1/3" />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : filteredPlaybooks.length > 0 ? (
              <div className="space-y-2 pr-2">
                {filteredPlaybooks.map((playbook) => (
                  <PlaybookCard
                    key={playbook.id}
                    playbook={playbook}
                    isSelected={selectedId === playbook.id}
                    language={language}
                    onClick={() => handleSelect(playbook.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-muted-foreground">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm font-medium">
                  {searchQuery || filterStatus || filterCategory
                    ? (language === "fr" ? "Aucun playbook trouvé" : "No playbooks found")
                    : (language === "fr" ? "Aucun playbook créé" : "No playbooks yet")}
                </p>
                <p className="text-xs mt-1">
                  {language === "fr" ? "Créez votre premier playbook" : "Create your first playbook"}
                </p>
                <Button size="sm" onClick={handleNew} className="gap-1.5 mt-3">
                  <Plus className="w-3.5 h-3.5" />
                  {language === "fr" ? "Nouveau Playbook" : "New Playbook"}
                </Button>
              </div>
            )}
          </ScrollArea>
        </div>

        {/* Right Panel - Detail or Form */}
        <div className={cn(
          "flex-1 min-w-0 transition-all duration-300",
          viewMode === "list" ? "hidden md:block" : "block"
        )}>
          {viewMode === "form" ? (
            <PlaybookForm
              playbook={editingPlaybook}
              language={language}
              onSave={handleFormSave}
              onCancel={handleFormCancel}
            />
          ) : viewMode === "detail" && selectedPlaybook ? (
            <PlaybookDetail
              playbook={selectedPlaybook}
              language={language}
              onEdit={() => handleEdit(selectedPlaybook)}
              onDelete={() => setDeleteTarget(selectedPlaybook)}
              onBack={handleBackToList}
            />
          ) : (
            /* Empty state for right panel */
            <div className="flex items-center justify-center h-[calc(100vh-320px)] text-muted-foreground">
              <div className="text-center">
                <BookOpen className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">
                  {language === "fr" ? "Sélectionnez un playbook" : "Select a playbook"}
                </p>
                <p className="text-xs mt-1">
                  {language === "fr" ? "ou créez-en un nouveau" : "or create a new one"}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Delete Dialog */}
      <DeleteDialog
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDelete}
        playbookName={deleteTarget?.name || ""}
        language={language}
        deleting={deleting}
      />
    </div>
  );
}
