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
    intervalRef.current = setInterval(checkAlerts, 15000);

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
        refetch();
      }
    } catch {
      toast.error("Error");
    }
  };

  // Standalone alerts (not linked to any note)
  const standaloneAlerts = alerts.filter((a: any) => !a.noteId);
  const pendingAlerts = standaloneAlerts.filter((a: any) => !a.triggered);
  const triggeredAlerts = standaloneAlerts.filter((a: any) => a.triggered);

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
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
            onClick={() => {
              // Open TradingView desktop app via hidden iframe (industry standard for deep linking)
              const iframe = document.createElement('iframe');
              iframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;';
              iframe.src = 'tradingview://';
              document.body.appendChild(iframe);
              setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
            }}
          >
            <ExternalLink className="w-4 h-4" />
            <span className="hidden sm:inline">TradingView</span>
          </Button>
          <Button onClick={handleAdd} className="gap-2">
            <Plus className="w-4 h-4" />
            {t(language, "addNote")}
          </Button>
        </div>
      </div>

      {/* TradingView Button — prominent */}
      <Card className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-primary/5 to-emerald/5 border-primary/20">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ExternalLink className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold">TradingView</h3>
            <p className="text-xs text-muted-foreground">
              {language === "fr" ? "Ouvrir l'application de bureau" : "Open desktop application"}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            className="gap-2"
            onClick={() => {
              // Open TradingView desktop app via hidden iframe (industry standard for deep linking)
              const iframe = document.createElement('iframe');
              iframe.style.cssText = 'display:none;width:0;height:0;border:none;position:absolute;';
              iframe.src = 'tradingview://';
              document.body.appendChild(iframe);
              setTimeout(() => { if (document.body.contains(iframe)) document.body.removeChild(iframe); }, 3000);
            }}
          >
            <ExternalLink className="w-4 h-4" />
            {language === "fr" ? "Ouvrir TradingView" : "Open TradingView"}
          </Button>
          <a
            href="https://fr.tradingview.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground underline hover:text-foreground transition-colors whitespace-nowrap"
          >
            {language === "fr" ? "Site web" : "Website"}
          </a>
        </div>
      </Card>

      {/* Standalone Alerts Section */}
      {(pendingAlerts.length > 0 || triggeredAlerts.length > 0) && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <BellRing className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold">
              {language === "fr" ? "Mes Alertes" : "My Alerts"}
            </h3>
            <Badge variant="secondary" className="text-[10px]">{pendingAlerts.length}</Badge>
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
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
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
                      {note.alerts?.length > 0 && (
                        <Badge variant="secondary" className="text-[10px] shrink-0 gap-1">
                          <Bell className="w-3 h-3" />
                          {note.alerts.filter((a: any) => !a.triggered).length}
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
                    {/* Alert preview */}
                    {note.alerts?.filter((a: any) => !a.triggered).length > 0 && (
                      <div className="flex items-center gap-1.5 mt-2">
                        {note.alerts.filter((a: any) => !a.triggered).map((alert: any) => (
                          <Badge key={alert.id} variant="outline" className="text-[10px] gap-1 text-primary border-primary/30">
                            <Bell className="w-3 h-3" />
                            {alert.title} — {new Date(alert.alertDate).toLocaleTimeString(language === "fr" ? "fr-FR" : "en-US", { hour: "2-digit", minute: "2-digit" })}
                          </Badge>
                        ))}
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
            {/* Alerts in view */}
            {viewingNote?.alerts?.length > 0 && (
              <div className="mt-4 space-y-2">
                <h5 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {language === "fr" ? "Alertes" : "Alerts"}
                </h5>
                {viewingNote.alerts.map((alert: any) => (
                  <div key={alert.id} className="flex items-center gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                    <Bell className={cn("w-4 h-4 shrink-0", alert.triggered ? "text-muted-foreground" : "text-primary")} />
                    <div className="flex-1 min-w-0">
                      <p className={cn("text-sm font-medium truncate", alert.triggered && "line-through text-muted-foreground")}>{alert.title}</p>
                      {alert.description && <p className="text-xs text-muted-foreground line-clamp-1">{alert.description}</p>}
                    </div>
                    <Badge variant="outline" className="text-[10px] shrink-0">
                      {new Date(alert.alertDate).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US", {
                        month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                      })}
                    </Badge>
                  </div>
                ))}
              </div>
            )}
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

      {/* Add/Edit Note Dialog (with integrated alert + screenshots) */}
      <NoteDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        note={editingNote}
        type={activeType}
        language={language}
        onSaved={() => { refetch(); refetchAlerts(); }}
      />
    </div>
  );
}

// ─── Note Dialog (with integrated alert + screenshots) ──────
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

  // Screenshot state - files selected before save
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [previewUrls, setPreviewUrls] = useState<string[]>([]);
  const [existingScreenshots, setExistingScreenshots] = useState<any[]>([]);
  const [uploadingScreenshot, setUploadingScreenshot] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Alert state - integrated into note form
  const [enableAlert, setEnableAlert] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertDescription, setAlertDescription] = useState("");
  const [alertDate, setAlertDate] = useState("");
  const [alertTime, setAlertTime] = useState("");
  const [existingAlerts, setExistingAlerts] = useState<any[]>([]);

  React.useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title || "");
        setContent(note.content || "");
        setDate(note.date ? format(new Date(note.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
        setNoteType(note.type || type);
        setExistingScreenshots(note.screenshots || []);
        setSelectedFiles([]);
        setPreviewUrls([]);
        // Load existing alerts
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
      } else {
        setTitle("");
        setContent("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setNoteType(type);
        setExistingScreenshots([]);
        setSelectedFiles([]);
        setPreviewUrls([]);
        setEnableAlert(false);
        setAlertTitle("");
        setAlertDescription("");
        setAlertDate(format(new Date(), "yyyy-MM-dd"));
        setAlertTime(format(new Date(), "HH:mm"));
        setExistingAlerts([]);
      }
    }
  }, [open, note, type]);

  // Request notification permission when alert is enabled
  React.useEffect(() => {
    if (open && enableAlert && "Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, [open, enableAlert]);

  // Handle file selection for screenshots
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    const newFiles = Array.from(files);
    const newUrls = newFiles.map(f => URL.createObjectURL(f));
    setSelectedFiles(prev => [...prev, ...newFiles]);
    setPreviewUrls(prev => [...prev, ...newUrls]);

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // Remove a pending file
  const handleRemovePendingFile = (index: number) => {
    URL.revokeObjectURL(previewUrls[index]);
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
    setPreviewUrls(prev => prev.filter((_, i) => i !== index));
  };

  // Remove an existing screenshot
  const handleRemoveExistingScreenshot = async (screenshotId: string) => {
    try {
      await fetch(`/api/notes/screenshots?screenshotId=${screenshotId}`, { method: "DELETE" });
      setExistingScreenshots(prev => prev.filter((s) => s.id !== screenshotId));
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

    // Validate alert fields if alert is enabled
    if (enableAlert && (!alertTitle || !alertDate || !alertTime)) {
      toast.error(language === "fr" ? "Titre et date/heure de l'alerte requis" : "Alert title and date/time required");
      return;
    }

    // Check notification permission if alert is enabled
    if (enableAlert && "Notification" in window && Notification.permission === "default") {
      await Notification.requestPermission();
    }

    setIsSubmitting(true);
    try {
      // 1. Save or update the note
      const body = { title, content, date, type: noteType };
      let savedNoteId: string;

      if (note) {
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

      // 2. Upload selected screenshots
      if (selectedFiles.length > 0) {
        setUploadingScreenshot(true);
        for (const file of selectedFiles) {
          const formData = new FormData();
          formData.append("noteId", savedNoteId);
          formData.append("file", file);
          try {
            await fetch("/api/notes/screenshots", { method: "POST", body: formData });
          } catch {
            // Continue uploading other files even if one fails
          }
        }
        setUploadingScreenshot(false);
      }

      // 3. Save or update alert if enabled
      if (enableAlert && alertTitle && alertDate && alertTime) {
        const alertBody = {
          title: alertTitle,
          description: alertDescription || null,
          alertDate: `${alertDate}T${alertTime}:00`,
          noteId: savedNoteId,
        };

        // Check if there's an existing alert to update
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
        // If alert was disabled but existed before, delete it
        for (const a of existingAlerts) {
          await fetch(`/api/alerts/${a.id}`, { method: "DELETE" });
        }
      }

      toast.success(note ? (language === "fr" ? "Note modifiée" : "Note updated") : (language === "fr" ? "Note ajoutée" : "Note added"));
      onOpenChange(false);
      onSaved();
    } catch {
      toast.error("Error");
    }
    setIsSubmitting(false);
  };

  // Cleanup preview URLs on unmount
  React.useEffect(() => {
    return () => {
      previewUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
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

          {/* ─── Screenshot Upload ──────────────────────────── */}
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
                onChange={handleFileSelect}
              />
            </div>
            {/* Existing screenshots (when editing) */}
            {existingScreenshots.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {existingScreenshots.map((ss: any) => {
                  const src = ss.url.startsWith('http') ? ss.url : `/api/screenshots/${ss.url.replace('upload/screenshots/', '')}`;
                  return (
                    <div key={ss.id} className="group relative aspect-video rounded-lg overflow-hidden border border-border">
                      <img src={src} alt="Screenshot" className="w-full h-full object-cover" />
                      <button
                        onClick={() => handleRemoveExistingScreenshot(ss.id)}
                        className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
            {/* Newly selected files (preview before upload) */}
            {previewUrls.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {previewUrls.map((url, index) => (
                  <div key={`pending-${index}`} className="group relative aspect-video rounded-lg overflow-hidden border border-primary/30 bg-primary/5">
                    <img src={url} alt="Preview" className="w-full h-full object-cover" />
                    <button
                      onClick={() => handleRemovePendingFile(index)}
                      className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {existingScreenshots.length === 0 && previewUrls.length === 0 && (
              <p className="text-[10px] text-muted-foreground text-center py-2">
                {language === "fr" ? "Cliquez sur Ajouter pour sélectionner des captures" : "Click Add to select screenshots"}
              </p>
            )}
          </div>

          <Separator />

          {/* ─── Alert Section ────────────────────────────── */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-xs flex items-center gap-1.5">
                <Bell className="w-3.5 h-3.5" />
                {language === "fr" ? "Alerte" : "Alert"}
              </Label>
              <button
                onClick={() => setEnableAlert(!enableAlert)}
                className={cn(
                  "relative h-5 w-9 rounded-full transition-colors",
                  enableAlert ? "bg-primary" : "bg-muted"
                )}
              >
                <span
                  className={cn(
                    "absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform shadow-sm",
                    enableAlert ? "translate-x-4" : "translate-x-0.5"
                  )}
                />
              </button>
            </div>

            {enableAlert && (
              <div className="space-y-3 p-3 rounded-lg border border-primary/10 bg-primary/5">
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Titre de l'alerte" : "Alert Title"} *</Label>
                  <Input
                    value={alertTitle}
                    onChange={(e) => setAlertTitle(e.target.value)}
                    placeholder={language === "fr" ? "Ex: News NFP à 14h30" : "Ex: NFP News at 2:30 PM"}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{language === "fr" ? "Description" : "Description"}</Label>
                  <Textarea
                    value={alertDescription}
                    onChange={(e) => setAlertDescription(e.target.value)}
                    placeholder={language === "fr" ? "Détails de l'alerte..." : "Alert details..."}
                    rows={2}
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
