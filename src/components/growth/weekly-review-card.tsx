'use client';

import { useCallback, useMemo, useState } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';
import { CalendarRange, Crown, Loader2, NotebookPen, RefreshCw, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppStore } from '@/stores/app-store';

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Revue hebdomadaire IA (Pack 4 — Croissance & Rétention)
// Self-contained : appelle /api/coach/weekly-review puis permet
// d'enregistrer la revue comme note type WEEK (/api/notes).
// ─────────────────────────────────────────────────────────────

export interface WeeklyReviewCardProps {
  onSaved?: () => void;
}

function mondayOfThisWeek(): Date {
  const now = new Date();
  const day = now.getDay() === 0 ? 7 : now.getDay();
  const monday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (day - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function WeeklyReviewCard({ onSaved }: WeeklyReviewCardProps) {
  const language = useAppStore((s) => s.language);
  const fr = language === 'fr';

  const [review, setReview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [quotaExceeded, setQuotaExceeded] = useState(false);

  const weekRange = useMemo(() => {
    const monday = mondayOfThisWeek();
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d: Date) =>
      d.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: 'numeric', month: 'short' });
    return `${fmt(monday)} → ${fmt(sunday)}`;
  }, [fr]);

  const generate = useCallback(async () => {
    setLoading(true);
    setQuotaExceeded(false);
    try {
      const res = await fetch('/api/coach/weekly-review', { method: 'POST' });
      const data = (await res.json().catch(() => ({}))) as { review?: string; error?: string };

      if (res.status === 402) {
        setQuotaExceeded(true);
        toast.error(data.error || (fr ? 'Quota Coach IA atteint' : 'AI Coach quota reached'));
        return;
      }
      if (res.status === 400) {
        toast.error(data.error || (fr ? 'Aucun trade cette semaine' : 'No trades this week'));
        return;
      }
      if (!res.ok || !data.review) {
        toast.error(data.error || (fr ? 'Échec de la génération' : 'Generation failed'));
        return;
      }
      setReview(data.review);
      toast.success(fr ? 'Revue générée ✨' : 'Review generated ✨');
    } catch {
      toast.error(fr ? 'Erreur réseau — réessaie' : 'Network error — try again');
    } finally {
      setLoading(false);
    }
  }, [fr]);

  const saveToNotes = useCallback(async () => {
    if (!review) return;
    setSaving(true);
    try {
      const monday = mondayOfThisWeek();
      const res = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'WEEK',
          title: fr ? `Revue hebdo IA — ${weekRange}` : `AI Weekly review — ${weekRange}`,
          content: review,
          date: monday.toISOString(),
        }),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        toast.error(data.error || (fr ? "Échec de l'enregistrement" : 'Failed to save'));
        return;
      }
      toast.success(fr ? 'Revue enregistrée dans tes notes ✅' : 'Review saved to your notes ✅');
      onSaved?.();
    } catch {
      toast.error(fr ? 'Erreur réseau — réessaie' : 'Network error — try again');
    } finally {
      setSaving(false);
    }
  }, [review, weekRange, fr, onSaved]);

  return (
    <Card className="border-sky-500/20 bg-gradient-to-br from-sky-500/[0.04] to-transparent">
      <CardHeader className="pb-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2 text-base font-semibold">
              <Sparkles className="size-4 text-sky-400" />
              {fr ? 'Revue de la semaine IA' : 'AI Weekly Review'}
            </CardTitle>
            <CardDescription className="flex items-center gap-1.5 text-xs">
              <CalendarRange className="size-3.5" />
              {weekRange}
            </CardDescription>
          </div>
          <Button
            onClick={generate}
            disabled={loading}
            size="sm"
            className="h-11 min-w-[128px] gap-2 bg-sky-500 text-white hover:bg-sky-600"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin" />
            ) : review ? (
              <RefreshCw className="size-4" />
            ) : (
              <Sparkles className="size-4" />
            )}
            {loading
              ? fr
                ? 'Génération…'
                : 'Generating…'
              : review
                ? fr
                  ? 'Régénérer'
                  : 'Regenerate'
                : fr
                  ? 'Générer'
                  : 'Generate'}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {loading ? (
          <div className="space-y-2.5" aria-busy="true" aria-live="polite">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-11/12" />
            <Skeleton className="h-3 w-4/5" />
            <Skeleton className="mt-4 h-4 w-1/4" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        ) : review ? (
          <div
            className="max-h-96 overflow-y-auto pr-1 text-sm leading-relaxed text-foreground/90
              [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-sm [&_h2]:font-semibold [&_h2]:text-sky-300
              [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:font-semibold
              [&_li]:my-0.5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5
              [&_p]:my-1.5 [&_strong]:font-semibold [&_strong]:text-foreground
              [&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5"
          >
            <ReactMarkdown>{review}</ReactMarkdown>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            {fr
              ? 'Génère un bilan IA de ta semaine : chiffres clés, patterns détectés, zones de vigilance et plan concret pour la semaine prochaine.'
              : 'Generate an AI review of your week: key numbers, detected patterns, watch-outs and a concrete plan for next week.'}
          </p>
        )}
      </CardContent>

      <CardFooter className="flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        {quotaExceeded ? (
          <Button asChild size="sm" variant="outline" className="h-11 gap-2 border-amber-500/40 text-amber-400 hover:bg-amber-500/10">
            <Link href="/abonnement">
              <Crown className="size-4" />
              {fr ? 'Passer à Pro pour plus de crédits IA' : 'Upgrade to Pro for more AI credits'}
            </Link>
          </Button>
        ) : (
          <span className="text-xs text-muted-foreground">
            {fr
              ? 'Basée uniquement sur les trades journalisés cette semaine.'
              : 'Based only on the trades journaled this week.'}
          </span>
        )}
        <Button
          onClick={saveToNotes}
          disabled={!review || saving}
          size="sm"
          variant="outline"
          className="h-11 w-full gap-2 sm:w-auto"
        >
          <NotebookPen className="size-4" />
          {saving
            ? fr
              ? 'Enregistrement…'
              : 'Saving…'
            : fr
              ? 'Enregistrer dans mes notes'
              : 'Save to my notes'}
        </Button>
      </CardFooter>
    </Card>
  );
}

export default WeeklyReviewCard;
