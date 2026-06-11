"use client";

import React, { useState, useCallback, useEffect, useRef } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { getFileUrl } from "@/lib/storage";

const NOTE_TYPES = [
  { id: "DAY", label_fr: "Journée de Trading", label_en: "Trading Day", icon: Sun, color: "text-gold" },
  { id: "WEEK", label_fr: "Semaine de Trading", label_en: "Trading Week", icon: CalendarDays, color: "text-primary" },
  { id: "MONTH", label_fr: "Mois de Trading", label_en: "Trading Month", icon: CalendarRange, color: "text-profit" },
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

          // Mark as triggered on server
          fetch(`/api/alerts/${alert.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ triggered: true }),
          }).catch(() => {});

          // Show browser notification
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
    intervalRef.current = setInterval(checkAlerts, 15000); // check every 15s

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [alerts]);
}

// ─── Main Component ──────────────────────────────────────
export function NotesTab() {
  const { language } = useAppStore();
  const [activeType, setActiveType] = useState<string>("DAY");
  const { notes, loading, refetch } = useNotes(activeType);
  const { alerts, refetch: refetchAlerts } = useAlerts();

  useNotificationChecker(alerts);

  // Fetch on mount
  React.useEffect(() => { refetch(); refetchAlerts(); }, [refetch, refetchAlerts]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [viewingNote, setViewingNote] = useState<any>(null);
  const [showAlertDialog, setShowAlertDialog] = useState(false);
  const [editingAlert, setEditingAlert] = useState<any>(null);

  const handleDelete = async (id: string) => {
    if (!confirm(language === "fr" ? "Supprimer cette note ?" : "Delete this note?")) return;
    try {
      const res = await fetch(`/api/notes/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(language === "fr" ? "Note supprimée" : "Note deleted");
        refetch();
      }
    } catch {
      toast.error("Error");
    }
  };

  const handleEdit = (note: any) => {
    setEditingNote(note);
    setShowDialog(true);
  };

  const handleAdd = () => {
    setEditingNote(null);
    setShowDialog(true);
  };

  const handleDeleteAlert = async (id: string) => {
    if (!confirm(language === "fr" ? "Supprimer cette alerte ?" : "Delete this alert?")) return;
    try {
      const res = await fetch(`/api/alerts/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(language === "fr" ? "Alerte supprimée" : "Alert deleted");
        refetchAlerts();
      }
    } catch {
      toast.error("Error");
    }
  };

  const pendingAlerts = alerts.filter((a: any) => !a.triggered);
  const triggeredAlerts = alerts.filter((a: any) => a.triggered);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald bg-clip-text text-transparent">
            {t(language, "prepNotes")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr" ? "Préparez vos sessions de trading" : "Prepare your trading sessions"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => window.open("https://fr.tradingview.com/", "_blank", "noopener,noreferrer")}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">TradingView</span>
          </Button>
          <Button
            variant="outline"
            className="gap-2 relative"
            onClick={() => { setEditingAlert(null); setShowAlertDialog(true); }}
          >
            <Bell className="w-4 h-4" />
            <span className="hidden sm:inline">{language === "fr" ? "Alerte" : "Alert"}</span>
            {pendingAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground text-[9px] flex items-center justify-center font-bold">
                {pendingAlerts.length}
              </span>
            )}
          </Button>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            {t(language, "addNote")}
          </Button>
        </div>
      </div>

      {/* TradingView Button — prominent */}
      <Card className="p-4 flex items-center justify-between bg-gradient-to-r from-primary/5 to-emerald/5 border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ExternalLink className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">TradingView</h3>
            <p className="text-xs text-muted-foreground">
              {language === "fr" ? "Accéder aux graphiques en temps réel" : "Access real-time charts"}
            </p>
          </div>
        </div>
        <Button
          className="gap-2"
          onClick={() => window.open("https://fr.tradingview.com/", "_blank", "noopener,noreferrer")}
        >
          <ExternalLink className="w-4 h-4" />
          {language === "fr" ? "Ouvrir TradingView" : "Open TradingView"}
        </Button>
      </Card>

      {/* Alerts Section */}
      {(pendingAlerts.length > 0 || triggeredAlerts.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <BellRing className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold">
                {language === "fr" ? "Mes Alertes" : "My Alerts"}
              </h3>
              <Badge variant="secondary" className="text-[10px]">{pendingAlerts.length}</Badge>
            </div>
            <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => { setEditingAlert(null); setShowAlertDialog(true); }}>
              <Plus className="w-3.5 h-3.5" />
              {language === "fr" ? "Ajouter" : "Add"}
            </Button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {pendingAlerts.map((alert: any) => (
              <Card key={alert.id} className="p-3 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Bell className="w-3.5 h-3.5 text-primary shrink-0" />
                      <h4 className="text-sm font-semibold truncate">{alert.title}</h4>
                    </div>
                    {alert.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 mb-1">{alert.description}</p>
                    )}
                    <Badge variant="outline" className="text-[10px]">
                      <Calendar className="w-3 h-3 mr-1" />
                      {new Date(alert.alertDate).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </Badge>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => { setEditingAlert(alert); setShowAlertDialog(true); }}>
                      <Edit3 className="w-3 h-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-loss" onClick={() => handleDeleteAlert(alert.id)}>
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
            {triggeredAlerts.slice(0, 3).map((alert: any) => (
              <Card key={alert.id} className="p-3 opacity-50">
                <div className="flex items-center gap-2">
                  <BellRing className="w-3.5 h-3.5 text-muted-foreground" />
                  <h4 className="text-sm font-medium line-through truncate">{alert.title}</h4>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Type Tabs */}
      <div className="grid grid-cols-3 gap-3">
        {NOTE_TYPES.map((nt) => {
          const Icon = nt.icon;
          const isActive = activeType === nt.id;
          const count = notes.filter((n: any) => n.type === nt.id).length;
          return (
            <button
              key={nt.id}
              onClick={() => setActiveType(nt.id)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all duration-200 text-center",
                isActive
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/30 bg-card"
              )}
            >
              <Icon className={cn("w-6 h-6 mx-auto mb-2", nt.color)} />
              <div className="text-sm font-semibold">
                {language === "fr" ? nt.label_fr : nt.label_en}
              </div>
              <Badge variant="secondary" className="text-[10px] mt-2">{count}</Badge>
            </button>
          );
        })}
      </div>

      {/* Notes List */}
      {loading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-24 w-full" /></Card>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <Card className="p-12 text-center">
          <StickyNote className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t(language, "noData")}</p>
          <Button onClick={handleAdd} variant="outline" className="mt-4 gap-2">
            <Plus className="w-4 h-4" />
            {t(language, "addNote")}
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {notes
            .filter((n: any) => n.type === activeType)
            .sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime())
            .map((note: any) => (
              <Card key={note.id} className="p-4 hover:border-primary/30 transition-colors cursor-pointer" onClick={() => setViewingNote(note)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{note.title}</h4>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {new Date(note.date).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}
                      </Badge>
                      {note.screenshots?.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 gap-1">
                          <Camera className="w-3 h-3" />
                          {note.screenshots.length}
                        </Badge>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
                    {/* Screenshot thumbnails */}
                    {note.screenshots?.length > 0 && (
                      <div className="flex gap-2 mt-2">
                        {note.screenshots.slice(0, 3).map((ss: any) => {
                          const src = ss.url.startsWith('http') ? ss.url : `/api/screenshots/${ss.url.replace('upload/screenshots/', '')}`;
                          return (
                            <div key={ss.id} className="w-12 h-8 rounded overflow-hidden border border-border">
                              <img src={src} alt="Screenshot" className="w-full h-full object-cover" />
                            </div>
                          );
                        })}
                        {note.screenshots.length > 3 && (
                          <div className="w-12 h-8 rounded border border-border flex items-center justify-center bg-muted text-[9px] font-medium text-muted-foreground">
                            +{note.screenshots.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={(e) => { e.stopPropagation(); handleEdit(note); }}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-loss" onClick={(e) => { e.stopPropagation(); handleDelete(note.id); }}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}

      {/* View Note Dialog */}
      <Dialog open={!!viewingNote} onOpenChange={(open) => { if (!open) setViewingNote(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <StickyNote className="w-5 h-5 text-primary" />
              {viewingNote?.title}
            </DialogTitle>
            <DialogDescription>
              {viewingNote?.date && new Date(viewingNote.date).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap break-words">{viewingNote?.content}</p>
            {/* Screenshots in view */}
            {viewingNote?.screenshots?.length > 0 && (
              <div className="mt-4 space-y-2">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {language === "fr" ? "Captures d'écran" : "Screenshots"}
                </h5>
                <div className="grid grid-cols-3 gap-2">
                  {viewingNote.screenshots.map((ss: any) => {
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
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingNote(null)}>{language === "fr" ? "Fermer" : "Close"}</Button>
            <Button onClick={() => { const n = viewingNote; setViewingNote(null); handleEdit(n); }}>{language === "fr" ? "Modifier" : "Edit"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add/Edit Note Dialog */}
      <NoteDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        note={editingNote}
        type={activeType}
        language={language}
        onSaved={refetch}
      />

      {/* Alert Dialog */}
      <AlertDialog
        open={showAlertDialog}
        onOpenChange={setShowAlertDialog}
        alert={editingAlert}
        language={language}
        onSaved={refetchAlerts}
      />
    </div>
  );
}

// ─── Note Dialog (updated with screenshots) ──────────────
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
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [screenshots, setScreenshots] = useState<any[]>([]);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [savedNoteId, setSavedNoteId] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title || "");
        setContent(note.content || "");
        setDate(note.date ? format(new Date(note.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
        setNoteType(note.type || type);
        setScreenshots(note.screenshots || []);
        setSavedNoteId(note.id);
      } else {
        setTitle("");
        setContent("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setNoteType(type);
        setScreenshots([]);
        setSavedNoteId(null);
      }
    }
  }, [open, note, type]);

  const handleScreenshotUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length || !savedNoteId) return;

    setUploadingScreenshot(true);
    try {
      for (const file of Array.from(files)) {
        const formData = new FormData();
        formData.append("noteId", savedNoteId);
        formData.append("file", file);
        const res = await fetch("/api/notes/screenshots", { method: "POST", body: formData });
        if (res.ok) {
          const data = await res.json();
          setScreenshots((prev) => [...prev, data.screenshot]);
        }
      }
      toast.success(language === "fr" ? "Capture ajoutée" : "Screenshot added");
    } catch {
      toast.error(language === "fr" ? "Erreur d'upload" : "Upload error");
    }
    setUploadingScreenshot(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleRemoveScreenshot = async (screenshotId: string) => {
    try {
      await fetch(`/api/notes/screenshots?screenshotId=${screenshotId}`, { method: "DELETE" });
      setScreenshots((prev) => prev.filter((s) => s.id !== screenshotId));
      toast.success(language === "fr" ? "Capture supprimée" : "Screenshot removed");
    } catch {
      toast.error("Error");
    }
  };

  const handleSubmit = async () => {
    if (!title) {
      toast.error(language === "fr" ? "Le titre est requis" : "Title is required");
      return;
    }
    setIsSubmitting(true);
    try {
      const body = { title, content, date, type: noteType };
      const res = note
        ? await fetch(`/api/notes/${note.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/notes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

      if (res.ok) {
        const data = await res.json();
        // For new notes, set the saved ID so screenshots can be uploaded
        if (!note && data.note?.id) {
          setSavedNoteId(data.note.id);
        }
        toast.success(note ? (language === "fr" ? "Note modifiée" : "Note updated") : (language === "fr" ? "Note ajoutée" : "Note added"));
        onOpenChange(false);
        onSaved();
      } else {
        toast.error("Error");
      }
    } catch {
      toast.error("Error");
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <StickyNote className="w-5 h-5 text-primary" />
            {note ? t(language, "editNote") : t(language, "addNote")}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" ? "Rédigez votre note de préparation" : "Write your preparation note"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{language === "fr" ? "Type" : "Type"}</Label>
            <div className="grid grid-cols-3 gap-2">
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
                    {language === "fr" ? nt.label_fr.split(" ")[0] : nt.label_en.split(" ")[0]}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{language === "fr" ? "Titre" : "Title"} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder={language === "fr" ? "Titre de la note" : "Note title"} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t(language, "date")}</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{language === "fr" ? "Contenu" : "Content"}</Label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={language === "fr" ? "Écrivez votre préparation ici..." : "Write your preparation here..."}
              rows={8}
              className="resize-y !field-sizing-fixed overflow-y-auto break-words"
            />
          </div>

          {/* Screenshot Upload */}
          {savedNoteId && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs flex items-center gap-1.5">
                  <Camera className="w-3.5 h-3.5" />
                  {language === "fr" ? "Captures d'écran" : "Screenshots"}
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 gap-1.5 text-xs"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingScreenshot}
                >
                  {uploadingScreenshot ? <Loader2 className="w-3 h-3 animate-spin" /> : <ImagePlus className="w-3 h-3" />}
                  {language === "fr" ? "Ajouter" : "Add"}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleScreenshotUpload}
                />
              </div>
              {screenshots.length > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {screenshots.map((ss: any) => {
                    const src = ss.url.startsWith('http') ? ss.url : `/api/screenshots/${ss.url.replace('upload/screenshots/', '')}`;
                    return (
                      <div key={ss.id} className="group relative aspect-video rounded-lg overflow-hidden border border-border">
                        <img src={src} alt="Screenshot" className="w-full h-full object-cover" />
                        <button
                          onClick={() => handleRemoveScreenshot(ss.id)}
                          className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {!savedNoteId && (
            <p className="text-xs text-muted-foreground text-center">
              {language === "fr"
                ? "Enregistrez la note d'abord pour ajouter des captures d'écran"
                : "Save the note first to add screenshots"}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t(language, "cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 mr-1" />}
            {t(language, "save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Alert Dialog ────────────────────────────────────────
function AlertDialog({
  open,
  onOpenChange,
  alert,
  language,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  alert: any | null;
  language: "fr" | "en";
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [alertDate, setAlertDate] = useState("");
  const [alertTime, setAlertTime] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (open) {
      if (alert) {
        setTitle(alert.title || "");
        setDescription(alert.description || "");
        const d = new Date(alert.alertDate);
        setAlertDate(format(d, "yyyy-MM-dd"));
        setAlertTime(format(d, "HH:mm"));
      } else {
        setTitle("");
        setDescription("");
        setAlertDate(format(new Date(), "yyyy-MM-dd"));
        setAlertTime(format(new Date(), "HH:mm"));
      }
    }
  }, [open, alert]);

  // Request notification permission on mount
  React.useEffect(() => {
    if (open && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [open]);

  const handleSubmit = async () => {
    if (!title || !alertDate || !alertTime) {
      toast.error(language === "fr" ? "Titre et date/heure requis" : "Title and date/time required");
      return;
    }

    // Check notification permission
    if ("Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    setIsSubmitting(true);
    try {
      const body = { title, description, alertDate: `${alertDate}T${alertTime}:00` };
      const res = alert
        ? await fetch(`/api/alerts/${alert.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
        : await fetch("/api/alerts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

      if (res.ok) {
        toast.success(alert
          ? (language === "fr" ? "Alerte modifiée" : "Alert updated")
          : (language === "fr" ? "Alerte créée" : "Alert created")
        );
        onOpenChange(false);
        onSaved();
      } else {
        toast.error("Error");
      }
    } catch {
      toast.error("Error");
    }
    setIsSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5 text-primary" />
            {alert ? (language === "fr" ? "Modifier l'alerte" : "Edit alert") : (language === "fr" ? "Nouvelle alerte" : "New alert")}
          </DialogTitle>
          <DialogDescription>
            {language === "fr"
              ? "Recevez une notification navigateur à l'heure prévue"
              : "Receive a browser notification at the scheduled time"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{language === "fr" ? "Titre" : "Title"} *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={language === "fr" ? "Ex: News NFP à 14h30" : "Ex: NFP News at 2:30 PM"}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{language === "fr" ? "Description" : "Description"}</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={language === "fr" ? "Détails de l'alerte..." : "Alert details..."}
              rows={3}
              className="resize-none"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "fr" ? "Date" : "Date"} *</Label>
              <Input type="date" value={alertDate} onChange={(e) => setAlertDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{language === "fr" ? "Heure" : "Time"} *</Label>
              <Input type="time" value={alertTime} onChange={(e) => setAlertTime(e.target.value)} />
            </div>
          </div>
          {"Notification" in window && Notification.permission === "denied" && (
            <p className="text-xs text-loss">
              {language === "fr"
                ? "Les notifications sont bloquées par votre navigateur. Autorisez-les dans les paramètres."
                : "Notifications are blocked by your browser. Allow them in settings."}
            </p>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t(language, "cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bell className="w-4 h-4 mr-1" />}
            {alert ? (language === "fr" ? "Modifier" : "Update") : (language === "fr" ? "Créer" : "Create")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
