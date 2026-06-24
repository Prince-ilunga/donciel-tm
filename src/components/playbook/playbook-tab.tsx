"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BookOpen, ExternalLink, RefreshCw, AlertTriangle } from "lucide-react";

// ─── Playbook Tab (Notion Plan Integration) ────────────────
// Fetches the user's complete Notion trading plan via our backend API
// (which uses notion-client to read the public page) and renders it as
// native, styled HTML. Images are proxied through /api/playbook/image.
export function PlaybookTab() {
  const { language } = useAppStore();
  const isFr = language === "fr";
  const [html, setHtml] = useState<string>("");
  const [title, setTitle] = useState<string>("");
  const [notionUrl, setNotionUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchPlan = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/playbook/plan", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Failed to load plan");
      }
      setHtml(data.html);
      setTitle(data.title);
      setNotionUrl(data.notionUrl);
    } catch (err: any) {
      setError(err?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPlan();
  }, [fetchPlan]);

  return (
    <div className="p-4 md:p-6 max-w-[1100px] mx-auto overflow-x-hidden">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {isFr ? "Mon Plan Complet" : "My Complete Plan"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isFr
              ? "Les variables de mon plan — synchronisé depuis Notion"
              : "My plan variables — synced from Notion"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={fetchPlan}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
            <span className="hidden sm:inline">
              {isFr ? "Actualiser" : "Refresh"}
            </span>
          </Button>
          {notionUrl && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <a href={notionUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
                <span className="hidden sm:inline">
                  {isFr ? "Notion" : "Notion"}
                </span>
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* ─── Content ─────────────────────────────────── */}
      {loading ? (
        <Card className="p-6 space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/6" />
          <Skeleton className="h-32 w-full" />
        </Card>
      ) : error ? (
        <Card className="p-6 flex flex-col items-center gap-3 text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500" />
          <p className="text-sm font-medium text-foreground">
            {isFr
              ? "Impossible de charger le plan."
              : "Could not load the plan."}
          </p>
          <p className="text-xs text-muted-foreground max-w-md">{error}</p>
          <Button variant="outline" size="sm" className="gap-1.5" onClick={fetchPlan}>
            <RefreshCw className="w-4 h-4" />
            {isFr ? "Réessayer" : "Retry"}
          </Button>
        </Card>
      ) : (
        <Card className="p-5 md:p-8">
          <article
            className="notion-plan-content"
            // HTML is generated server-side from the user's own Notion page
            // (trusted source) with all text escaped. Safe to inject.
            dangerouslySetInnerHTML={{ __html: html }}
          />
        </Card>
      )}
    </div>
  );
}
