"use client";

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Onglet Communauté (leaderboard, Pack 3)
// Classement discipline (Score DONCIEL) des 30 derniers jours.
// Réservé au plan Elite (gating 402 côté API).
// ─────────────────────────────────────────────────────────────

import { useCallback, useEffect, useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { GRADE_COLORS, Grade, ScoreGradeBadge } from "@/components/discipline/score-ui";
import { CheckCircle2, Crown, Flame, Lock, RefreshCw, ShieldCheck, Trophy, Users, WifiOff } from "lucide-react";

// ─── Types ───────────────────────────────────────────────────

interface LeaderboardRow {
  rank: number;
  name: string;
  isSelf: boolean;
  plan: string;
  score: number;
  winRate: number;
  totalRR: number;
  tradesCount: number;
  grade: Grade;
}

interface MeSummary {
  rank: number | null;
  qualified: boolean;
  name: string;
  score: number;
  winRate: number;
  totalRR: number;
  tradesCount: number;
  grade: Grade;
}

interface LeaderboardData {
  leaderboard: LeaderboardRow[];
  me: MeSummary | null;
  meta: {
    minTrades: number;
    periodDays: number;
    totalQualified: number;
    generatedAt: string;
  };
}

type LoadStatus = "loading" | "locked" | "ready" | "empty" | "error";

type LeaderboardResult =
  | { kind: "locked"; plan: string | null }
  | { kind: "ok"; data: LeaderboardData }
  | { kind: "error" };

/** Appel API pur (sans setState) — réutilisé par le chargement initial et le retry. */
async function fetchLeaderboard(): Promise<LeaderboardResult> {
  try {
    const res = await fetch("/api/leaderboard");
    if (res.status === 402) {
      const body = (await res.json().catch(() => ({}))) as { currentPlan?: string };
      return { kind: "locked", plan: body.currentPlan ?? null };
    }
    if (!res.ok) return { kind: "error" };
    const data = (await res.json()) as LeaderboardData;
    return { kind: "ok", data };
  } catch {
    return { kind: "error" };
  }
}

const MEDALS = ["🥇", "🥈", "🥉"] as const;

const PODIUM_STYLES = [
  "border-amber-500/50 bg-amber-500/5", // 🥇 or
  "border-slate-400/40 bg-slate-400/5", // 🥈 argent
  "border-orange-500/40 bg-orange-500/5", // 🥉 bronze
] as const;

// ─── Composant principal ─────────────────────────────────────

export function LeaderboardTab() {
  const language = useAppStore((s) => s.language);
  const fr = language === "fr";

  const [status, setStatus] = useState<LoadStatus>("loading");
  const [data, setData] = useState<LeaderboardData | null>(null);
  const [lockedPlan, setLockedPlan] = useState<string | null>(null);
  const [retrying, setRetrying] = useState(false);

  const applyResult = useCallback((r: LeaderboardResult) => {
    if (r.kind === "locked") {
      setLockedPlan(r.plan);
      setStatus("locked");
      return;
    }
    if (r.kind === "error") {
      setStatus("error");
      return;
    }
    setData(r.data);
    setStatus(r.data.leaderboard.length === 0 ? "empty" : "ready");
  }, []);

  // Chargement initial (setState uniquement après await → pas de rendu en cascade)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const r = await fetchLeaderboard();
      if (!cancelled) applyResult(r);
    })();
    return () => {
      cancelled = true;
    };
  }, [applyResult]);

  const handleRetry = useCallback(async () => {
    setRetrying(true);
    const r = await fetchLeaderboard();
    applyResult(r);
    setRetrying(false);
  }, [applyResult]);

  // ─── Rendu ───

  if (status === "loading") {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-6">
              <Skeleton className="h-12 w-12 rounded-full mx-auto" />
              <Skeleton className="h-5 w-28 mx-auto mt-4" />
              <Skeleton className="h-8 w-16 mx-auto mt-3" />
              <Skeleton className="h-4 w-24 mx-auto mt-3" />
            </Card>
          ))}
        </div>
        <Card className="p-6">
          <Skeleton className="h-8 w-full mb-4" />
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full mb-2" />
          ))}
        </Card>
      </div>
    );
  }

  if (status === "locked") {
    return (
      <div className="p-4 md:p-6 max-w-2xl mx-auto">
        <Card className="border-amber-500/40 bg-gradient-to-b from-amber-500/10 to-transparent">
          <CardHeader className="items-center text-center">
            <div className="mx-auto mb-2 flex h-16 w-16 items-center justify-center rounded-full border border-amber-500/40 bg-amber-500/15">
              <Lock className="w-7 h-7 text-amber-500" aria-hidden="true" />
            </div>
            <CardTitle className="text-2xl">
              {fr ? "🔒 Réservé Elite" : "🔒 Elite only"}
            </CardTitle>
            <CardDescription>
              {fr
                ? "Le classement de la communauté est réservé au plan Elite."
                : "The community leaderboard is reserved for the Elite plan."}
              {lockedPlan && (
                <span className="block mt-1 text-xs uppercase tracking-wider text-muted-foreground">
                  {fr ? "Ton plan actuel" : "Your current plan"} : {lockedPlan}
                </span>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <ul className="space-y-2.5 text-sm">
              <EliteBenefit
                text={fr ? "Classement basé sur la discipline (Score DONCIEL), pas seulement les gains" : "Ranking based on discipline (DONCIEL Score), not just gains"}
              />
              <EliteBenefit
                text={fr ? "Motivation communautaire : compare-toi aux traders actifs des 30 derniers jours" : "Community motivation: compare yourself with active traders from the last 30 days"}
              />
              <EliteBenefit
                text={fr ? "Podium top 3 + ton rang exact, noms anonymisés" : "Top 3 podium + your exact rank, anonymized names"}
              />
            </ul>
            <Button
              asChild
              className="w-full min-h-11 bg-gradient-to-r from-amber-500 to-yellow-500 text-black font-bold hover:from-amber-400 hover:to-yellow-400"
            >
              <a href="/abonnement">
                <Crown className="w-4 h-4" />
                {fr ? "Passer Elite" : "Go Elite"}
              </a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="p-4 md:p-6 max-w-lg mx-auto">
        <Card className="border-red-500/30">
          <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
            <WifiOff className="w-10 h-10 text-red-500" />
            <div>
              <p className="font-semibold">
                {fr ? "Impossible de charger le classement" : "Failed to load the leaderboard"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {fr ? "Vérifie ta connexion puis réessaie." : "Check your connection and try again."}
              </p>
            </div>
            <Button
              onClick={handleRetry}
              disabled={retrying}
              variant="outline"
              className="min-h-11 border-sky-500/40 text-sky-500 hover:bg-sky-500/10"
            >
              <RefreshCw className={cn("w-4 h-4", retrying && "animate-spin")} />
              {fr ? "Réessayer" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (status === "empty") {
    const minTrades = data?.meta.minTrades ?? 10;
    return (
      <div className="p-4 md:p-6 max-w-lg mx-auto">
        <Card>
          <CardContent className="flex flex-col items-center gap-4 py-12 text-center">
            <Users className="w-10 h-10 text-muted-foreground/50" />
            <div>
              <p className="font-semibold">
                {fr ? "Pas encore assez de traders actifs" : "Not enough active traders yet"}
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                {fr
                  ? `Le classement apparaît dès que des traders totalisent au moins ${minTrades} trades sur les 30 derniers jours.`
                  : `The leaderboard appears once traders log at least ${minTrades} trades over the last 30 days.`}
              </p>
            </div>
            <Button
              onClick={handleRetry}
              disabled={retrying}
              variant="outline"
              className="min-h-11"
            >
              <RefreshCw className={cn("w-4 h-4", retrying && "animate-spin")} />
              {fr ? "Rafraîchir" : "Refresh"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // status === "ready"
  const rows = data?.leaderboard ?? [];
  const me = data?.me ?? null;
  const meta = data?.meta;
  const podium = rows.slice(0, 3);
  const tableRows = rows.slice(3);

  // Ordre du podium : argent, or, bronze (visuellement), or au centre sur desktop
  const podiumOrder = [1, 0, 2].filter((i) => podium[i]);
  const podiumClasses = [
    "order-2 sm:order-1", // argent
    "order-1 sm:order-2", // or
    "order-3 sm:order-3", // bronze
  ];

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* En-tête */}
      <div>
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Trophy className="w-5 h-5 text-amber-500" />
          {fr ? "Communauté" : "Community"}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {fr
            ? "Classement discipline des traders DONCIEL TM sur les 30 derniers jours."
            : "DONCIEL TM traders discipline ranking over the last 30 days."}
        </p>
      </div>

      {/* Résumé personnel */}
      {me && (
        <Card
          className={cn(
            "p-4 border",
            me.qualified ? "border-sky-500/40 bg-sky-500/5" : "border-border"
          )}
        >
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="flex items-center gap-3 min-w-0 flex-1">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-sky-500/40 bg-sky-500/10 font-bold text-sky-500">
                {me.qualified && me.rank ? `#${me.rank}` : "—"}
              </div>
              <div className="min-w-0">
                <p className="font-semibold truncate">
                  {me.qualified
                    ? fr
                      ? `Ton rang : #${me.rank}`
                      : `Your rank: #${me.rank}`
                    : fr
                      ? "Pas encore classé"
                      : "Not ranked yet"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {me.qualified
                    ? fr
                      ? `Score ${me.score} · Win rate ${me.winRate} % · ${me.totalRR} R`
                      : `Score ${me.score} · Win rate ${me.winRate}% · ${me.totalRR}R`
                    : fr
                      ? `Atteins au moins ${meta?.minTrades ?? 10} trades sur les ${meta?.periodDays ?? 30} derniers jours pour entrer au classement.`
                      : `Log at least ${meta?.minTrades ?? 10} trades over the last ${meta?.periodDays ?? 30} days to enter the ranking.`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm text-muted-foreground">{fr ? "Ton score" : "Your score"}</span>
              <span className="text-2xl font-extrabold" style={{ color: GRADE_COLORS[me.grade] }}>
                {me.score}
              </span>
              <ScoreGradeBadge grade={me.grade} />
            </div>
          </div>
        </Card>
      )}

      {/* Podium */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-end">
        {podiumOrder.map((idx) => {
          const entry = podium[idx];
          return (
            <Card
              key={entry.rank}
              className={cn(
                "p-6 text-center border-2",
                PODIUM_STYLES[idx],
                podiumClasses[idx],
                entry.isSelf && "ring-2 ring-sky-400 ring-offset-2 ring-offset-background",
                idx === 0 && "sm:scale-[1.04]"
              )}
            >
              <div className="text-4xl" aria-hidden="true">{MEDALS[idx]}</div>
              <p className="mt-2 font-semibold truncate" title={entry.name}>
                {entry.name}
                {entry.isSelf && (
                  <Badge className="ml-2 bg-sky-500/15 text-sky-500 border border-sky-500/30 hover:bg-sky-500/15">
                    {fr ? "toi" : "you"}
                  </Badge>
                )}
              </p>
              <p
                className="mt-2 text-4xl font-extrabold tabular-nums"
                style={{ color: GRADE_COLORS[entry.grade] }}
              >
                {entry.score}
              </p>
              <div className="mt-2 flex items-center justify-center gap-2">
                <ScoreGradeBadge grade={entry.grade} />
                <span className="text-xs text-muted-foreground">{entry.tradesCount} trades</span>
              </div>
            </Card>
          );
        })}
      </div>

      {/* Tableau ranks 4-20 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <ShieldCheck className="w-4 h-4 text-sky-500" />
            {fr ? "Classement complet" : "Full ranking"}
          </CardTitle>
          <CardDescription>
            {fr
              ? `${meta?.totalQualified ?? rows.length} trader${(meta?.totalQualified ?? rows.length) > 1 ? "s" : ""} qualifié${(meta?.totalQualified ?? rows.length) > 1 ? "s" : ""}`
              : `${meta?.totalQualified ?? rows.length} qualified trader${(meta?.totalQualified ?? rows.length) > 1 ? "s" : ""}`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {tableRows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">
              {fr
                ? "Le podium est seul au classement pour le moment."
                : "Only the podium is ranked for now."}
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-14">{fr ? "Rang" : "Rank"}</TableHead>
                  <TableHead>{fr ? "Trader" : "Trader"}</TableHead>
                  <TableHead className="text-right">{fr ? "Score" : "Score"}</TableHead>
                  <TableHead>{fr ? "Grade" : "Grade"}</TableHead>
                  <TableHead className="text-right">{fr ? "Win rate" : "Win rate"}</TableHead>
                  <TableHead className="text-right">R {fr ? "total" : "total"}</TableHead>
                  <TableHead className="text-right">{fr ? "Trades" : "Trades"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tableRows.map((row) => (
                  <TableRow
                    key={row.rank}
                    className={cn(row.isSelf && "bg-sky-500/10 hover:bg-sky-500/15")}
                  >
                    <TableCell className="font-semibold tabular-nums">#{row.rank}</TableCell>
                    <TableCell>
                      <span className="font-medium">{row.name}</span>
                      {row.isSelf && (
                        <Badge className="ml-2 bg-sky-500/15 text-sky-500 border border-sky-500/30 hover:bg-sky-500/15">
                          {fr ? "toi" : "you"}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell
                      className="text-right font-bold tabular-nums"
                      style={{ color: GRADE_COLORS[row.grade] }}
                    >
                      {row.score}
                    </TableCell>
                    <TableCell>
                      <ScoreGradeBadge grade={row.grade} />
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.winRate} %</TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-medium",
                        row.totalRR >= 0 ? "text-emerald-500" : "text-red-500"
                      )}
                    >
                      {row.totalRR}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{row.tradesCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

          <p className="mt-4 text-xs text-muted-foreground flex items-start gap-1.5">
            <Flame className="w-3.5 h-3.5 mt-0.5 shrink-0" />
            {fr
              ? "Classement basé sur la discipline (Score DONCIEL) sur les 30 derniers jours. Noms anonymisés."
              : "Ranking based on discipline (DONCIEL Score) over the last 30 days. Anonymized names."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Sous-composants ─────────────────────────────────────────

function EliteBenefit({ text }: { text: string }) {
  return (
    <li className="flex items-start gap-2">
      <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0 text-amber-500" />
      <span>{text}</span>
    </li>
  );
}
