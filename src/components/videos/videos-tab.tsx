"use client";

import React, { useState, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useVideos } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Video,
  Plus,
  Play,
  Trash2,
  FolderOpen,
  Upload,
  Lock,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

const VIDEO_CATEGORIES = [
  { id: "STRUCTURE", label_fr: "Structure du Marché", label_en: "Market Structure", icon: "📊" },
  { id: "BIAIS", label_fr: "Définir le Biais", label_en: "Define Bias", icon: "🎯" },
  { id: "ZONES", label_fr: "Zones de Valeur", label_en: "Value Zones", icon: "📍" },
  { id: "MODELS", label_fr: "Modèles d'Entrées", label_en: "Entry Models", icon: "🔀" },
  { id: "SETUPS", label_fr: "Setups", label_en: "Setups", icon: "⚡" },
];

export function VideosTab() {
  const { user, language } = useAppStore();
  const isAdmin = user?.role === "admin";
  const { videos, loading, refetch } = useVideos();

  // Fetch on mount
  React.useEffect(() => { refetch(); }, [refetch]);
  const [activeCategory, setActiveCategory] = useState<string>("STRUCTURE");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<string | null>(null);

  const filteredVideos = videos.filter((v: any) => v.category === activeCategory);

  const handleDelete = async (id: string) => {
    if (!confirm(language === "fr" ? "Supprimer cette vidéo ?" : "Delete this video?")) return;
    try {
      const res = await fetch(`/api/videos/${id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(language === "fr" ? "Vidéo supprimée" : "Video deleted");
        refetch();
      } else {
        toast.error(language === "fr" ? "Erreur" : "Error");
      }
    } catch {
      toast.error(language === "fr" ? "Erreur" : "Error");
    }
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald bg-clip-text text-transparent">
            {t(language, "setupVideos")}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr" ? "Vidéos éducatives du Setup DONCIEL" : "DONCIEL Setup educational videos"}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={() => setShowAddDialog(true)} className="gap-2">
            <Plus className="w-4 h-4" />
            {t(language, "addVideo")}
          </Button>
        )}
      </div>

      {/* Category Folders */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
        {VIDEO_CATEGORIES.map((cat) => {
          const count = videos.filter((v: any) => v.category === cat.id).length;
          const isActive = activeCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "p-4 rounded-xl border-2 transition-all duration-200 text-center",
                isActive
                  ? "border-primary bg-primary/10 shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/30 bg-card"
              )}
            >
              <div className="text-2xl mb-2">{cat.icon}</div>
              <div className="text-sm font-semibold truncate">
                {language === "fr" ? cat.label_fr : cat.label_en}
              </div>
              <Badge variant="secondary" className="text-[10px] mt-2">
                {count} {language === "fr" ? "vidéo" : "video"}{count !== 1 ? "s" : ""}
              </Badge>
            </button>
          );
        })}
      </div>

      {/* Video Grid */}
      <div>
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="p-4"><Skeleton className="h-40 w-full mb-3" /><Skeleton className="h-4 w-3/4" /></Card>
            ))}
          </div>
        ) : filteredVideos.length === 0 ? (
          <Card className="p-12 text-center">
            <FolderOpen className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
            <p className="text-muted-foreground">
              {language === "fr" ? "Aucune vidéo dans cette catégorie" : "No videos in this category"}
            </p>
            {isAdmin && (
              <Button onClick={() => setShowAddDialog(true)} variant="outline" className="mt-4 gap-2">
                <Plus className="w-4 h-4" />
                {t(language, "addVideo")}
              </Button>
            )}
          </Card>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredVideos.map((video: any) => (
              <Card key={video.id} className="overflow-hidden group">
                {/* Video thumbnail / player */}
                <div
                  className="relative h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center cursor-pointer"
                  onClick={() => setPlayingVideo(video.id === playingVideo ? null : video.id)}
                >
                  <Play className="w-12 h-12 text-primary/60 group-hover:text-primary transition-colors" />
                  {isAdmin && (
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={(e) => { e.stopPropagation(); handleDelete(video.id); }}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
                <div className="p-4">
                  <h4 className="font-semibold text-sm truncate">{video.title}</h4>
                  {video.description && (
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{video.description}</p>
                  )}
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">
                      {new Date(video.createdAt).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}
                    </Badge>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Read-only notice for non-admins */}
      {!isAdmin && videos.length > 0 && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Lock className="w-3 h-3" />
          {language === "fr" ? "Lecture seule — Seuls les administrateurs peuvent modifier" : "Read only — Only admins can modify"}
        </div>
      )}

      {/* Add Video Dialog */}
      <AddVideoDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        category={activeCategory}
        language={language}
        onVideoAdded={refetch}
      />
    </div>
  );
}

function AddVideoDialog({
  open,
  onOpenChange,
  category,
  language,
  onVideoAdded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category: string;
  language: "fr" | "en";
  onVideoAdded: () => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [selectedCategory, setSelectedCategory] = useState(category);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleSubmit = async () => {
    if (!title || !file) {
      toast.error(language === "fr" ? "Titre et fichier requis" : "Title and file required");
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(0);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("title", title);
      fd.append("description", description);
      fd.append("category", selectedCategory);

      // Use the upload mini-service for streaming large file support (up to 500MB)
      const res = await new Promise<Response>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("POST", "/upload/video?XTransformPort=3031");
        xhr.withCredentials = true;

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable) {
            const pct = Math.round((e.loaded / e.total) * 100);
            setUploadProgress(pct);
          }
        };

        xhr.onload = () => {
          const response = new Response(xhr.responseText, {
            status: xhr.status,
            statusText: xhr.statusText,
            headers: new Headers({ "Content-Type": "application/json" }),
          });
          resolve(response);
        };

        xhr.onerror = () => reject(new Error("Upload failed"));
        xhr.send(fd);
      });

      if (res.ok) {
        toast.success(language === "fr" ? "Vidéo ajoutée !" : "Video added!");
        onOpenChange(false);
        setTitle("");
        setDescription("");
        setFile(null);
        setUploadProgress(0);
        onVideoAdded();
      } else {
        const data = await res.json();
        toast.error(data.error || "Error");
      }
    } catch {
      toast.error(language === "fr" ? "Erreur lors de l'upload" : "Upload failed");
    }
    setIsSubmitting(false);
    setUploadProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Video className="w-5 h-5 text-primary" />
            {t(language, "addVideo")}
          </DialogTitle>
          <DialogDescription>
            {language === "fr" ? "Ajouter une vidéo au Setup DONCIEL (max 500 Mo)" : "Add a video to DONCIEL Setup (max 500 MB)"}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs">{t(language, "videoTitle")} *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Titre" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Catégorie</Label>
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {VIDEO_CATEGORIES.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.icon} {language === "fr" ? cat.label_fr : cat.label_en}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t(language, "videoDescription")}</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Description" rows={3} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{language === "fr" ? "Fichier vidéo" : "Video file"} *</Label>
            <Input type="file" accept="video/*" onChange={(e) => setFile(e.target.files?.[0] || null)} />
            {file && (
              <p className="text-[10px] text-muted-foreground mt-1">
                {(file.size / 1024 / 1024).toFixed(1)} Mo
                {file.size > 500 * 1024 * 1024 && (
                  <span className="text-red-500 ml-1">
                    {language === "fr" ? "(dépasse 500 Mo !)" : "(exceeds 500 MB!)"}
                  </span>
                )}
              </p>
            )}
          </div>
          {isSubmitting && uploadProgress > 0 && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{language === "fr" ? "Upload en cours..." : "Uploading..."}</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>{t(language, "cancel")}</Button>
          <Button onClick={handleSubmit} disabled={isSubmitting || (!!file && file.size > 500 * 1024 * 1024)}>
            {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4 mr-1" />}
            {t(language, "save")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
