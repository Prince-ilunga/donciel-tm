"use client";

import { useEffect, useState } from "react";
import { useAppStore, TabId } from "@/stores/app-store";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Wallet,
  BookOpen,
  PenLine,
  CheckCircle2,
  X,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface OnboardingStatus {
  hasCapital: boolean;
  hasPlaybook: boolean;
  hasTrade: boolean;
  tradeCount: number;
  playbookCount: number;
}

const STORAGE_KEY = "donciel-onboarding-dismissed";

/**
 * Checklist de démarrage affichée sur le tableau de bord des
 * nouveaux utilisateurs. L'état est déduit des données réelles
 * (capital configuré, playbook créé, trade journalisé) — pas
 * besoin de migration ni de flag en base.
 */
export function OnboardingChecklist() {
  const { user, setActiveTab } = useAppStore();
  const [status, setStatus] = useState<OnboardingStatus | null>(null);
  const [visible, setVisible] = useState(false);
  const [hiding, setHiding] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (localStorage.getItem(STORAGE_KEY) === "1") return;
        const res = await fetch("/api/onboarding/status");
        if (!res.ok) return;
        const data: OnboardingStatus = await res.json();
        if (cancelled) return;
        // Tout est complété → fermer définitivement
        if (data.hasCapital && data.hasPlaybook && data.hasTrade) {
          localStorage.setItem(STORAGE_KEY, "1");
          return;
        }
        setStatus(data);
        setVisible(true);
      } catch {
        /* silencieux */
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [user]);

  function dismiss() {
    setHiding(true);
    localStorage.setItem(STORAGE_KEY, "1");
    setTimeout(() => setVisible(false), 200);
  }

  if (!visible || !status || user?.email === "demo@donciel.tm") return null;

  const steps: {
    done: boolean;
    icon: typeof Wallet;
    title: string;
    desc: string;
    tab: TabId;
    cta: string;
  }[] = [
    {
      done: status.hasCapital,
      icon: Wallet,
      title: "Configure ton money management",
      desc: "Capital de départ, risque par trade, pertes max — la fondation de ta discipline.",
      tab: "money",
      cta: "Configurer",
    },
    {
      done: status.hasPlaybook,
      icon: BookOpen,
      title: "Crée ton premier playbook",
      desc: "Tes règles d'entrée ICT par écrit : le document qui rend ton edge reproductible.",
      tab: "playbook",
      cta: "Créer",
    },
    {
      done: status.hasTrade,
      icon: PenLine,
      title: "Journalise ton premier trade",
      desc: "Setup, émotions, captures d'écran — chaque trade noté est une leçon capitalisée.",
      tab: "journal",
      cta: "Journaliser",
    },
  ];

  const doneCount = steps.filter((s) => s.done).length;
  const progress = Math.round((doneCount / steps.length) * 100);

  return (
    <Card
      className={cn(
        "p-5 mb-6 border border-border/70 bg-gradient-to-br from-card to-card/60 transition-opacity duration-200",
        hiding && "opacity-0"
      )}
      aria-label="Checklist de démarrage"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-base">
            Bienvenue{user?.name ? `, ${user.name}` : ""} 👋 — démarre du bon pied
          </h3>
          <p className="text-sm text-muted-foreground mt-1">
            3 étapes pour transformer DONCIEL™ en machine à progresser.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-2" aria-live="polite">
            <div
              className="w-24 h-1.5 rounded-full bg-muted overflow-hidden"
              role="progressbar"
              aria-valuenow={progress}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div
                className="h-full bg-emerald-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
              />
            </div>
            <span className="text-xs text-muted-foreground tabular-nums">
              {doneCount}/{steps.length}
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={dismiss}
            aria-label="Fermer la checklist"
          >
            <X className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-3">
        {steps.map((step, i) => {
          const Icon = step.done ? CheckCircle2 : step.icon;
          return (
            <div
              key={i}
              className={cn(
                "rounded-lg border p-4 flex flex-col gap-2 transition-colors",
                step.done
                  ? "border-emerald-500/30 bg-emerald-500/[0.04]"
                  : "border-border bg-background/40 hover:border-primary/40"
              )}
            >
              <div className="flex items-center gap-2">
                <Icon
                  className={cn(
                    "w-4 h-4 shrink-0",
                    step.done ? "text-emerald-500" : "text-primary"
                  )}
                  aria-hidden
                />
                <span className="text-sm font-medium leading-snug">
                  {step.title}
                </span>
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed flex-1">
                {step.desc}
              </p>
              {step.done ? (
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Terminé
                </span>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="w-fit h-8 text-xs gap-1.5"
                  onClick={() => setActiveTab(step.tab)}
                >
                  {step.cta}
                  <ArrowRight className="w-3 h-3" />
                </Button>
              )}
            </div>
          );
        })}
      </div>
    </Card>
  );
}
