"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useAppStore } from "@/stores/app-store";
import { useNotes } from "@/lib/hooks";
import { getFileUrl } from "@/lib/file-url";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
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
  Save,
  Loader2,
  ImagePlus,
  X,
  Eye,
  Search,
  Sun,
  CalendarDays,
  CalendarRange,
  Calendar as CalIcon,
  AlertTriangle,
  CheckCircle2,
  Pin,
  PinOff,
  ListChecks,
  Flag,
  TrendingUp,
  TrendingDown,
  Minus,
} from "lucide-react";
import { toast } from "sonner";
import { format, isToday, isYesterday, isThisWeek, isThisMonth, parseISO } from "date-fns";

// ─── Types ─────────────────────────────────────────────────
interface NoteScreenshot {
  id: string;
  url: string;
  createdAt: string;
}

interface Note {
  id: string;
  type: string; // DAY | WEEK | MONTH
  title: string;
  content: string;
  date: string;
  mood: string | null;
  confidence: number | null;
  marketBias: string | null;
  tags: string | null;
  checklist: string | null; // JSON [{text, checked}]
  priority: string | null; // LOW, MEDIUM, HIGH, URGENT
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  screenshots: NoteScreenshot[];
}

type NoteType = "DAY" | "WEEK" | "MONTH";

interface ChecklistItem {
  text: string;
  checked: boolean;
}

