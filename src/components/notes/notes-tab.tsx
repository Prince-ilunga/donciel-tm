"use client";

import React, { useState, useCallback } from "react";
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
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

const NOTE_TYPES = [
  { id: "DAY", label_fr: "Journée de Trading", label_en: "Trading Day", icon: Sun, color: "text-gold" },
  { id: "WEEK", label_fr: "Semaine de Trading", label_en: "Trading Week", icon: CalendarDays, color: "text-primary" },
  { id: "MONTH", label_fr: "Mois de Trading", label_en: "Trading Month", icon: CalendarRange, color: "text-profit" },
];

export function NotesTab() {
  const { language } = useAppStore();
  const [activeType, setActiveType] = useState<string>("DAY");
  const { notes, loading, refetch } = useNotes(activeType);

  // Fetch on mount
  React.useEffect(() => { refetch(); }, [refetch]);
  const [showDialog, setShowDialog] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);

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
        <Button onClick={handleAdd} className="gap-2">
          <Plus className="w-4 h-4" />
          {t(language, "addNote")}
        </Button>
      </div>

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
              <Card key={note.id} className="p-4 hover:border-primary/30 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-semibold text-sm truncate">{note.title}</h4>
                      <Badge variant="outline" className="text-[10px] shrink-0">
                        {new Date(note.date).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap line-clamp-4">{note.content}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleEdit(note)}>
                      <Edit3 className="w-3.5 h-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-loss" onClick={() => handleDelete(note.id)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
        </div>
      )}

      {/* Add/Edit Note Dialog */}
      <NoteDialog
        open={showDialog}
        onOpenChange={setShowDialog}
        note={editingNote}
        type={activeType}
        language={language}
        onSaved={refetch}
      />
    </div>
  );
}

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

  React.useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title || "");
        setContent(note.content || "");
        setDate(note.date ? format(new Date(note.date), "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd"));
        setNoteType(note.type || type);
      } else {
        setTitle("");
        setContent("");
        setDate(format(new Date(), "yyyy-MM-dd"));
        setNoteType(type);
      }
    }
  }, [open, note, type]);

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
                    <Icon className="w-3.5 h-3.5" />
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
              className="resize-y"
            />
          </div>
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
