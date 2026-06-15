"use client";

import React, { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useNotes } from "@/lib/hooks";
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
import { Slider } from "@/components/ui/slider";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  StickyNote,
  Plus,
  Edit3,
  Trash2,
  Calendar,
  Sun,
  CalendarDays,
  CalendarRange,
  Save,
  Loader2,
  Bell,
  BellRing,
  ImagePlus,
  X,
  Eye,
  ExternalLink,
  Camera,
  Search,
  Pin,
  PinOff,
  Target,
  TrendingUp,
  TrendingDown,
  Minus,
  Brain,
  CheckSquare,
  Square,
  Tag,
  BarChart3,
  Sparkles,
  Filter,
  ArrowUpDown,
  Zap,
  Activity,
  ChevronDown,
  ChevronRight,
  Heart,
  Shield,
  AlertTriangle,
  FileText,
  Layout,
  Star,
  Flame,
  Lightbulb,
  ClipboardList,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday, isThisWeek, isThisMonth } from "date-fns";
import { getFileUrl } from "@/lib/storage";

// ─── Constants ──────────────────────────────────────────
const NOTE_TYPES = [
  { id: "DAY", label_fr: "Journée", label_en: "Day", icon: Sun, color: "text-amber-500" },
  { id: "WEEK", label_fr: "Semaine", label_en: "Week", icon: CalendarDays, color: "text-primary" },
  { id: "MONTH", label_fr: "Mois", label_en: "Month", icon: CalendarRange, color: "text-emerald-500" },
];

const MOODS = [
  { emoji: "😊", label_fr: "Confiant", label_en: "Confident", color: "bg-emerald-500/10 border-emerald-500/30" },
  { emoji: "🧠", label_fr: "Concentré", label_en: "Focused", color: "bg-blue-500/10 border-blue-500/30" },
  { emoji: "💪", label_fr: "Déterminé", label_en: "Determined", color: "bg-purple-500/10 border-purple-500/30" },
  { emoji: "😐", label_fr: "Neutre", label_en: "Neutral", color: "bg-gray-500/10 border-gray-500/30" },
  { emoji: "😤", label_fr: "Frustré", label_en: "Frustrated", color: "bg-orange-500/10 border-orange-500/30" },
  { emoji: "😴", label_fr: "Fatigué", label_en: "Tired", color: "bg-slate-500/10 border-slate-500/30" },
  { emoji: "😰", label_fr: "Anxieux", label_en: "Anxious", color: "bg-red-500/10 border-red-500/30" },
  { emoji: "🔥", label_fr: "En feu", label_en: "On fire", color: "bg-rose-500/10 border-rose-500/30" },
];

const BIASES = [
  { id: "BULLISH", label_fr: "Haussier", label_en: "Bullish", icon: TrendingUp, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
  { id: "BEARISH", label_fr: "Baissier", label_en: "Bearish", icon: TrendingDown, color: "text-red-500 bg-red-500/10 border-red-500/30" },
  { id: "NEUTRAL", label_fr: "Neutre", label_en: "Neutral", icon: Minus, color: "text-gray-500 bg-gray-500/10 border-gray-500/30" },
];

const PRIORITIES = [
  { id: "URGENT", label_fr: "Urgent", label_en: "Urgent", color: "text-red-600 bg-red-500/10 border-red-500/30" },
  { id: "HIGH", label_fr: "Élevée", label_en: "High", color: "text-orange-600 bg-orange-500/10 border-orange-500/30" },
  { id: "MEDIUM", label_fr: "Moyenne", label_en: "Medium", color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  { id: "LOW", label_fr: "Basse", label_en: "Low", color: "text-slate-500 bg-slate-500/10 border-slate-500/30" },
];

const TAG_PRESETS = [
  "NFP", "FOMC", "CPI", "GDP", "News", "Range", "Trend",
  "Breakout", "Reversal", "Scalp", "Swing", "Gold",
  "Indices", "Forex", "High Impact", "Low Impact",
];

const TEMPLATES = [
  {
    id: "daily-prep",
    label_fr: "Préparation Du Jour",
    label_en: "Daily Prep",
    icon: Sun,
    type: "DAY",
    content: "",
    plan: "• Marché attendu :\n• Niveaux clés :\n• Biais principal :\n• Setups surveillés :",
    observation: "• Structure du marché :\n• Zones de liquidité :\n• Corrélations :",
    rules: "• Règle #1 :\n• Règle #2 :\n• Règle #3 :",
    checklist: [
      { text: "Analyse du cadre temporel supérieur", checked: false },
      { text: "Identification des zones clés", checked: false },
      { text: "Vérification du calendrier économique", checked: false },
      { text: "Définition du biais directionnel", checked: false },
      { text: "Plan de gestion du risque défini", checked: false },
    ],
  },
  {
    id: "weekly-review",
    label_fr: "Bilan Hebdomadaire",
    label_en: "Weekly Review",
    icon: CalendarDays,
    type: "WEEK",
    content: "",
    plan: "• Objectifs de la semaine :\n• Pairs à surveiller :\n• Sessions prioritaires :",
    observation: "• Résumé des performances :\n• Meilleur trade :\n• Pire trade :",
    rules: "• Leçons apprises :\n• Erreurs à éviter :\n• Points d'amélioration :",
    checklist: [
      { text: "Analyse des trades de la semaine", checked: false },
      { text: "Calcul du P&L net", checked: false },
      { text: "Identification des patterns récurrents", checked: false },
      { text: "Mise à jour du plan de trading", checked: false },
      { text: "Objectifs pour la semaine prochaine", checked: false },
    ],
  },
  {
    id: "monthly-review",
    label_fr: "Bilan Mensuel",
    label_en: "Monthly Review",
    icon: CalendarRange,
    type: "MONTH",
    content: "",
    plan: "• Objectifs mensuels :\n• Croissance visée :\n• Focus principal :",
    observation: "• Évolution du winrate :\n• Évolution du RR moyen :\n• Meilleur/pire jour :",
    rules: "• Règles respectées :\n• Règles enfreintes :\n• Ajustements nécessaires :",
    checklist: [
      { text: "Compilation des statistiques mensuelles", checked: false },
      { text: "Analyse des configurations les plus rentables", checked: false },
      { text: "Évaluation de la discipline", checked: false },
      { text: "Revue du plan de gestion du risque", checked: false },
      { text: "Définition des objectifs du mois suivant", checked: false },
    ],
  },
  {
    id: "pre-session",
    label_fr: "Avant Session",
    label_en: "Pre-Session",
    icon: Brain,
    type: "DAY",
    content: "",
    plan: "• État mental :\n• Niveau d'énergie :\n• Biais du jour :",
    observation: "• Contexte macro :\n• Sentiment du marché :\n• Volatilité attendue :",
    rules: "• Stop absolu (pertes max) :\n• Nombre max de trades :\n• Règle de pause :",
    checklist: [
      { text: "Méditation/Visualisation", checked: false },
      { text: "Vérification du calendrier économique", checked: false },
      { text: "Préparation des ordres", checked: false },
      { text: "État émotionnel vérifié", checked: false },
    ],
  },
];

// ─── Alert Hook ──────────────────────────────────────────
function useAlerts() {
  const [alerts, setAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/alerts");
      if (res.ok) {
        const data = await res.json();
        setAlerts(data.alerts || []);
      }
    } catch {
      setAlerts([]);
    }
    setLoading(false);
  }, []);

  return { alerts, loading, refetch: fetchAlerts };
}