// ─── Error Boundary (safety net) ───────────────────────────
interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class NotesErrorBoundary extends Component<
  { language: "fr" | "en"; children: ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { language: "fr" | "en"; children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("NotesTab error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      const fr = this.props.language === "fr";
      return (
        <div className="flex flex-col items-center justify-center min-h-[60vh] p-6 text-center">
          <AlertTriangle className="w-12 h-12 text-amber-500 mb-4" />
          <h2 className="text-xl font-bold mb-2">
            {fr ? "Une erreur est survenue" : "An error occurred"}
          </h2>
          <p className="text-muted-foreground text-sm mb-4 max-w-md">
            {fr
              ? "Le chargement des notes a rencontré un problème. Vous pouvez réessayer."
              : "Loading notes encountered a problem. You can retry."}
          </p>
          {this.state.error && (
            <pre className="text-xs bg-muted p-3 rounded-lg max-w-md overflow-auto mb-4 text-left">
              {this.state.error.message}
            </pre>
          )}
          <div className="flex gap-3">
            <Button
              onClick={() => this.setState({ hasError: false, error: undefined })}
              className="bg-foreground text-background hover:bg-foreground/90"
            >
              {fr ? "Réessayer" : "Retry"}
            </Button>
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
            >
              {fr ? "Recharger la page" : "Reload page"}
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

// ─── Constants ─────────────────────────────────────────────
const NOTE_TYPES: { id: NoteType; label_fr: string; label_en: string; icon: typeof Sun }[] = [
  { id: "DAY", label_fr: "Journée", label_en: "Day", icon: Sun },
  { id: "WEEK", label_fr: "Semaine", label_en: "Week", icon: CalendarDays },
  { id: "MONTH", label_fr: "Mois", label_en: "Month", icon: CalendarRange },
];

const MOODS = ["😊", "😐", "😤", "🧠", "💪", "😴"];

const BIASES: { id: string; fr: string; en: string; icon: typeof TrendingUp }[] = [
  { id: "BULLISH", fr: "Haussier", en: "Bullish", icon: TrendingUp },
  { id: "BEARISH", fr: "Baissier", en: "Bearish", icon: TrendingDown },
  { id: "NEUTRAL", fr: "Neutre", en: "Neutral", icon: Minus },
];

const PRIORITIES: { id: string; fr: string; en: string; cls: string }[] = [
  { id: "LOW", fr: "Basse", en: "Low", cls: "bg-slate-500/15 text-slate-600 dark:text-slate-300 border-slate-500/30" },
  { id: "MEDIUM", fr: "Moyenne", en: "Medium", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-300 border-amber-500/30" },
  { id: "HIGH", fr: "Haute", en: "High", cls: "bg-orange-500/15 text-orange-600 dark:text-orange-300 border-orange-500/30" },
  { id: "URGENT", fr: "Urgente", en: "Urgent", cls: "bg-red-500/15 text-red-600 dark:text-red-300 border-red-500/30" },
];

/** Structured preparation templates — prefill content per note type */
const TEMPLATES: Record<NoteType, { fr: string; en: string; content: string }> = {
  DAY: {
    fr: "Préparation de session",
    en: "Session prep",
    content: `📋 BIAIS DU JOUR :\n🎯 PAIRES À TRADER :\n📏 NIVEAUX CLÉS :\n⏰ SESSIONS À TRADER :\n✅ CHECKLIST PRÉ-SESSION :\n- [ ] Mon setup du playbook est-il présent ?\n- [ ] Ai-je vérifié le calendrier économique ?\n- [ ] Mon risque par trade est-il défini ?\n⚠️ RISQUES À SURVEILLER :`,
  },
  WEEK: {
    fr: "Review hebdomadaire",
    en: "Weekly review",
    content: `✅ CE QUI A MARCHÉ :\n❌ CE QUI N'A PAS MARCHÉ :\n💡 LEÇONS DE LA SEMAINE :\n🎯 OBJECTIFS SEMAINE PROCHAINE :`,
  },
  MONTH: {
    fr: "Bilan mensuel",
    en: "Monthly review",
    content: `📊 BILAN DU MOIS (stats) :\n🏆 VICTOIRES :\n🧠 LEÇONS APPRISES :\n⚠️ ERREURS RÉCURRENTES :\n🎯 OBJECTIFS DU MOIS PROCHAIN :`,
  },
};

function parseChecklist(raw: string | null): ChecklistItem[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed
        .filter((i: any) => i && typeof i.text === "string")
        .map((i: any) => ({ text: i.text, checked: Boolean(i.checked) }));
    }
  } catch {
    /* ignore */
  }
  return [];
}

function getPriorityMeta(id: string | null) {
  return PRIORITIES.find((p) => p.id === id) || null;
}

function getBiasMeta(id: string | null) {
  return BIASES.find((b) => b.id === id) || null;
}

function getNoteTypeMeta(type: string) {
  return NOTE_TYPES.find((t) => t.id === type) || NOTE_TYPES[0];
}

// ─── Date grouping helper ──────────────────────────────────
function getNoteGroupLabel(dateStr: string, language: "fr" | "en"): string {
  try {
    const date = parseISO(dateStr);
    if (isNaN(date.getTime())) return language === "fr" ? "Autres" : "Other";
    if (isToday(date)) return language === "fr" ? "Aujourd'hui" : "Today";
    if (isYesterday(date)) return language === "fr" ? "Hier" : "Yesterday";
    if (isThisWeek(date, { weekStartsOn: 1 })) return language === "fr" ? "Cette semaine" : "This week";
    if (isThisMonth(date)) return language === "fr" ? "Ce mois" : "This month";
    return format(date, "MMMM yyyy", { locale: undefined });
  } catch {
    return language === "fr" ? "Autres" : "Other";
  }
}

// ─── Main Tab Component ────────────────────────────────────
export function NotesTab() {
  const { language } = useAppStore();
  return (
    <NotesErrorBoundary language={language}>
      <NotesTabInner language={language} />
    </NotesErrorBoundary>
  );
}

function NotesTabInner({ language }: { language: "fr" | "en" }) {
  const fr = language === "fr";
  const { notes, loading, refetch } = useNotes();
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<Note | null>(null);
  const [presetType, setPresetType] = useState<NoteType | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<NoteType | "ALL">("ALL");
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  // Filter + search + group
  const filteredNotes = (notes as Note[]).filter((n) => {
    if (filterType !== "ALL" && n.type !== filterType) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q);
    }
    return true;
  });

  // Group notes by date label (pinned notes first within each group)
  const groups: { label: string; items: Note[] }[] = [];
  const groupMap = new Map<string, Note[]>();
  filteredNotes.forEach((n) => {
    const label = getNoteGroupLabel(n.date, language);
    if (!groupMap.has(label)) groupMap.set(label, []);
    groupMap.get(label)!.push(n);
  });
  groupMap.forEach((items, label) => {
    items.sort((a, b) => (a.pinned === b.pinned ? 0 : a.pinned ? -1 : 1));
    groups.push({ label, items });
  });

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingNote(null);
    setPresetType(null);
    setShowForm(true);
  };

  const handleClose = () => {
    setShowForm(false);
    setEditingNote(null);
  };

  const handleSaved = () => {
    refetch();
    handleClose();
  };

  const handleDelete = async (note: Note) => {
    if (!confirm(fr ? "Supprimer cette note ?" : "Delete this note?")) return;
    try {
      const res = await fetch(`/api/notes/${note.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.success(fr ? "Note supprimée" : "Note deleted");
      refetch();
    } catch {
      toast.error(fr ? "Erreur lors de la suppression" : "Error deleting note");
    }
  };

  const handleTogglePin = async (note: Note) => {
    try {
      const res = await fetch(`/api/notes/${note.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pinned: !note.pinned }),
      });
      if (!res.ok) throw new Error("pin failed");
      toast.success(fr ? (note.pinned ? "Note désépinglée" : "Note épinglée") : note.pinned ? "Note unpinned" : "Note pinned");
      refetch();
    } catch {
      toast.error(fr ? "Erreur lors de l'épinglage" : "Error pinning note");
    }
  };

  // Quick stats
  const counts = useMemo(() => {
    const all = notes as Note[];
    return {
      DAY: all.filter((n) => n.type === "DAY").length,
      WEEK: all.filter((n) => n.type === "WEEK").length,
      MONTH: all.filter((n) => n.type === "MONTH").length,
      pinned: all.filter((n) => n.pinned).length,
    };
  }, [notes]);

  return (
    <div className="space-y-4 pb-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <StickyNote className="w-5 h-5" />
            {fr ? "Notes de Préparation" : "Preparation Notes"}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {fr
              ? "Prépare tes sessions, révise tes semaines, épingle tes stratégies clés"
              : "Prep your sessions, review your weeks, pin your key strategies"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {NOTE_TYPES.map((nt) => (
            <Button
              key={nt.id}
              variant="outline"
              size="sm"
              onClick={() => {
                setEditingNote(null);
                setPresetType(nt.id);
                setShowForm(true);
              }}
              className="gap-1.5 h-9"
            >
              <nt.icon className="w-3.5 h-3.5" />
              {fr ? nt.label_fr : nt.label_en}
            </Button>
          ))}
          <Button onClick={handleNew} className="gap-2">
            <Plus className="w-4 h-4" />
            {fr ? "Ajouter" : "Add"}
          </Button>
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: fr ? "Journée" : "Day", value: counts.DAY, icon: Sun },
          { label: fr ? "Semaine" : "Week", value: counts.WEEK, icon: CalendarDays },
          { label: fr ? "Mois" : "Month", value: counts.MONTH, icon: CalendarRange },
          { label: fr ? "Épinglées" : "Pinned", value: counts.pinned, icon: Pin },
        ].map((s) => (
          <Card key={s.label} className="p-3 text-center">
            <s.icon className="w-3.5 h-3.5 mx-auto text-muted-foreground mb-1" />
            <div className="text-lg font-bold font-mono">{s.value}</div>
            <div className="text-[10px] text-muted-foreground truncate">{s.label}</div>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder={fr ? "Rechercher..." : "Search..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-9"
          />
        </div>
        <div className="flex gap-1.5">
          <Button
            variant={filterType === "ALL" ? "default" : "outline"}
            size="sm"
            onClick={() => setFilterType("ALL")}
            className="h-9"
          >
            {fr ? "Toutes" : "All"}
          </Button>
          {NOTE_TYPES.map((nt) => (
            <Button
              key={nt.id}
              variant={filterType === nt.id ? "default" : "outline"}
              size="sm"
              onClick={() => setFilterType(nt.id)}
              className="h-9 gap-1.5"
            >
              <nt.icon className="w-3.5 h-3.5" />
              {fr ? nt.label_fr : nt.label_en}
            </Button>
          ))}
        </div>
      </div>

      {/* Content */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28 w-full rounded-xl" />
          ))}
        </div>
      ) : filteredNotes.length === 0 ? (
        <div className="text-center py-16">
          <StickyNote className="w-12 h-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">
            {search || filterType !== "ALL"
              ? fr ? "Aucune note trouvée" : "No notes found"
              : fr ? "Aucune note pour le moment" : "No notes yet"}
          </p>
        </div>
      ) : (
        <ScrollArea className="max-h-[calc(100vh-280px)]">
          <div className="space-y-5 pr-2">
            {groups.map((group) => (
              <div key={group.label}>
                <div className="flex items-center gap-2 mb-2 px-1">
                  <CalIcon className="w-3.5 h-3.5 text-muted-foreground" />
                  <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.label}
                  </h3>
                  <div className="h-px flex-1 bg-border" />
                  <span className="text-xs text-muted-foreground">{group.items.length}</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {group.items.map((note) => (
                    <NoteCard
                      key={note.id}
                      note={note}
                      language={language}
                      onEdit={() => handleEdit(note)}
                      onDelete={() => handleDelete(note)}
                      onTogglePin={() => handleTogglePin(note)}
                      onViewScreenshot={setViewerUrl}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Create / Edit Dialog */}
      {showForm && (
        <NoteFormDialog
          language={language}
          note={editingNote}
          presetType={presetType}
          onClose={handleClose}
          onSaved={handleSaved}
        />
      )}

      {/* Screenshot Viewer */}
      <Dialog open={!!viewerUrl} onOpenChange={(o) => !o && setViewerUrl(null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{fr ? "Capture" : "Screenshot"}</DialogTitle>
            <DialogDescription className="sr-only">{fr ? "Aperçu de la capture" : "Screenshot preview"}</DialogDescription>
          </DialogHeader>
          {viewerUrl && (
            <div className="flex items-center justify-center">
              <img
                src={viewerUrl}
                alt={fr ? "Capture" : "Screenshot"}
                className="max-w-full max-h-[70vh] rounded-lg object-contain"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Note Card ─────────────────────────────────────────────
function NoteCard({
  note,
  language,
  onEdit,
  onDelete,
  onTogglePin,
  onViewScreenshot,
}: {
  note: Note;
  language: "fr" | "en";
  onEdit: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
  onViewScreenshot: (url: string) => void;
}) {
  const fr = language === "fr";
  const meta = getNoteTypeMeta(note.type);
  const TypeIcon = meta.icon;
  const priorityMeta = getPriorityMeta(note.priority);
  const biasMeta = getBiasMeta(note.marketBias);
  const checklist = parseChecklist(note.checklist);
  const checkedCount = checklist.filter((c) => c.checked).length;

  let dateLabel = "";
  try {
    const d = parseISO(note.date);
    dateLabel = isNaN(d.getTime()) ? "" : format(d, "dd MMM yyyy");
  } catch {
    dateLabel = "";
  }

  const contentPreview =
    note.content.length > 180 ? note.content.slice(0, 180) + "..." : note.content;

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-colors relative",
        note.pinned ? "border-primary/50 bg-primary/5" : "border-border hover:border-foreground/20"
      )}
    >
      {/* Pinned marker */}
      {note.pinned && (
        <Pin className="absolute -top-2 -left-2 w-5 h-5 text-primary fill-primary drop-shadow" />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0 flex-wrap">
          <Badge variant="outline" className="gap-1 shrink-0">
            <TypeIcon className="w-3 h-3" />
            {fr ? meta.label_fr : meta.label_en}
          </Badge>
          {dateLabel && (
            <span className="text-xs text-muted-foreground shrink-0">{dateLabel}</span>
          )}
          {priorityMeta && (
            <Badge variant="outline" className={cn("text-[9px] shrink-0", priorityMeta.cls)}>
              <Flag className="w-2.5 h-2.5" />
              {fr ? priorityMeta.fr : priorityMeta.en}
            </Badge>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className={cn("h-7 w-7", note.pinned && "text-primary")}
            onClick={onTogglePin}
            title={note.pinned ? (fr ? "Désépingler" : "Unpin") : fr ? "Épingler" : "Pin"}
          >
            {note.pinned ? <PinOff className="w-3.5 h-3.5" /> : <Pin className="w-3.5 h-3.5" />}
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
            <Edit3 className="w-3.5 h-3.5" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={onDelete}>
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {/* Title */}
      <h4 className="font-semibold text-sm mb-1 line-clamp-1">{note.title}</h4>

      {/* Mood / confidence / bias row */}
      {(note.mood || note.confidence != null || biasMeta) && (
        <div className="flex items-center gap-2 flex-wrap mb-1.5 text-xs">
          {note.mood && <span title="Humeur">{note.mood}</span>}
          {note.confidence != null && (
            <Badge variant="secondary" className="text-[9px] gap-1">
              <ListChecks className="w-2.5 h-2.5" />
              {fr ? "Confiance" : "Confidence"} {note.confidence}/10
            </Badge>
          )}
          {biasMeta && (
            <Badge variant="secondary" className="text-[9px] gap-1">
              <biasMeta.icon className="w-2.5 h-2.5" />
              {fr ? biasMeta.fr : biasMeta.en}
            </Badge>
          )}
        </div>
      )}

      {/* Content */}
      {note.content && (
        <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap mb-2">
          {contentPreview}
        </p>
      )}

      {/* Checklist progress */}
      {checklist.length > 0 && (
        <div className="flex items-center gap-2 mb-2">
          <ListChecks className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all"
              style={{ width: `${(checkedCount / checklist.length) * 100}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground font-mono shrink-0">
            {checkedCount}/{checklist.length}
          </span>
        </div>
      )}

      {/* Screenshots */}
      {note.screenshots.length > 0 && (
        <div className="flex gap-2 flex-wrap mt-2">
          {note.screenshots.map((s) => (
            <button
              key={s.id}
              onClick={() => onViewScreenshot(getFileUrl(s.url))}
              className="relative w-16 h-16 rounded-lg overflow-hidden border border-border hover:border-foreground/30 transition-colors group"
            >
              <img
                src={getFileUrl(s.url)}
                alt={fr ? "Capture" : "Screenshot"}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                <Eye className="w-4 h-4 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Note Form Dialog (Create / Edit) ──────────────────────
function NoteFormDialog({
  language,
  note,
  presetType,
  onClose,
  onSaved,
}: {
  language: "fr" | "en";
  note: Note | null;
  presetType?: NoteType | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fr = language === "fr";
  const isEdit = !!note;

  const [type, setType] = useState<NoteType>((note?.type as NoteType) || presetType || "DAY");
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [date, setDate] = useState(
    note?.date ? format(parseISO(note.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [mood, setMood] = useState<string | null>(note?.mood || null);
  const [confidence, setConfidence] = useState<number | null>(note?.confidence ?? null);
  const [marketBias, setMarketBias] = useState<string | null>(note?.marketBias || null);
  const [priority, setPriority] = useState<string | null>(note?.priority || null);
  const [pinned, setPinned] = useState<boolean>(note?.pinned || false);
  const [checklist, setChecklist] = useState<ChecklistItem[]>(parseChecklist(note?.checklist || null));
  const [newItemText, setNewItemText] = useState("");
  const [screenshots, setScreenshots] = useState<NoteScreenshot[]>(note?.screenshots || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if we've created a new note (for screenshot upload)
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(note?.id || null);
  const savedRef = useRef(false);

  // Pending screenshots for a brand-new note (uploaded after the note is created)
  const [pendingFiles, setPendingFiles] = useState<
    { id: string; file: File; previewUrl: string }[]
  >([]);
  const pendingFilesRef = useRef(pendingFiles);
  pendingFilesRef.current = pendingFiles;
  useEffect(() => {
    return () => {
      pendingFilesRef.current.forEach((pf) => URL.revokeObjectURL(pf.previewUrl));
    };
  }, []);

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error(fr ? "Le titre est requis" : "Title is required");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        type,
        title: title.trim(),
        content: content.trim(),
        date: new Date(date).toISOString(),
        mood,
        confidence,
        marketBias,
        priority,
        pinned,
        checklist: JSON.stringify(checklist),
      };

      let res: Response;
      if (isEdit && note) {
        res = await fetch(`/api/notes/${note.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      } else {
        res = await fetch("/api/notes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
      }

      if (!res.ok) throw new Error("save failed");
      const data = await res.json();
      const noteId = data.note.id;
      setCreatedNoteId(noteId);
      savedRef.current = true;

      // Upload any screenshots queued while the note was being created
      if (pendingFiles.length > 0) {
        setUploading(true);
        let uploaded = 0;
        for (const pf of pendingFiles) {
          try {
            const fd = new FormData();
            fd.append("noteId", noteId);
            fd.append("file", pf.file);
            const upRes = await fetch("/api/notes/screenshots", { method: "POST", body: fd });
            if (upRes.ok) {
              const upData = await upRes.json();
              setScreenshots((prev) => [...prev, upData.screenshot]);
              uploaded++;
            }
          } catch {
            // best effort — continue with remaining files
          } finally {
            URL.revokeObjectURL(pf.previewUrl);
          }
        }
        setPendingFiles([]);
        setUploading(false);
        toast.success(
          uploaded > 0
            ? fr
              ? `Note enregistrée avec ${uploaded} capture(s)`
              : `Note saved with ${uploaded} screenshot(s)`
            : fr
              ? "Note enregistrée"
              : "Note saved"
        );
      } else {
        toast.success(fr ? "Note enregistrée" : "Note saved");
      }

      onSaved();
    } catch {
      toast.error(fr ? "Erreur lors de l'enregistrement" : "Error saving note");
    } finally {
      setSaving(false);
    }
  };

  const handleRemovePending = (pendingId: string) => {
    setPendingFiles((prev) => {
      const target = prev.find((p) => p.id === pendingId);
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((p) => p.id !== pendingId);
    });
  };

  const handleUploadScreenshot = async (file: File) => {
    const noteId = createdNoteId || note?.id;
    if (!noteId) {
      toast.error(fr ? "Enregistrez la note d'abord" : "Save the note first");
      return;
    }
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("noteId", noteId);
      fd.append("file", file);
      const res = await fetch("/api/notes/screenshots", { method: "POST", body: fd });
      if (!res.ok) throw new Error("upload failed");
      const data = await res.json();
      setScreenshots((prev) => [...prev, data.screenshot]);
      toast.success(fr ? "Capture ajoutée" : "Screenshot added");
    } catch {
      toast.error(fr ? "Erreur lors de l'upload" : "Upload error");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteScreenshot = async (screenshotId: string) => {
    try {
      const res = await fetch(`/api/notes/screenshots?screenshotId=${screenshotId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("delete failed");
      setScreenshots((prev) => prev.filter((s) => s.id !== screenshotId));
      toast.success(fr ? "Capture supprimée" : "Screenshot removed");
    } catch {
      toast.error(fr ? "Erreur lors de la suppression" : "Error removing screenshot");
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? (fr ? "Modifier la Note" : "Edit Note") : (fr ? "Ajouter une Note" : "Add Note")}</DialogTitle>
          <DialogDescription className="sr-only">
            {fr ? "Formulaire de note" : "Note form"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Type selector */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{fr ? "Type" : "Type"}</Label>
            <div className="flex gap-2">
              {NOTE_TYPES.map((nt) => (
                <Button
                  key={nt.id}
                  type="button"
                  variant={type === nt.id ? "default" : "outline"}
                  size="sm"
                  onClick={() => setType(nt.id)}
                  className="gap-1.5 flex-1"
                >
                  <nt.icon className="w-3.5 h-3.5" />
                  {fr ? nt.label_fr : nt.label_en}
                </Button>
              ))}
            </div>
          </div>

          {/* Templates (creation only) */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{fr ? "Modèle de préparation" : "Prep template"}</Label>
              <div className="flex flex-wrap gap-1.5">
                {NOTE_TYPES.map((nt) => (
                  <Button
                    key={nt.id}
                    type="button"
                    variant="outline"
                    size="sm"
                    className="gap-1.5 h-8 text-xs"
                    onClick={() => {
                      setType(nt.id);
                      setContent(TEMPLATES[nt.id].content);
                      if (!title.trim()) {
                        setTitle(fr ? TEMPLATES[nt.id].fr : TEMPLATES[nt.id].en);
                      }
                    }}
                  >
                    <nt.icon className="w-3.5 h-3.5" />
                    {fr ? TEMPLATES[nt.id].fr : TEMPLATES[nt.id].en}
                  </Button>
                ))}
              </div>
            </div>
          )}

          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{fr ? "Titre" : "Title"} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={fr ? "Titre de la note" : "Note title"}
              className="h-9"
            />
          </div>

          {/* Date */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{fr ? "Date" : "Date"}</Label>
            <Input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="h-9"
            />
          </div>

          {/* Meta: mood / confidence / bias / priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{fr ? "Humeur" : "Mood"}</Label>
              <div className="flex gap-1">
                {MOODS.map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setMood(mood === m ? null : m)}
                    className={cn(
                      "w-8 h-8 rounded-lg border text-base flex items-center justify-center transition-colors",
                      mood === m ? "border-primary bg-primary/10" : "border-border hover:border-primary/30"
                    )}
                  >
                    {m}
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{fr ? "Confiance (1-10)" : "Confidence (1-10)"}</Label>
              <Input
                type="number"
                min={1}
                max={10}
                value={confidence ?? ""}
                onChange={(e) => {
                  const v = parseInt(e.target.value, 10);
                  setConfidence(isNaN(v) ? null : Math.max(1, Math.min(10, v)));
                }}
                className="h-9 font-mono"
                placeholder={fr ? "Ex : 7" : "e.g. 7"}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{fr ? "Biais de marché" : "Market bias"}</Label>
              <div className="flex gap-1.5">
                {BIASES.map((b) => (
                  <Button
                    key={b.id}
                    type="button"
                    variant={marketBias === b.id ? "default" : "outline"}
                    size="sm"
                    className="gap-1 flex-1 h-8 text-xs"
                    onClick={() => setMarketBias(marketBias === b.id ? null : b.id)}
                  >
                    <b.icon className="w-3 h-3" />
                    {fr ? b.fr : b.en}
                  </Button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">{fr ? "Priorité" : "Priority"}</Label>
              <div className="flex flex-wrap gap-1">
                {PRIORITIES.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => setPriority(priority === p.id ? null : p.id)}
                    className={cn(
                      "px-2 h-8 rounded-md border text-[10px] font-semibold transition-colors",
                      priority === p.id ? p.cls : "border-border text-muted-foreground hover:border-primary/30"
                    )}
                  >
                    {fr ? p.fr : p.en}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Checklist editor */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">{fr ? "Checklist" : "Checklist"}</Label>
            {checklist.length > 0 && (
              <div className="space-y-1">
                {checklist.map((item, i) => (
                  <div key={i} className="flex items-center gap-2 group">
                    <button
                      type="button"
                      onClick={() =>
                        setChecklist((prev) => prev.map((c, ci) => (ci === i ? { ...c, checked: !c.checked } : c)))
                      }
                      className={cn(
                        "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                        item.checked ? "bg-primary border-primary text-primary-foreground" : "border-border"
                      )}
                    >
                      {item.checked && <CheckCircle2 className="w-3 h-3" />}
                    </button>
                    <span className={cn("text-sm flex-1", item.checked && "line-through text-muted-foreground")}>
                      {item.text}
                    </span>
                    <button
                      type="button"
                      onClick={() => setChecklist((prev) => prev.filter((_, ci) => ci !== i))}
                      className="opacity-0 group-hover:opacity-100 text-destructive"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <div className="flex gap-2">
              <Input
                value={newItemText}
                onChange={(e) => setNewItemText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && newItemText.trim()) {
                    e.preventDefault();
                    setChecklist((prev) => [...prev, { text: newItemText.trim(), checked: false }]);
                    setNewItemText("");
                  }
                }}
                placeholder={fr ? "Ajouter un élément... (Entrée)" : "Add an item... (Enter)"}
                className="h-9 text-sm"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-9 gap-1.5 shrink-0"
                disabled={!newItemText.trim()}
                onClick={() => {
                  setChecklist((prev) => [...prev, { text: newItemText.trim(), checked: false }]);
                  setNewItemText("");
                }}
              >
                <Plus className="w-3.5 h-3.5" />
                {fr ? "Ajouter" : "Add"}
              </Button>
            </div>
          </div>

          {/* Pin toggle */}
          <button
            type="button"
            onClick={() => setPinned(!pinned)}
            className={cn(
              "flex items-center gap-2 text-sm rounded-lg border px-3 py-2 transition-colors w-fit",
              pinned ? "border-primary/50 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:border-primary/30"
            )}
          >
            <Pin className="w-4 h-4" />
            {pinned
              ? fr ? "Note épinglée (en haut de la liste)" : "Note pinned (top of list)"
              : fr ? "Épingler cette note" : "Pin this note"}
          </button>

          {/* Content */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">{fr ? "Contenu" : "Content"}</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={fr ? "Vos observations..." : "Your observations..."}
              className="min-h-[140px] text-sm"
            />
          </div>

          {/* Screenshots */}
          <div className="space-y-2">
            <Label className="text-xs font-medium">{fr ? "Captures d'écran" : "Screenshots"}</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                if (files.length === 0) return;
                const noteId = createdNoteId || note?.id;
                if (noteId) {
                  // Existing / already-saved note — upload immediately (unchanged behavior)
                  files.forEach((f) => handleUploadScreenshot(f));
                } else {
                  // New note — queue locally, upload automatically on save
                  const pending = files.map((f) => ({
                    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
                    file: f,
                    previewUrl: URL.createObjectURL(f),
                  }));
                  setPendingFiles((prev) => [...prev, ...pending]);
                }
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <ImagePlus className="w-3.5 h-3.5" />
              )}
              {uploading
                ? (fr ? "Upload..." : "Uploading...")
                : (fr ? "Joindre une capture" : "Attach screenshot")}
            </Button>
            {pendingFiles.length > 0 && (
              <p className="text-[11px] text-muted-foreground">
                {fr
                  ? `${pendingFiles.length} capture(s) seront ajoutées à l'enregistrement.`
                  : `${pendingFiles.length} screenshot(s) will be added on save.`}
              </p>
            )}
            {(screenshots.length > 0 || pendingFiles.length > 0) && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {pendingFiles.map((pf) => (
                  <div
                    key={pf.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-dashed border-amber-400/60 group"
                  >
                    <img
                      src={pf.previewUrl}
                      alt={fr ? "Capture" : "Screenshot"}
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0 inset-x-0 bg-amber-500/80 text-white text-[9px] text-center py-0.5">
                      {fr ? "En attente" : "Pending"}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemovePending(pf.id)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
                {screenshots.map((s) => (
                  <div
                    key={s.id}
                    className="relative aspect-square rounded-lg overflow-hidden border border-border group"
                  >
                    <img
                      src={getFileUrl(s.url)}
                      alt={fr ? "Capture" : "Screenshot"}
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => handleDeleteScreenshot(s.id)}
                      className="absolute top-1 right-1 bg-black/60 hover:bg-black/80 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            {fr ? "Annuler" : "Cancel"}
          </Button>
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {fr ? "Enregistrer" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
