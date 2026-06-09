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

  // Helper to get the correct video URL (R2 or local)
  const getVideoUrl = (url: string) => {
    if (!url) return '';
    // If it's already a full URL (R2 public URL), use directly
    if (url.startsWith('http://') || url.startsWith('https://')) return url;
    // If it's a local path, serve via API streaming route
    if (url.startsWith('upload/videos/')) {
      const key = url.replace('upload/', '');
      return `/api/videos/stream?key=${encodeURIComponent(key)}`;
    }
    // Fallback: old-style local path
    return `/${url}`;
  };

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
                {playingVideo === video.id ? (
                  <div className="relative bg-black">
                    <video
                      src={getVideoUrl(video.url)}
                      controls
                      autoPlay
                      className="w-full h-40 object-contain"
                    />
                    {isAdmin && (
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7"
                        onClick={(e) => { e.stopPropagation(); handleDelete(video.id); }}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <div
                    className="relative h-40 bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center cursor-pointer"
                    onClick={() => setPlayingVideo(video.id)}
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
                )}
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

const CHUNK_SIZE = 5 * 1024 * 1024; // 5 MB per chunk (smaller = more reliable on slow connections)

/** Upload a single chunk via XHR to get real-time progress events */
function uploadChunkViaXHR(
  fd: FormData,
  onProgress: (pct: number) => void
): Promise<{ ok: boolean; status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    // Use XTransformPort=3000 to route through Caddy's zero-timeout handler
    xhr.open("POST", "/api/videos/upload/chunk?XTransformPort=3000");
    xhr.withCredentials = true;

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };

    xhr.onload = () => {
      let data: any = null;
      try { data = JSON.parse(xhr.responseText); } catch {}
      resolve({ ok: xhr.status >= 200 && xhr.status < 300, status: xhr.status, data });
    };

    xhr.onerror = () => reject(new Error("Network error"));
    xhr.ontimeout = () => reject(new Error("Request timed out"));
    xhr.timeout = 15 * 60 * 1000; // 15 min timeout per chunk (for slow connections)

    xhr.send(fd);
  });
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
  const [uploadStatus, setUploadStatus] = useState("");

  const handleSubmit = async () => {
    if (!title || !file) {
      toast.error(language === "fr" ? "Titre et fichier requis" : "Title and file required");
      return;
    }
    setIsSubmitting(true);
    setUploadProgress(0);

    const totalChunks = Math.ceil(file.size / CHUNK_SIZE);

    try {
      // Step 1: Initialize chunked upload (via XTransformPort for zero timeout)
      setUploadStatus(language === "fr" ? "Initialisation..." : "Initializing...");
      const initRes = await fetch("/api/videos/upload/init?XTransformPort=3000", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: file.name,
          totalSize: file.size,
          totalChunks,
          category: selectedCategory,
          title,
          description,
        }),
      });

      if (!initRes.ok) {
        const data = await initRes.json();
        throw new Error(data.error || "Init failed");
      }

      const { uploadId } = await initRes.json();

      // Step 2: Upload each chunk using XHR for real-time progress
      for (let i = 0; i < totalChunks; i++) {
        const start = i * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, file.size);
        const chunkBlob = file.slice(start, end);

        setUploadStatus(
          language === "fr"
            ? `Upload du morceau ${i + 1}/${totalChunks}...`
            : `Uploading chunk ${i + 1}/${totalChunks}...`
        );

        const fd = new FormData();
        fd.append("uploadId", uploadId);
        fd.append("chunkIndex", i.toString());
        fd.append("chunk", chunkBlob, file.name);

        // Upload chunk with retry (up to 3 attempts) using XHR
        let chunkSuccess = false;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            const result = await uploadChunkViaXHR(fd, (chunkPct) => {
              // Progress for this chunk = base progress + (chunk progress / total chunks)
              const basePct = Math.round((i / totalChunks) * 100);
              const chunkContrib = Math.round((chunkPct / 100) * (100 / totalChunks));
              setUploadProgress(Math.min(basePct + chunkContrib, 99));
            });

            if (result.ok) {
              chunkSuccess = true;
              break;
            }

            if (attempt === 3) {
              throw new Error(result.data?.error || `Chunk ${i + 1} failed (HTTP ${result.status})`);
            }
          } catch (err: any) {
            if (attempt === 3) throw err;
            // Wait before retry (exponential backoff)
            setUploadStatus(
              language === "fr"
                ? `Nouvel essai morceau ${i + 1} (tentative ${attempt + 1}/3)...`
                : `Retrying chunk ${i + 1} (attempt ${attempt + 1}/3)...`
            );
            await new Promise((r) => setTimeout(r, 1000 * attempt));
          }
        }

        if (!chunkSuccess) {
          throw new Error(`Chunk ${i + 1} failed after 3 attempts`);
        }

        // Update progress after chunk completes
        const pct = Math.round(((i + 1) / totalChunks) * 100);
        setUploadProgress(pct);
      }

      // Step 3: Complete the upload (assemble chunks on server)
      setUploadStatus(language === "fr" ? "Assemblage de la vidéo..." : "Assembling video...");
      setUploadProgress(100);
      const completeRes = await fetch("/api/videos/upload/complete?XTransformPort=3000", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uploadId }),
      });

      if (!completeRes.ok) {
        const data = await completeRes.json();
        throw new Error(data.error || "Assembly failed");
      }

      toast.success(language === "fr" ? "Vidéo ajoutée !" : "Video added!");
      onOpenChange(false);
      setTitle("");
      setDescription("");
      setFile(null);
      setUploadProgress(0);
      setUploadStatus("");
      onVideoAdded();
    } catch (err: any) {
      toast.error(err.message || (language === "fr" ? "Erreur lors de l'upload" : "Upload failed"));
    }
    setIsSubmitting(false);
    // Don't reset progress immediately so user can see where it failed
    setTimeout(() => {
      setUploadProgress(0);
      setUploadStatus("");
    }, 3000);
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
          {isSubmitting && (
            <div className="space-y-1">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{uploadStatus || (language === "fr" ? "Upload en cours..." : "Uploading...")}</span>
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