// ─── Notification Checker ────────────────────────────────
function useNotificationChecker(alerts: any[]) {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!alerts.length) return;

    const checkAlerts = () => {
      const now = new Date();
      alerts.forEach((alert) => {
        if (alert.triggered) return;
        if (triggeredRef.current.has(alert.id)) return;

        const alertTime = new Date(alert.alertDate);
        if (now >= alertTime) {
          triggeredRef.current.add(alert.id);
          fetch(`/api/alerts/${alert.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ triggered: true }),
          }).catch(() => {});

          if ("Notification" in window) {
            if (Notification.permission === "granted") {
              new Notification("DONCIEL TM — Alerte", {
                body: alert.title + (alert.description ? `\n${alert.description}` : ""),
                icon: "/favicon.ico",
                tag: alert.id,
              });
            } else if (Notification.permission !== "denied") {
              Notification.requestPermission().then((perm) => {
                if (perm === "granted") {
                  new Notification("DONCIEL TM — Alerte", {
                    body: alert.title + (alert.description ? `\n${alert.description}` : ""),
                    icon: "/favicon.ico",
                    tag: alert.id,
                  });
                }
              });
            }
          }
        }
      });
    };

    checkAlerts();
    intervalRef.current = setInterval(checkAlerts, 15000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [alerts]);
}

// ─── Performance Hook ────────────────────────────────────
function useNotePerformance() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  const fetchPerf = useCallback(async (dateFrom?: string, dateTo?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (dateFrom) params.set("dateFrom", dateFrom);
      if (dateTo) params.set("dateTo", dateTo);
      const res = await fetch(`/api/notes/performance?${params}`);
      if (res.ok) {
        const result = await res.json();
        setData(result);
      }
    } catch {
      setData(null);
    }
    setLoading(false);
  }, []);

  return { performanceData: data, loadingPerf: loading, fetchPerf };
}

// ─── Parse helpers ──────────────────────────────────────
function parseJSON<T>(val: string | null | undefined, fallback: T): T {
  if (!val) return fallback;
  try { return JSON.parse(val); } catch { return fallback; }
}

function getNoteGroupLabel(date: Date, language: "fr" | "en"): string {
  if (isToday(date)) return language === "fr" ? "Aujourd'hui" : "Today";
  if (isYesterday(date)) return language === "fr" ? "Hier" : "Yesterday";
  if (isThisWeek(date)) return language === "fr" ? "Cette semaine" : "This week";
  if (isThisMonth(date)) return language === "fr" ? "Ce mois" : "This month";
  return format(date, "MMMM yyyy", { locale: undefined });
}

// ─── Main Component ──────────────────────────────────────
export function NotesTab() {
  const { language } = useAppStore();
  const [activeType, setActiveType] = useState<string>("DAY");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<"date" | "priority" | "mood">("date");
  const [filterBias, setFilterBias] = useState<string | null>(null);
  const [filterPriority, setFilterPriority] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { notes, loading, refetch } = useNotes(activeType);
  const { alerts, refetch: refetchAlerts } = useAlerts();
  const { performanceData, loadingPerf, fetchPerf } = useNotePerformance();
  const [showDialog, setShowDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [showPerfPanel, setShowPerfPanel] = useState(false);
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);

  useNotificationChecker(alerts);

  // Fetch on mount
  useEffect(() => { refetch(); refetchAlerts(); fetchPerf(); }, [refetch, refetchAlerts, fetchPerf]);

  // Filtered and sorted notes
  const filteredNotes = useMemo(() => {
    let result = notes.filter((n: any) => n.type === activeType);

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter((n: any) =>
        n.title?.toLowerCase().includes(q) ||
        n.content?.toLowerCase().includes(q) ||
        n.plan?.toLowerCase().includes(q) ||
        n.observation?.toLowerCase().includes(q) ||
        n.rules?.toLowerCase().includes(q) ||
        parseJSON<string[]>(n.tags, []).some(tag => tag.toLowerCase().includes(q))
      );
    }

    // Bias filter
    if (filterBias) {
      result = result.filter((n: any) => n.marketBias === filterBias);
    }

    // Priority filter
    if (filterPriority) {
      result = result.filter((n: any) => n.priority === filterPriority);
    }

    // Sort
    result.sort((a: any, b: any) => {
      // Pinned always first
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;

      if (sortBy === "priority") {
        const pOrder: Record<string, number> = { URGENT: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };
        return (pOrder[b.priority] || 0) - (pOrder[a.priority] || 0);
      }
      if (sortBy === "mood") {
        return (b.confidence || 0) - (a.confidence || 0);
      }
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    });

    return result;
  }, [notes, activeType, searchQuery, sortBy, filterBias, filterPriority]);

  // Group notes by date label
  const groupedNotes = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const note of filteredNotes) {
      const label = getNoteGroupLabel(new Date(note.date), language);
      if (!groups[label]) groups[label] = [];
      groups[label].push(note);
    }
    return groups;
  }, [filteredNotes, language]);

  const handleDelete = async (id: string) => {
    if (!confirm(language === "fr" ? "Supprimer cette note ?" : "Delete this note?")) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(language === "fr" ? "Note supprimée" : "Note deleted");
        refetch();
        refetchAlerts();
      }
    } catch {
      toast.error("Error");
    }
  };

  const handleEdit = (note: any) => {
    setEditingNote(note);
    setShowDialog(true);
  };

  const handleAdd = (template?: any) => {
    // Strip template id so NoteDialog knows this is a new note (not an edit)
    if (template) {
      const { id: _templateId, ...rest } = template;
      setEditingNote(rest);
    } else {
      setEditingNote(null);
    }
    setShowDialog(true);
    setShowTemplatePicker(false);
  };

  const handleTogglePin = async (note: any) => {
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      refetch();
      toast.success(note.pinned
        ? (language === "fr" ? "Note désépinglée" : "Note unpinned")
        : (language === "fr" ? "Note épinglée" : "Note pinned")
      );
    } catch {
      toast.error("Error");
    }
  };

  const handleDeleteAlert = async (id: string) => {
    if (!confirm(language === "fr" ? "Supprimer cette alerte ?" : "Delete this alert?")) return;
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(language === "fr" ? "Alerte supprimée" : "Alert deleted");
        refetchAlerts();
        refetch();
      }
    } catch {
      toast.error("Error");
    }
  };

  // Stats
  const totalNotes = notes.length;
  const pinnedCount = notes.filter((n: any) => n.pinned).length;
  const moodsUsed = notes.filter((n: any) => n.mood).length;
  const checklistsTotal = notes.reduce((acc: number, n: any) => {
    const cl = parseJSON<{ checked: boolean }[]>(n.checklist, []);
    return acc + cl.length;
  }, 0);
  const checklistsDone = notes.reduce((acc: number, n: any) => {
    const cl = parseJSON<{ checked: boolean }[]>(n.checklist, []);
    return acc + cl.filter(c => c.checked).length;
  }, 0);

  const standaloneAlerts = alerts.filter((a: any) => !a.noteId);
  const pendingAlerts = standaloneAlerts.filter((a: any) => !a.triggered);
  const triggeredAlerts = standaloneAlerts.filter((a: any) => a.triggered);

  // Notebook stats cards
  const notebookStats = [
    {
      icon: FileText,
      label: language === "fr" ? "Total Notes" : "Total Notes",
      value: totalNotes,
      color: "text-primary",
    },
    {
      icon: Pin,
      label: language === "fr" ? "Épinglées" : "Pinned",
      value: pinnedCount,
      color: "text-amber-500",
    },
    {
      icon: Heart,
      label: language === "fr" ? "Avec Humeur" : "With Mood",
      value: moodsUsed,
      color: "text-rose-500",
    },
    {
      icon: CheckSquare,
      label: language === "fr" ? "Checklist" : "Checklist",
      value: checklistsTotal > 0 ? `${checklistsDone}/${checklistsTotal}` : "—",
      color: "text-emerald-500",
    },
  ];

  return (
    <div className="p-4 md:p-6 space-y-4 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent flex items-center gap-2">
            <Layout className="w-6 h-6 text-primary" />
            {language === "fr" ? "Notebook" : "Notebook"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr" ? "Journal de trading avancé avec analyse de performance" : "Advanced trading journal with performance analysis"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => setShowPerfPanel(!showPerfPanel)}
          >
            <BarChart3 className="w-4 h-4" />
            <span className="hidden sm:inline">{language === "fr" ? "Performance" : "Performance"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => window.open("https://www.tradingview.com/chart/", "_blank")}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">TradingView</span>
          </Button>
          <Button size="sm" onClick={() => setShowTemplatePicker(true)} className="gap-1.5">
            <Sparkles className="w-4 h-4" />
            {language === "fr" ? "Nouvelle Note" : "New Note"}
          </Button>
        </div>
      </div>

      {/* ─── Stats Bar ─────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {notebookStats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="p-3 flex items-center gap-3">
              <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center bg-muted/50", stat.color)}>
                <Icon className="w-4 h-4" />
              </div>
              <div>
                <p className="text-lg font-bold leading-none">{stat.value}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ─── Performance Panel (Collapsible) ─────────── */}
      {showPerfPanel && (
        <PerformancePanel
          language={language}
          performanceData={performanceData}
          loading={loadingPerf}
          fetchPerf={fetchPerf}
        />
      )}

      {/* ─── Alerts Section ─────────────────────────── */}
      {(pendingAlerts.length > 0 || triggeredAlerts.length > 0) && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {language === "fr" ? "Mes Alertes" : "My Alerts"}
            </h3>
            <Badge variant="secondary" className="text-[10px]">{pendingAlerts.length}</Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {pendingAlerts.slice(0, 6).map((alert: any) => (
              <Card key={alert.id} className="p-2.5 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <Bell className="w-3 h-3 text-primary shrink-0" />
                      <h4 className="text-xs font-semibold truncate">{alert.title}</h4>
                    </div>
                    {alert.description && (
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{alert.description}</p>
                    )}
                    <Badge variant="outline" className="text-[9px] mt-1">
                      <Calendar className="w-2.5 h-2.5 mr-0.5" />
                      {new Date(alert.alertDate).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-5 w-5 text-loss shrink-0" onClick={() => handleDeleteAlert(alert.id)}>
                    <Trash2 className="w-2.5 h-2.5" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* ─── Type Tabs ──────────────────────────────── */}
      <div className="grid grid-cols-3 gap-2">
        {NOTE_TYPES.map((nt) => {
          const Icon = nt.icon;
          const isActive = activeType === nt.id;
          const count = notes.filter((n: any) => n.type === nt.id).length;
          return (
            <button
              key={nt.id}
              onClick={() => setActiveType(nt.id)}
              className={cn(
                "p-3 rounded-xl border-2 transition-all duration-200 text-center",
                isActive
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/30 bg-card"
              )}
            >
              <Icon className={cn("w-5 h-5 mx-auto mb-1", nt.color)} />
              <div className="text-xs font-semibold">
                {language === "fr" ? nt.label_fr : nt.label_en}
              </div>
              <Badge variant="secondary" className="text-[9px] mt-1">{count}</Badge>
            </button>
          );
        })}
      </div>

      {/* ─── Search & Filters ────────────────────────── */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={language === "fr" ? "Rechercher dans les notes..." : "Search notes..."}
              className="pl-9 h-9 text-sm"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery("")} className="absolute right-2 top-1/2 -translate-y-1/2">
                <X className="w-3.5 h-3.5 text-muted-foreground hover:text-foreground" />
              </button>
            )}
          </div>
          <Button
            variant={showFilters ? "default" : "outline"}
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setShowFilters(!showFilters)}
          >
            <Filter className="w-3.5 h-3.5" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5"
            onClick={() => setSortBy(sortBy === "date" ? "priority" : sortBy === "priority" ? "mood" : "date")}
          >
            <ArrowUpDown className="w-3.5 h-3.5" />
            <span className="text-[10px] hidden sm:inline">
              {sortBy === "date" ? (language === "fr" ? "Date" : "Date") : sortBy === "priority" ? (language === "fr" ? "Priorité" : "Priority") : (language === "fr" ? "Humeur" : "Mood")}
            </span>
          </Button>
        </div>

        {showFilters && (
          <Card className="p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {language === "fr" ? "Biais :" : "Bias:"}
              </span>
              {BIASES.map((b) => (
                <button
                  key={b.id}
                  onClick={() => setFilterBias(filterBias === b.id ? null : b.id)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                    b.color,
                    filterBias === b.id ? "ring-2 ring-offset-1 ring-primary" : "opacity-60"
                  )}
                >
                  {language === "fr" ? b.label_fr : b.label_en}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {language === "fr" ? "Priorité :" : "Priority:"}
              </span>
              {PRIORITIES.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setFilterPriority(filterPriority === p.id ? null : p.id)}
                  className={cn(
                    "px-2 py-0.5 rounded text-[10px] font-medium border transition-colors",
                    p.color,
                    filterPriority === p.id ? "ring-2 ring-offset-1 ring-primary" : "opacity-60"
                  )}
                >
                  {language === "fr" ? p.label_fr : p.label_en}
                </button>
              ))}
            </div>
          </Card>
        )}
      </div>

      {/* ─── Notes List ─────────────────────────────── */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-24 w-full" /></Card>
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <Card className="p-12 text-center">
          <StickyNote className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">
            {searchQuery
              ? (language === "fr" ? "Aucun résultat" : "No results")
              : t(language, "noData")}
          </p>
          <Button onClick={() => setShowTemplatePicker(true)} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            {language === "fr" ? "Créer une note" : "Create a note"}
          </Button>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(groupedNotes).map(([groupLabel, groupNotes]) => (
            <div key={groupLabel}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{groupLabel}</span>
                <Separator className="flex-1" />
                <Badge variant="secondary" className="text-[9px]">{groupNotes.length}</Badge>
              </div>
              <div className="space-y-2">
                {groupNotes.map((note: any) => (
                  <NoteCard
                    key={note.id}
                    note={note}
                    language={language}
                    onView={() => setViewingNote(note)}
                    onEdit={() => handleEdit(note)}
                    onDelete={() => handleDelete(note.id)}
                    onTogglePin={() => handleTogglePin(note)}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ─── View Note Dialog ───────────────────────── */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => { if (!open) setViewingNote(null); }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          {viewingNote && <NoteViewer note={viewingNote} language={language} onClose={() => setViewingNote(null)} onEdit={() => { const n = viewingNote; setViewingNote(null); handleEdit(n); }} />}
        </DialogContent>
      </Dialog>

      {/* ─── Add/Edit Note Dialog ────────────────────── */}
      <NoteDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        note={editingNote}
        type={activeType}
        language={language}
        onSaved={() => { refetch(); refetchAlerts(); fetchPerf(); }}
      />

      {/* ─── Template Picker ─────────────────────────── */}
      <Dialog open={showTemplatePicker} onOpenChange={setShowTemplatePicker}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {language === "fr" ? "Créer une Note" : "Create a Note"}
            </DialogTitle>
            <DialogDescription>
              {language === "fr" ? "Choisissez un modèle ou commencez à vide" : "Choose a template or start blank"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {TEMPLATES.map((tmpl) => {
              const Icon = tmpl.icon;
              return (
                <button
                  key={tmpl.id}
                  onClick={() => handleAdd(tmpl)}
                  className="w-full p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-left flex items-center gap-3"
                >
                  <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{language === "fr" ? tmpl.label_fr : tmpl.label_en}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {language === "fr" ? "Modèle prédéfini" : "Pre-built template"} • {NOTE_TYPES.find(nt => nt.id === tmpl.type)?.[language === "fr" ? "label_fr" : "label_en"]}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0">{tmpl.checklist.length} ✓</Badge>
                </button>
              );
            })}
            <Separator />
            <button
              onClick={() => handleAdd(null)}
              className="w-full p-3 rounded-lg border border-dashed border-border hover:border-primary/30 hover:bg-primary/5 transition-colors text-center"
            >
              <Plus className="w-4 h-4 mx-auto mb-1 text-muted-foreground" />
              <p className="text-xs text-muted-foreground">{language === "fr" ? "Note vide" : "Blank note"}</p>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Note Card ──────────────────────────────────────────
function NoteCard({
  note, language, onView, onEdit, onDelete, onTogglePin,
}: {
  note: any;
  language: "fr" | "en";
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
}) {
  const tags = parseJSON<string[]>(note.tags, []);
  const checklist = parseJSON<{ text: string; checked: boolean }[]>(note.checklist, []);
  const checkedCount = checklist.filter(c => c.checked).length;
  const priorityDef = PRIORITIES.find(p => p.id === note.priority);
  const biasDef = BIASES.find(b => b.id === note.marketBias);

  return (
    <Card
      className={cn(
        "p-3 hover:border-primary/30 transition-all cursor-pointer group",
        note.pinned && "border-amber-500/30 bg-amber-500/5",
        note.priority === "URGENT" && "border-red-500/30"
      )}
      onClick={onView}
    >
      <div className="flex items-start gap-3">
        {/* Mood indicator */}
        <div className="shrink-0 text-xl w-9 h-9 flex items-center justify-center rounded-lg bg-muted/50">
          {note.mood || "📝"}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap mb-1">
            {note.pinned && <Pin className="w-3 h-3 text-amber-500 shrink-0" />}
            <h4 className="text-sm font-semibold truncate">{note.title}</h4>
            {biasDef && (
              <Badge variant="outline" className={cn("text-[9px] gap-0.5 px-1.5 py-0", biasDef.color)}>
                {React.createElement(biasDef.icon, { className: "w-2.5 h-2.5" })}
              </Badge>
            )}
            {priorityDef && (
              <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0", priorityDef.color)}>
                {language === "fr" ? priorityDef.label_fr : priorityDef.label_en}
              </Badge>
            )}
          </div>

          {/* Preview text */}
          <p className="text-xs text-muted-foreground line-clamp-2 mb-1.5 whitespace-pre-wrap">
            {note.content || note.plan || note.observation || ""}
          </p>

          {/* Meta row */}
          <div className="flex items-center gap-2 flex-wrap">
            <Badge variant="outline" className="text-[9px]">
              {new Date(note.date).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { month: "short", day: "numeric" })}
            </Badge>
            {note.confidence != null && (
              <Badge variant="secondary" className="text-[9px] gap-0.5">
                <Target className="w-2.5 h-2.5" />
                {note.confidence}/10
              </Badge>
            )}
            {checklist.length > 0 && (
              <Badge variant="secondary" className="text-[9px] gap-0.5">
                <CheckSquare className="w-2.5 h-2.5" />
                {checkedCount}/{checklist.length}
              </Badge>
            )}
            {note.screenshots?.length > 0 && (
              <Badge variant="secondary" className="text-[9px] gap-0.5">
                <Camera className="w-2.5 h-2.5" />
                {note.screenshots.length}
              </Badge>
            )}
            {note.alerts?.filter((a: any) => !a.triggered).length > 0 && (
              <Badge variant="secondary" className="text-[9px] gap-0.5">
                <Bell className="w-2.5 h-2.5" />
                {note.alerts.filter((a: any) => !a.triggered).length}
              </Badge>
            )}
            {tags.slice(0, 3).map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[9px] px-1.5 py-0 text-primary border-primary/20">
                {tag}
              </Badge>
            ))}
            {tags.length > 3 && (
              <span className="text-[9px] text-muted-foreground">+{tags.length - 3}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onTogglePin(); }}>
            {note.pinned ? <PinOff className="w-3 h-3 text-amber-500" /> : <Pin className="w-3 h-3" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <Edit3 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-loss" onClick={(e) => { e.stopPropagation(); onDelete(); }}>
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}

// ─── Note Viewer ────────────────────────────────────────
function NoteViewer({
  note, language, onClose, onEdit,
}: {
  note: any;
  language: "fr" | "en";
  onClose: () => void;
  onEdit: () => void;
}) {
  const tags = parseJSON<string[]>(note.tags, []);
  const checklist = parseJSON<{ text: string; checked: boolean }[]>(note.checklist, []);
  const biasDef = BIASES.find(b => b.id === note.marketBias);
  const priorityDef = PRIORITIES.find(p => p.id === note.priority);
  const moodDef = MOODS.find(m => m.emoji === note.mood);

  const [checklistState, setChecklistState] = useState(checklist);
  const [savingChecklist, setSavingChecklist] = useState(false);

  const handleToggleCheck = async (index: number) => {
    const updated = [...checklistState];
    updated[index] = { ...updated[index], checked: !updated[index].checked };
    setChecklistState(updated);
    setSavingChecklist(true);
    try {
      await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ checklist: updated }),
      });
    } catch {
      // Revert on error
      setChecklistState(checklist);
    }
    setSavingChecklist(false);
  };

  const checkedCount = checklistState.filter(c => c.checked).length;
  const progress = checklistState.length > 0 ? (checkedCount / checklistState.length) * 100 : 0;

  return (
    <>
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2 flex-wrap">
          {note.pinned && <Pin className="w-4 h-4 text-amber-500" />}
          <span className="text-xl">{note.mood || "📝"}</span>
          {note.title}
          {biasDef && (
            <Badge variant="outline" className={cn("text-[10px] gap-1", biasDef.color)}>
              {React.createElement(biasDef.icon, { className: "w-3 h-3" })}
              {language === "fr" ? biasDef.label_fr : biasDef.label_en}
            </Badge>
          )}
          {priorityDef && (
            <Badge variant="outline" className={cn("text-[10px]", priorityDef.color)}>
              {language === "fr" ? priorityDef.label_fr : priorityDef.label_en}
            </Badge>
          )}
        </DialogTitle>
        <DialogDescription className="flex items-center gap-3 flex-wrap">
          {new Date(note.date).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          {note.confidence != null && (
            <Badge variant="secondary" className="text-[10px] gap-1">
              <Target className="w-3 h-3" />
              {language === "fr" ? "Confiance" : "Confidence"}: {note.confidence}/10
            </Badge>
          )}
          {moodDef && (
            <Badge variant="secondary" className="text-[10px]">
              {language === "fr" ? moodDef.label_fr : moodDef.label_en}
            </Badge>
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 mt-2">
        {/* Tags */}
        {tags.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Tag className="w-3 h-3 text-muted-foreground" />
            {tags.map((tag: string) => (
              <Badge key={tag} variant="outline" className="text-[10px] px-2 py-0.5 text-primary border-primary/20">
                {tag}
              </Badge>
            ))}
          </div>
        )}

        {/* Checklist */}
        {checklistState.length > 0 && (
          <Card className="p-3 border-emerald-500/20 bg-emerald-500/5">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <ClipboardList className="w-4 h-4 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                  {language === "fr" ? "Checklist" : "Checklist"}
                </span>
                {savingChecklist && <Loader2 className="w-3 h-3 animate-spin text-emerald-500" />}
              </div>
              <span className="text-[10px] text-muted-foreground">{checkedCount}/{checklistState.length}</span>
            </div>
            <Progress value={progress} className="h-1.5 mb-2" />
            <div className="space-y-1">
              {checklistState.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleToggleCheck(idx)}
                  className="w-full flex items-center gap-2 p-1.5 rounded hover:bg-emerald-500/10 transition-colors text-left"
                >
                  {item.checked
                    ? <CheckSquare className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    : <Square className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  }
                  <span className={cn("text-xs", item.checked && "line-through text-muted-foreground")}>
                    {item.text}
                  </span>
                </button>
              ))}
            </div>
          </Card>
        )}

        {/* Plan */}
        {note.plan && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Lightbulb className="w-3.5 h-3.5 text-amber-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                {language === "fr" ? "Plan" : "Plan"}
              </span>
            </div>
            <Card className="p-3 bg-amber-500/5 border-amber-500/10">
              <p className="text-xs whitespace-pre-wrap break-words">{note.plan}</p>
            </Card>
          </div>
        )}

        {/* Observations */}
        {note.observation && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Eye className="w-3.5 h-3.5 text-blue-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">
                {language === "fr" ? "Observations" : "Observations"}
              </span>
            </div>
            <Card className="p-3 bg-blue-500/5 border-blue-500/10">
              <p className="text-xs whitespace-pre-wrap break-words">{note.observation}</p>
            </Card>
          </div>
        )}

        {/* Rules */}
        {note.rules && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Shield className="w-3.5 h-3.5 text-purple-500" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-purple-600 dark:text-purple-400">
                {language === "fr" ? "Règles" : "Rules"}
              </span>
            </div>
            <Card className="p-3 bg-purple-500/5 border-purple-500/10">
              <p className="text-xs whitespace-pre-wrap break-words">{note.rules}</p>
            </Card>
          </div>
        )}

        {/* Main Content */}
        {note.content && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {language === "fr" ? "Notes" : "Notes"}
              </span>
            </div>
            <p className="text-sm whitespace-pre-wrap break-words bg-muted/30 rounded-lg p-3">{note.content}</p>
          </div>
        )}

        {/* Alerts */}
        {note.alerts?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Bell className="w-3.5 h-3.5 text-primary" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-primary">
                {language === "fr" ? "Alertes" : "Alerts"}
              </span>
            </div>
            <div className="space-y-1.5">
              {note.alerts.map((alert: any) => (
                <div key={alert.id} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                  <Bell className={cn("w-3.5 h-3.5 shrink-0", alert.triggered ? "text-muted-foreground" : "text-primary")} />
                  <div className="flex-1 min-w-0">
                    <p className={cn("text-xs font-medium truncate", alert.triggered && "line-through text-muted-foreground")}>{alert.title}</p>
                    {alert.description && <p className="text-[10px] text-muted-foreground line-clamp-1">{alert.description}</p>}
                  </div>
                  <Badge variant="outline" className="text-[9px] shrink-0">
                    {new Date(alert.alertDate).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
                      month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                    })}
                  </Badge>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Screenshots */}
        {note.screenshots?.length > 0 && (
          <div>
            <div className="flex items-center gap-1.5 mb-1">
              <Camera className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {language === "fr" ? "Captures d'écran" : "Screenshots"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2">
              {note.screenshots.map((ss: any) => {
                const src = ss.url.startsWith('http') ? ss.url : `/api/screenshots/${ss.url.replace('upload/screenshots/', '')}`;
                return (
                  <button
                    key={ss.id}
                    className="group relative aspect-video rounded-lg overflow-hidden border border-border hover:border-primary/30 transition-colors"
                    onClick={(e) => { e.stopPropagation(); window.open(src, '_blank'); }}
                  >
                    <img src={src} alt="Screenshot" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200" />
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center">
                      <Eye className="w-5 h-5 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <DialogFooter className="mt-4">
        <Button variant="outline" onClick={onClose}>{language === "fr" ? "Fermer" : "Close"}</Button>
        <Button onClick={onEdit}>{language === "fr" ? "Modifier" : "Edit"}</Button>
      </DialogFooter>
    </>
  );
}

// ─── Performance Panel ──────────────────────────────────
function PerformancePanel({
  language, performanceData, loading, fetchPerf,
}: {
  language: "fr" | "en";
  performanceData: any;
  loading: boolean;
  fetchPerf: (from?: string, to?: string) => void;
}) {
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const handleFetch = () => {
    fetchPerf(dateFrom || undefined, dateTo || undefined);
  };

  const summary = performanceData?.summary;
  const moodStats = performanceData?.moodStats || {};

  return (
    <Card className="p-4 border-primary/20 bg-gradient-to-br from-primary/5 to-emerald-500/5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold">{language === "fr" ? "Performance & Corrélations" : "Performance & Correlations"}</h3>
        </div>
        <div className="flex items-center gap-2">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-7 text-[10px] w-32" />
          <span className="text-[10px] text-muted-foreground">→</span>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-7 text-[10px] w-32" />
          <Button size="sm" className="h-7 text-[10px] gap-1" onClick={handleFetch} disabled={loading}>
            {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Activity className="w-3 h-3" />}
            {language === "fr" ? "Analyser" : "Analyze"}
          </Button>
        </div>
      </div>

      {loading && !performanceData ? (
        <div className="grid grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : summary ? (
        <div className="space-y-3">
          {/* Summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
            {[
              { label: language === "fr" ? "Trades" : "Trades", value: summary.totalTrades, icon: Activity, color: "text-primary" },
              { label: "Win Rate", value: `${summary.winRate}%`, icon: Target, color: summary.winRate >= 50 ? "text-emerald-500" : "text-red-500" },
              { label: "W/L/B", value: `${summary.wins}/${summary.losses}/${summary.bes}`, icon: BarChart3, color: "text-blue-500" },
              { label: "P&L", value: `$${summary.totalPnL}`, icon: summary.totalPnL >= 0 ? TrendingUp : TrendingDown, color: summary.totalPnL >= 0 ? "text-emerald-500" : "text-red-500" },
              { label: "Total RR", value: summary.totalRR.toFixed(1), icon: Zap, color: "text-amber-500" },
              { label: "Avg RR", value: summary.avgRR.toFixed(2), icon: Star, color: "text-purple-500" },
              { label: language === "fr" ? "Meilleur Humeur" : "Best Mood", value: (() => {
                let best = "";
                let bestWR = -1;
                for (const [mood, stat] of Object.entries(moodStats) as any[]) {
                  const wr = stat.count > 0 ? (stat.wins / stat.count) * 100 : 0;
                  if (wr > bestWR && stat.count >= 1) { bestWR = wr; best = mood; }
                }
                return best || "—";
              })(), icon: Heart, color: "text-rose-500" },
            ].map((stat) => {
              const Icon = stat.icon;
              return (
                <Card key={stat.label} className="p-2.5 text-center">
                  <Icon className={cn("w-3.5 h-3.5 mx-auto mb-1", stat.color)} />
                  <p className="text-sm font-bold">{stat.value}</p>
                  <p className="text-[9px] text-muted-foreground">{stat.label}</p>
                </Card>
              );
            })}
          </div>

          {/* Mood vs Performance */}
          {Object.keys(moodStats).length > 0 && (
            <Card className="p-3">
              <h4 className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground mb-2">
                {language === "fr" ? "Humeur vs Performance" : "Mood vs Performance"}
              </h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(moodStats).map(([mood, stat]: [string, any]) => {
                  const wr = stat.count > 0 ? (stat.wins / stat.count) * 100 : 0;
                  return (
                    <div key={mood} className="p-2 rounded-lg border border-border bg-muted/30 text-center">
                      <span className="text-xl">{mood}</span>
                      <p className="text-xs font-bold mt-1">{wr.toFixed(0)}% WR</p>
                      <p className="text-[9px] text-muted-foreground">{stat.count} {language === "fr" ? "trades" : "trades"}</p>
                      <p className={cn("text-[10px] font-mono font-bold", stat.totalPnL >= 0 ? "text-emerald-500" : "text-red-500")}>
                        ${stat.totalPnL.toFixed(0)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground text-center py-4">
          {language === "fr" ? "Cliquez sur Analyser pour voir vos performances" : "Click Analyze to see your performance"}
        </p>
      )}
    </Card>
  );
}

// ─── Note Dialog (Create/Edit) ──────────────────────────
function NoteDialog({
  open,
  onOpenChange,
  note,
  type,
  language,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  note: any | null;
  type: string;
  language: "fr" | "en";
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [noteType, setNoteType] = useState(type);
  const [mood, setMood] = useState("");
  const [confidence, setConfidence] = useState(5);
  const [marketBias, setMarketBias] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [checklist, setChecklist] = useState<{ text: string; checked: boolean }[]>([]);
  const [newCheckItem, setNewCheckItem] = useState("");
  const [priority, setPriority] = useState("");
  const [pinned, setPinned] = useState(false);
  const [plan, setPlan] = useState("");
  const [observation, setObservation] = useState("");
  const [rules, setRules] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeEditorTab, setActiveEditorTab] = useState<"main" | "plan" | "obs" | "rules" | "checklist">("main");

  // Screenshot state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingScreenshots, setExistingScreenshots] = useState<any[]>([]);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Alert state
  const [enableAlert, setEnableAlert] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertDescription, setAlertDescription] = useState("");
  const [alertDate, setAlertDate] = useState("");
  const [alertTime, setAlertTime] = useState("");
  const [existingAlerts, setExistingAlerts] = useState<any[]>([]);

  // isTemplate check — a template is a note-like object without a real DB id but with a checklist
  const isTemplate = note && !note.id && note.checklist;

  React.useEffect(() => {
    if (open) {
      // Check if it's a template
      if (note && !note.id && note.checklist) {
        // Template
        setTitle(language === "fr" ? (note.label_fr || "") : (note.label_en || ""));
        setContent(note.content || "");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setNoteType(note.type || type);
        setMood("");
        setConfidence(5);
        setMarketBias("");
        setTags([]);
        setChecklist(note.checklist ? [...note.checklist] : []);
        setPriority("");
        setPinned(false);
        setPlan(note.plan || "");
        setObservation(note.observation || "");
        setRules(note.rules || "");
        setExistingScreenshots([]);
        setSelectedFiles([]);
        setPreviewUrls([]);
        setEnableAlert(false);
        setAlertTitle("");
        setAlertDescription("");
        setAlertDate(format(new Date(), "yyyy-MM-dd"));
        setAlertTime(format(new Date(), "HH:mm"));
        setExistingAlerts([]);
        setActiveEditorTab(note.plan ? "plan" : "main");
      } else if (note && note.id) {
        // Editing existing note
        setTitle(note.title || "");
        setContent(note.content || "");
        setDate(note.date ? format(new Date(note.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
        setNoteType(note.type || type);
        setMood(note.mood || "");
        setConfidence(note.confidence ?? 5);
        setMarketBias(note.marketBias || "");
        setTags(parseJSON<string[]>(note.tags, []));
        setChecklist(parseJSON<{ text: string; checked: boolean }[]>(note.checklist, []));
        setPriority(note.priority || "");
        setPinned(note.pinned || false);
        setPlan(note.plan || "");
        setObservation(note.observation || "");
        setRules(note.rules || "");
        setExistingScreenshots(note.screenshots || []);
        setSelectedFiles([]);
        setPreviewUrls([]);
        if (note.alerts?.length > 0) {
          setExistingAlerts(note.alerts);
          const firstAlert = note.alerts[0];
          setEnableAlert(true);
          setAlertTitle(firstAlert.title || "");
          setAlertDescription(firstAlert.description || "");
          const d = new Date(firstAlert.alertDate);
          setAlertDate(format(d, "yyyy-MM-dd"));
          setAlertTime(format(d, "HH:mm"));
        } else {
          setExistingAlerts([]);
          setEnableAlert(false);
          setAlertTitle("");
          setAlertDescription("");
          setAlertDate(format(new Date(), "yyyy-MM-dd"));
          setAlertTime(format(new Date(), "HH:mm"));
        }
        setActiveEditorTab(note.plan ? "plan" : "main");
      } else {
        // New blank note
        setTitle("");
        setContent("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setNoteType(type);
        setMood("");
        setConfidence(5);
        setMarketBias("");
        setTags([]);
        setChecklist([]);
        setPriority("");
        setPinned(false);
        setPlan("");
        setObservation("");
        setRules("");
        setExistingScreenshots([]);
        setSelectedFiles([]);
        setPreviewUrls([]);
        setEnableAlert(false);
        setAlertTitle("");
        setAlertDescription("");
        setAlertDate(format(new Date(), "yyyy-MM-dd"));
        setAlertTime(format(new Date(), "HH:mm"));
        setExistingAlerts([]);
        setActiveEditorTab("main");
      }
    }
  }, [open, note, type, language]);

  useEffect(() => {
    if (open && enableAlert && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [open, enableAlert]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;
    const newFiles = Array.from(files);
    const newUrls = newFiles.map(f => URL.createObjectURL(f));
    setSelectedFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newUrls]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemovePendingFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  const handleRemoveExistingScreenshot = async (screenshotId: string) => {
    try {
      await fetch(`/api/notes/screenshots?screenshotId=${screenshotId}`, { method: "DELETE" });
      setExistingScreenshots(prev => prev.filter((s) => s.id !== screenshotId));
      toast.success(language === "fr" ? "Capture supprimée" : "Screenshot removed");
    } catch {
      toast.error("Error");
    }
  };

  const handleAddTag = (tag: string) => {
    const trimmed = tag.trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
    }
    setTagInput("");
  };

  const handleRemoveTag = (tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  };

  const handleAddCheckItem = () => {
    if (newCheckItem.trim()) {
      setChecklist(prev => [...prev, { text: newCheckItem.trim(), checked: false }]);
      setNewCheckItem("");
    }
  };

  const handleToggleCheckItem = (idx: number) => {
    setChecklist(prev => prev.map((item, i) => i === idx ? { ...item, checked: !item.checked } : item));
  };

  const handleRemoveCheckItem = (idx: number) => {
    setChecklist(prev => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async () => {
    if (!title) {
      toast.error(language === "fr" ? "Le titre est requis" : "Title is required");
      return;
    }

    if (enableAlert && (!alertTitle || !alertDate || !alertTime)) {
      toast.error(language === "fr" ? "Titre et date/heure de l'alerte requis" : "Alert title and date/time required");
      return;
    }

    if (enableAlert && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    setIsSubmitting(true);
    try {
      const body = {
        title,
        content,
        date,
        type: noteType,
        mood: mood || null,
        confidence,
        marketBias: marketBias || null,
        tags: tags.length > 0 ? JSON.stringify(tags) : null,
        checklist: checklist.length > 0 ? JSON.stringify(checklist) : null,
        priority: priority || null,
        pinned,
        plan: plan || null,
        observation: observation || null,
        rules: rules || null,
      };

      let savedNoteId: string;

      if (note?.id) {
        const res = await fetch(`/api/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          toast.error("Error");
          setIsSubmitting(false);
          return;
        }
        savedNoteId = note.id;
      } else {
        const res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          toast.error("Error");
          setIsSubmitting(false);
          return;
        }
        const data = await res.json();
        savedNoteId = data.note.id;
      }

      // Upload screenshots
      if (selectedFiles.length > 0) {
        setUploadingScreenshot(true);
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append("noteId", savedNoteId);
          formData.append("file", file);
          try {
            await fetch("/api/notes/screenshots", { method: "POST", body: formData });
          } catch {
            // Continue
          }
        }
        setUploadingScreenshot(false);
      }

      // Alert
      if (enableAlert && alertTitle && alertDate && alertTime) {
        const alertBody = {
          title: alertTitle,
          description: alertDescription || null,
          alertDate: `${alertDate}T${alertTime}:00`,
          noteId: savedNoteId,
        };
        const existingAlert = existingAlerts[0];
        if (existingAlert) {
          await fetch(`/api/alerts/${existingAlert.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alertBody),
          });
        } else {
          await fetch("/api/alerts", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alertBody),
          });
        }
      } else if (!enableAlert && existingAlerts.length > 0) {
        for (const a of existingAlerts) {
          await fetch(`/api/alerts/${a.id}`, { method: "DELETE" });
        }
      }

      toast.success(note?.id ? (language === "fr" ? "Note modifiée" : "Note updated") : (language === "fr" ? "Note ajoutée" : "Note added"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Error");
    }
    setIsSubmitting(false);
  };

  // Cleanup preview URLs
  useEffect(() => {
    return () => { previewUrls.forEach(url => URL.revokeObjectURL(url)); };
  }, []);

  const editorTabs = [
    { id: "main" as const, label: language === "fr" ? "Notes" : "Notes", icon: FileText },
    { id: "plan" as const, label: language === "fr" ? "Plan" : "Plan", icon: Lightbulb },
    { id: "obs" as const, label: language === "fr" ? "Observ." : "Observ.", icon: Eye },
    { id: "rules" as const, label: language === "fr" ? "Règles" : "Rules", icon: Shield },
    { id: "checklist" as const, label: "Checklist", icon: ClipboardList },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-primary" />
            {note?.id ? t(language, "editNote") : (language === "fr" ? "Nouvelle Note" : "New Note")}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" ? "Rédigez votre note de trading avancée" : "Write your advanced trading note"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type & Date Row */}
          <div className="grid grid-cols-4 gap-2">
            {NOTE_TYPES.map((nt) => {
              const Icon = nt.icon;
              return (
                <button
                  key={nt.id}
                  onClick={() => setNoteType(nt.id)}
                  className={cn(
                    "p-2 rounded-lg border text-xs font-medium transition-colors flex items-center gap-1.5 justify-center",
                    noteType === nt.id ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/30"
                  )}
                >
                  <Icon className={cn("w-3.5 h-3.5", nt.color)} />
                  {language === "fr" ? nt.label_fr : nt.label_en}
                </button>
              );
            })}
            <div className="col-span-1">
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-full text-xs" />
            </div>
          </div>

          {/* Title */}
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={language === "fr" ? "Titre de la note" : "Note title"} className="text-sm font-semibold" />

          {/* ─── Mood & Confidence Row ───────────────── */}
          <Card className="p-3">
            <div className="flex items-center justify-between mb-2">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
                <Heart className="w-3 h-3" />
                {language === "fr" ? "Humeur & Confiance" : "Mood & Confidence"}
              </Label>
              <div className="flex items-center gap-2">
                <Pin className={cn("w-3 h-3 cursor-pointer", pinned ? "text-amber-500" : "text-muted-foreground")} onClick={() => setPinned(!pinned)} />
                <span className="text-[9px] text-muted-foreground">{pinned ? (language === "fr" ? "Épinglée" : "Pinned") : (language === "fr" ? "Épingler" : "Pin")}</span>
              </div>
            </div>
            {/* Mood selector */}
            <div className="flex gap-1.5 flex-wrap mb-2">
              {MOODS.map((m) => (
                <button
                  key={m.emoji}
                  onClick={() => setMood(mood === m.emoji ? "" : m.emoji)}
                  className={cn(
                    "w-8 h-8 rounded-lg border text-lg flex items-center justify-center transition-all",
                    mood === m.emoji ? m.color + " ring-2 ring-offset-1 ring-primary scale-110" : "border-border hover:border-primary/30"
                  )}
                  title={language === "fr" ? m.label_fr : m.label_en}
                >
                  {m.emoji}
                </button>
              ))}
            </div>
            {/* Confidence slider */}
            <div className="flex items-center gap-3">
              <span className="text-[10px] text-muted-foreground w-12">{language === "fr" ? "Confiance" : "Confidence"}</span>
              <Slider
                value={[confidence]}
                onValueChange={(v) => setConfidence(v[0])}
                min={1}
                max={10}
                step={1}
                className="flex-1"
              />
              <span className={cn(
                "text-sm font-bold font-mono w-6 text-right",
                confidence >= 7 ? "text-emerald-500" : confidence >= 4 ? "text-amber-500" : "text-red-500"
              )}>
                {confidence}
              </span>
            </div>
          </Card>

          {/* ─── Market Bias & Priority ───────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {language === "fr" ? "Biais de marché" : "Market Bias"}
              </Label>
              <div className="flex gap-1.5">
                {BIASES.map((b) => {
                  const Icon = b.icon;
                  return (
                    <button
                      key={b.id}
                      onClick={() => setMarketBias(marketBias === b.id ? "" : b.id)}
                      className={cn(
                        "flex-1 p-1.5 rounded-lg border text-[10px] font-medium transition-colors flex items-center justify-center gap-1",
                        b.color,
                        marketBias === b.id ? "ring-2 ring-offset-1 ring-primary" : "opacity-50"
                      )}
                    >
                      <Icon className="w-3 h-3" />
                      {language === "fr" ? b.label_fr : b.label_en}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                {language === "fr" ? "Priorité" : "Priority"}
              </Label>
              <div className="grid grid-cols-2 gap-1.5">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setPriority(priority === p.id ? "" : p.id)}
                    className={cn(
                      "p-1.5 rounded-lg border text-[10px] font-medium transition-colors",
                      p.color,
                      priority === p.id ? "ring-2 ring-offset-1 ring-primary" : "opacity-50"
                    )}
                  >
                    {language === "fr" ? p.label_fr : p.label_en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ─── Tags ──────────────────────────────── */}
          <div className="space-y-1.5">
            <Label className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1">
              <Tag className="w-3 h-3" />
              {language === "fr" ? "Tags" : "Tags"}
            </Label>
            <div className="flex items-center gap-1.5 flex-wrap mb-1">
              {tags.map((tag) => (
                <Badge key={tag} variant="outline" className="text-[10px] gap-1 text-primary border-primary/20 px-2 py-0.5">
                  {tag}
                  <button onClick={() => handleRemoveTag(tag)}><X className="w-2.5 h-2.5" /></button>
                </Badge>
              ))}
            </div>
            <div className="flex gap-1.5">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddTag(tagInput); } }}
                placeholder={language === "fr" ? "Ajouter un tag..." : "Add tag..."}
                className="h-7 text-xs flex-1"
              />
              <Button variant="outline" size="sm" className="h-7 text-[10px]" onClick={() => handleAddTag(tagInput)}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {TAG_PRESETS.filter(p => !tags.includes(p)).slice(0, 10).map((preset) => (
                <button
                  key={preset}
                  onClick={() => handleAddTag(preset)}
                  className="px-1.5 py-0.5 rounded text-[9px] text-muted-foreground border border-border hover:border-primary/30 hover:text-primary transition-colors"
                >
                  + {preset}
                </button>
              ))}
            </div>
          </div>

          {/* ─── Editor Tabs ────────────────────────── */}
          <div className="border rounded-lg overflow-hidden">
            <div className="flex border-b bg-muted/30">
              {editorTabs.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveEditorTab(tab.id)}
                    className={cn(
                      "flex-1 px-2 py-1.5 text-[10px] font-medium flex items-center justify-center gap-1 transition-colors",
                      activeEditorTab === tab.id
                        ? "bg-background text-primary border-b-2 border-primary"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="w-3 h-3" />
                    <span className="hidden sm:inline">{tab.label}</span>
                  </button>
                );
              })}
            </div>
            <div className="p-3">
              {activeEditorTab === "main" && (
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={language === "fr" ? "Écrivez vos notes ici..." : "Write your notes here..."}
                  rows={6}
                  className="resize-y !field-sizing-fixed overflow-y-auto break-words text-sm"
                />
              )}
              {activeEditorTab === "plan" && (
                <Textarea
                  value={plan}
                  onChange={(e) => setPlan(e.target.value)}
                  placeholder={language === "fr"
                    ? "• Marché attendu :\n• Niveaux clés :\n• Biais principal :\n• Setups surveillés :"
                    : "• Expected market:\n• Key levels:\n• Main bias:\n• Setups to watch:"}
                  rows={6}
                  className="resize-y !field-sizing-fixed overflow-y-auto break-words text-sm border-amber-500/20 focus:border-amber-500/40"
                />
              )}
              {activeEditorTab === "obs" && (
                <Textarea
                  value={observation}
                  onChange={(e) => setObservation(e.target.value)}
                  placeholder={language === "fr"
                    ? "• Structure du marché :\n• Zones de liquidité :\n• Corrélations :"
                    : "• Market structure:\n• Liquidity zones:\n• Correlations:"}
                  rows={6}
                  className="resize-y !field-sizing-fixed overflow-y-auto break-words text-sm border-blue-500/20 focus:border-blue-500/40"
                />
              )}
              {activeEditorTab === "rules" && (
                <Textarea
                  value={rules}
                  onChange={(e) => setRules(e.target.value)}
                  placeholder={language === "fr"
                    ? "• Règle #1 :\n• Règle #2 :\n• Règle #3 :"
                    : "• Rule #1 :\n• Rule #2 :\n• Rule #3 :"}
                  rows={6}
                  className="resize-y !field-sizing-fixed overflow-y-auto break-words text-sm border-purple-500/20 focus:border-purple-500/40"
                />
              )}
              {activeEditorTab === "checklist" && (
                <div className="space-y-2">
                  {checklist.map((item, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <button onClick={() => handleToggleCheckItem(idx)}>
                        {item.checked
                          ? <CheckSquare className="w-4 h-4 text-emerald-500 shrink-0" />
                          : <Square className="w-4 h-4 text-muted-foreground shrink-0" />
                        }
                      </button>
                      <span className={cn("text-sm flex-1", item.checked && "line-through text-muted-foreground")}>
                        {item.text}
                      </span>
                      <Button variant="ghost" size="icon" className="h-6 w-6 text-loss shrink-0" onClick={() => handleRemoveCheckItem(idx)}>
                        <X className="w-3 h-3" />
                      </Button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newCheckItem}
                      onChange={(e) => setNewCheckItem(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleAddCheckItem(); } }}
                      placeholder={language === "fr" ? "Ajouter un élément..." : "Add item..."}
                      className="h-8 text-xs flex-1"
                    />
                    <Button variant="outline" size="sm" className="h-8 gap-1 text-xs" onClick={handleAddCheckItem}>
                      <Plus className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ─── Screenshots ─────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Camera className="w-3.5 h-3.5" />
                {language === "fr" ? "Captures d'écran" : "Screenshots"}
              </Label>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs" onClick={() => fileInputRef.current?.click()} disabled={uploadingScreenshot}>
                {uploadingScreenshot ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                {language === "fr" ? "Ajouter" : "Add"}
              </Button>
              <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
            </div>
            {existingScreenshots.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {existingScreenshots.map((ss: any) => {
                  const src = ss.url.startsWith('http') ? ss.url : `/api/screenshots/${ss.url.replace('upload/screenshots/', '')}`;
                  return (
                    <div key={ss.id} className="group relative aspect-video rounded-lg overflow-hidden border border-border">
                      <img src={src} alt="Screenshot" className="w-full h-full object-cover" />
                      <button onClick={() => handleRemoveExistingScreenshot(ss.id)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {previewUrls.length > 0 && (
              <div className="grid grid-cols-4 gap-2">
                {previewUrls.map((url, index) => (
                  <div key={`pending-${index}`} className="group relative aspect-video rounded-lg overflow-hidden border border-primary/30 bg-primary/5">
                    <img src={url} alt="Preview" className="w-full h-full object-cover" />
                    <button onClick={() => handleRemovePendingFile(index)} className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Separator />

          {/* ─── Alert ────────────────────────────────── */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                {language === "fr" ? "Alerte" : "Alert"}
              </Label>
              <button
                onClick={() => setEnableAlert(!enableAlert)}
                className={cn("relative h-5 w-9 rounded-full transition-colors", enableAlert ? "bg-primary" : "bg-muted")}
              >
                <span className={cn("absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm", enableAlert ? "translate-x-4" : "translate-x-0.5")} />
              </button>
            </div>
            {enableAlert && (
              <div className="space-y-2 p-2.5 rounded-lg border border-primary/10 bg-primary/5">
                <Input value={alertTitle} onChange={(e) => setAlertTitle(e.target.value)} placeholder={language === "fr" ? "Titre de l'alerte" : "Alert title"} className="h-8 text-xs" />
                <Textarea value={alertDescription} onChange={(e) => setAlertDescription(e.target.value)} placeholder={language === "fr" ? "Détails..." : "Details..."} rows={2} className="resize-none text-xs" />
                <div className="grid grid-cols-2 gap-2">
                  <Input type="date" value={alertDate} onChange={(e) => setAlertDate(e.target.value)} className="h-8 text-xs" />
                  <Input type="time" value={alertTime} onChange={(e) => setAlertTime(e.target.value)} className="h-8 text-xs" />
                </div>
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t(language, "cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || uploadingScreenshot}>
            {isSubmitting || uploadingScreenshot ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {t(language, "save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
