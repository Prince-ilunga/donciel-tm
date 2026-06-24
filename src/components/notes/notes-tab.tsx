"use client";

import React, { useState, useCallback, useEffect, useRef, Component } from "react";
import type { ReactNode, ErrorInfo } from "react";
import { useAppStore } from "@/stores/app-store";
import { useNotes } from "@/lib/hooks";
import { getFileUrl } from "@/lib/file-url";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
  pinned: boolean;
  createdAt: string;
  updatedAt: string;
  screenshots: NoteScreenshot[];
}

type NoteType = "DAY" | "WEEK" | "MONTH";

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

  // Group notes by date label
  const groups: { label: string; items: Note[] }[] = [];
  const groupMap = new Map<string, Note[]>();
  filteredNotes.forEach((n) => {
    const label = getNoteGroupLabel(n.date, language);
    if (!groupMap.has(label)) groupMap.set(label, []);
    groupMap.get(label)!.push(n);
  });
  groupMap.forEach((items, label) => groups.push({ label, items }));

  const handleEdit = (note: Note) => {
    setEditingNote(note);
    setShowForm(true);
  };

  const handleNew = () => {
    setEditingNote(null);
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
            {fr ? "Notez vos observations et joignez vos captures" : "Write your observations and attach screenshots"}
          </p>
        </div>
        <Button onClick={handleNew} className="gap-2 w-full sm:w-auto">
          <Plus className="w-4 h-4" />
          {fr ? "Ajouter une Note" : "Add Note"}
        </Button>
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
  onViewScreenshot,
}: {
  note: Note;
  language: "fr" | "en";
  onEdit: () => void;
  onDelete: () => void;
  onViewScreenshot: (url: string) => void;
}) {
  const fr = language === "fr";
  const meta = getNoteTypeMeta(note.type);
  const TypeIcon = meta.icon;

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
    <div className="rounded-xl border border-border bg-card p-4 hover:border-foreground/20 transition-colors">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <Badge variant="outline" className="gap-1 shrink-0">
            <TypeIcon className="w-3 h-3" />
            {fr ? meta.label_fr : meta.label_en}
          </Badge>
          {dateLabel && (
            <span className="text-xs text-muted-foreground shrink-0">{dateLabel}</span>
          )}
        </div>
        <div className="flex gap-1 shrink-0">
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

      {/* Content */}
      {note.content && (
        <p className="text-xs text-muted-foreground line-clamp-4 whitespace-pre-wrap mb-2">
          {contentPreview}
        </p>
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
  onClose,
  onSaved,
}: {
  language: "fr" | "en";
  note: Note | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const fr = language === "fr";
  const isEdit = !!note;

  const [type, setType] = useState<NoteType>((note?.type as NoteType) || "DAY");
  const [title, setTitle] = useState(note?.title || "");
  const [content, setContent] = useState(note?.content || "");
  const [date, setDate] = useState(
    note?.date ? format(parseISO(note.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")
  );
  const [screenshots, setScreenshots] = useState<NoteScreenshot[]>(note?.screenshots || []);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if we've created a new note (for screenshot upload)
  const [createdNoteId, setCreatedNoteId] = useState<string | null>(note?.id || null);
  const savedRef = useRef(false);

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
      setCreatedNoteId(data.note.id);
      savedRef.current = true;
      toast.success(fr ? "Note enregistrée" : "Note saved");
      onSaved();
    } catch {
      toast.error(fr ? "Erreur lors de l'enregistrement" : "Error saving note");
    } finally {
      setSaving(false);
    }
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
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUploadScreenshot(f);
                e.target.value = "";
              }}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-2 w-full"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading || !createdNoteId && !note}
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
            {!createdNoteId && !note && (
              <p className="text-[11px] text-muted-foreground">
                {fr ? "Enregistrez la note pour pouvoir joindre des captures." : "Save the note first to attach screenshots."}
              </p>
            )}
            {screenshots.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
