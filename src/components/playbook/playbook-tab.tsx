"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import {
  BookOpen,
  ExternalLink,
  Link2,
  Save,
  FileText,
  Pencil,
} from "lucide-react";

// ─── Playbook Tab (Notion Plan Link) ───────────────────────
// Lets the user add / edit their own Notion plan link and embeds
// it directly inside the application. The link is saved locally
// (per browser) so it persists between sessions without any
// external dependency.
const STORAGE_KEY = "donciel_notion_plan_url";
// Flag key: once set ("1"), the user has chosen their own link (even empty).
// Before that, we fall back to the default Notion plan link below.
const STORAGE_SET_FLAG = "donciel_notion_plan_url_set";

// Default Notion plan link (used on first visit, before the user
// customizes or removes it).
const DEFAULT_NOTION_URL =
  "https://habitual-soil-b8a.notion.site/LES-VARIABLES-DE-MON-PLAN-35f7944acd6580228856fbfb9e2179a9?pvs=149";

export function PlaybookTab() {
  const { language } = useAppStore();
  const isFr = language === "fr";

  const [savedUrl, setSavedUrl] = useState<string>("");
  const [draft, setDraft] = useState<string>("");
  const [editing, setEditing] = useState<boolean>(false);
  const [loaded, setLoaded] = useState(false);

  // Load the link from localStorage on mount. If the user has never
  // customized it, fall back to the default Notion plan link.
  useEffect(() => {
    try {
      const hasCustom = localStorage.getItem(STORAGE_SET_FLAG) === "1";
      const stored = hasCustom
        ? localStorage.getItem(STORAGE_KEY) || ""
        : DEFAULT_NOTION_URL;
      setSavedUrl(stored);
      setDraft(stored);
    } catch {
      setSavedUrl(DEFAULT_NOTION_URL);
      setDraft(DEFAULT_NOTION_URL);
    } finally {
      setLoaded(true);
    }
  }, []);

  const normalizeUrl = (raw: string): string => raw.trim();

  const handleSave = useCallback(() => {
    const url = normalizeUrl(draft);
    if (!url) {
      toast.error(
        isFr ? "Veuillez coller un lien Notion." : "Please paste a Notion link."
      );
      return;
    }
    try {
      new URL(url);
    } catch {
      toast.error(
        isFr ? "Le lien n'est pas valide." : "The link is not valid."
      );
      return;
    }
    try {
      localStorage.setItem(STORAGE_KEY, url);
      localStorage.setItem(STORAGE_SET_FLAG, "1");
    } catch {
      /* ignore storage errors */
    }
    setSavedUrl(url);
    setEditing(false);
    toast.success(
      isFr ? "Lien Notion enregistré." : "Notion link saved."
    );
  }, [draft, isFr]);

  const handleEdit = useCallback(() => {
    setDraft(savedUrl);
    setEditing(true);
  }, [savedUrl]);

  const handleCancel = useCallback(() => {
    setDraft(savedUrl);
    setEditing(false);
  }, [savedUrl]);

  const handleRemove = useCallback(() => {
    try {
      localStorage.setItem(STORAGE_KEY, "");
      localStorage.setItem(STORAGE_SET_FLAG, "1");
    } catch {
      /* ignore */
    }
    setSavedUrl("");
    setDraft("");
    setEditing(false);
    toast.success(
      isFr ? "Lien retiré." : "Link removed."
    );
  }, [isFr]);

  const hasLink = savedUrl.length > 0;

  // Try to extract a human-readable title from a Notion URL slug.
  // e.g. ".../LES-VARIABLES-DE-MON-PLAN-35f7944acd65..." -> "LES VARIABLES DE MON PLAN"
  const pageTitle = React.useMemo(() => {
    if (!savedUrl) return "";
    try {
      const u = new URL(savedUrl);
      const seg = u.pathname.split("/").filter(Boolean).pop() || "";
      // strip trailing 32-char hex id and query, then replace separators
      const cleaned = seg
        .replace(/-[a-f0-9]{32}(\?.*)?$/i, "")
        .replace(/-/g, " ")
        .trim();
      return cleaned || u.hostname;
    } catch {
      return "";
    }
  }, [savedUrl]);

  return (
    <div className="p-4 md:p-6 max-w-[1200px] mx-auto overflow-x-hidden">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {isFr ? "Mon Plan" : "My Plan"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isFr
              ? "Votre plan de trading — relié à Notion"
              : "Your trading plan — linked to Notion"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {hasLink && !editing && (
            <>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={handleEdit}
              >
                <Pencil className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {isFr ? "Modifier le lien" : "Edit link"}
                </span>
              </Button>
              <Button asChild size="sm" className="gap-1.5">
                <a
                  href={savedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden sm:inline">Notion</span>
                </a>
              </Button>
            </>
          )}
          {!hasLink && !editing && (
            <Button
              size="sm"
              className="gap-1.5"
              onClick={() => {
                setDraft("");
                setEditing(true);
              }}
            >
              <Link2 className="w-4 h-4" />
              {isFr ? "Ajouter le lien Notion" : "Add Notion link"}
            </Button>
          )}
        </div>
      </div>

      {/* ─── Edit / Add bar ─────────────────────────── */}
      {editing && (
        <Card className="p-4 mb-4 border-dashed">
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Link2 className="w-4 h-4 text-primary" />
              {isFr
                ? "Collez le lien de votre page Notion"
                : "Paste the link of your Notion page"}
            </div>
            <Input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="https://www.notion.so/..."
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSave();
                if (e.key === "Escape") handleCancel();
              }}
            />
            <div className="flex items-center justify-between flex-wrap gap-2">
              <p className="text-xs text-muted-foreground">
                {isFr
                  ? "Assurez-vous que la page Notion est partagée publiquement pour qu'elle s'affiche ici."
                  : "Make sure the Notion page is shared publicly so it displays here."}
              </p>
              <div className="flex items-center gap-2">
                {hasLink && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={handleRemove}
                  >
                    {isFr ? "Retirer" : "Remove"}
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={handleCancel}>
                  {isFr ? "Annuler" : "Cancel"}
                </Button>
                <Button size="sm" className="gap-1.5" onClick={handleSave}>
                  <Save className="w-4 h-4" />
                  {isFr ? "Enregistrer" : "Save"}
                </Button>
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* ─── Content ────────────────────────────────── */}
      {!loaded ? (
        <Card className="p-6">
          <div className="h-[60vh] animate-pulse rounded-md bg-muted/40" />
        </Card>
      ) : hasLink && !editing ? (
        <Card className="overflow-hidden border shadow-sm">
          {/* ── Notion-style banner ── */}
          <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border-b px-6 py-8 sm:px-8 sm:py-10">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-background border flex items-center justify-center shrink-0 shadow-sm">
                <BookOpen className="w-6 h-6 sm:w-7 sm:h-7 text-primary" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-1">
                  Notion
                </p>
                <h3 className="text-xl sm:text-2xl font-bold leading-tight break-words">
                  {pageTitle || (isFr ? "Mon Plan de Trading" : "My Trading Plan")}
                </h3>
                <p className="text-xs text-muted-foreground mt-2 break-all">
                  {savedUrl}
                </p>
              </div>
            </div>
          </div>

          {/* ── Action area ── */}
          <div className="px-6 py-6 sm:px-8 sm:py-7">
            <div className="flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
              <div className="flex items-start gap-2.5 text-sm text-muted-foreground">
                <FileText className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {isFr
                    ? "Votre plan s'ouvre dans Notion. Cliquez ci-dessous pour y accéder."
                    : "Your plan opens in Notion. Click below to access it."}
                </span>
              </div>
              <Button asChild size="lg" className="gap-2 shrink-0">
                <a
                  href={savedUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <ExternalLink className="w-4 h-4" />
                  {isFr ? "Ouvrir dans Notion" : "Open in Notion"}
                </a>
              </Button>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-0 overflow-hidden">
          <div className="flex flex-col items-center justify-center text-center px-6 py-16 sm:py-24">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <FileText className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold">
              {isFr
                ? "Aucun plan relié pour le moment"
                : "No plan linked yet"}
            </h3>
            <p className="text-sm text-muted-foreground mt-2 max-w-md">
              {isFr
                ? "Ajoutez le lien de votre page Notion pour afficher votre plan de trading directement ici."
                : "Add the link to your Notion page to display your trading plan directly here."}
            </p>
            <Button
              className="mt-5 gap-1.5"
              onClick={() => {
                setDraft("");
                setEditing(true);
              }}
            >
              <Link2 className="w-4 h-4" />
              {isFr ? "Ajouter le lien Notion" : "Add Notion link"}
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
