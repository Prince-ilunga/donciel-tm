"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, ExternalLink, Loader2, Info } from "lucide-react";

// ─── Notion Plan URL ────────────────────────────────────────
// The user's complete trading plan hosted on Notion.
const NOTION_PLAN_URL =
  "https://www.notion.so/LES-VARIABLES-DE-MON-PLAN-35f7944acd6580228856fbfb9e2179a9";

// ─── Playbook Tab (Notion Embed) ────────────────────────────
// The entire previous playbook CRUD interface has been replaced by a
// clean embed of the user's complete Notion trading plan.
export function PlaybookTab() {
  const { language } = useAppStore();
  const [loaded, setLoaded] = useState(false);
  const isFr = language === "fr";

  // Safety: hide the loading spinner after 6s even if onLoad doesn't fire
  // (happens when the iframe is cross-origin / blocked by X-Frame-Options).
  useEffect(() => {
    if (loaded) return;
    const t = setTimeout(() => setLoaded(true), 6000);
    return () => clearTimeout(t);
  }, [loaded]);

  return (
    <div className="p-4 md:p-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* ─── Header ──────────────────────────────────── */}
      <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-primary" />
            {isFr ? "Mon Plan Complet" : "My Complete Plan"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isFr
              ? "Les variables de mon plan — intégré depuis Notion"
              : "My plan variables — integrated from Notion"}
          </p>
        </div>
        <Button asChild variant="outline" className="gap-2">
          <a
            href={NOTION_PLAN_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink className="w-4 h-4" />
            {isFr ? "Ouvrir dans Notion" : "Open in Notion"}
          </a>
        </Button>
      </div>

      {/* ─── Info note (Notion page must be shared publicly) ─── */}
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 mb-4">
        <Info className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isFr
            ? "Si le plan ne s'affiche pas ci-dessous, assurez-vous que la page Notion est partagée publiquement (« Partager → Partager sur le web »). Vous pouvez aussi cliquer sur « Ouvrir dans Notion » pour la consulter directement."
            : "If the plan doesn't display below, make sure the Notion page is shared publicly (« Share → Share to web »). You can also click « Open in Notion » to view it directly."}
        </p>
      </div>

      {/* ─── Notion Embed ────────────────────────────── */}
      <Card className="overflow-hidden border-border relative">
        {/* Loading overlay shown until the iframe finishes loading */}
        {!loaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-background">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">
              {isFr ? "Chargement du plan…" : "Loading plan…"}
            </p>
          </div>
        )}
        <iframe
          src={NOTION_PLAN_URL}
          title={isFr ? "Mon Plan de Trading" : "My Trading Plan"}
          className="w-full"
          style={{ height: "calc(100vh - 14rem)", minHeight: "600px" }}
          onLoad={() => setLoaded(true)}
          loading="lazy"
          allowFullScreen
        />
      </Card>
    </div>
  );
}
