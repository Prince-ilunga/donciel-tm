"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Clock, Globe2, Activity } from "lucide-react";

// ─── Configuration ───────────────────────────────────────────
// Lubumbashi, RDC uses Central Africa Time (CAT) = UTC+2 year-round (no DST).
const LUBUMBASHI_TZ = "Africa/Lubumbashi";
const UTC_OFFSET = 2;

interface TradingSession {
  id: string;
  name: string;
  city: string;
  flag: string;
  openUTC: number; // opening hour in UTC (0-23)
  closeUTC: number; // closing hour in UTC (0-23)
  dot: string; // active dot color
  text: string; // active text color
  border: string; // active border color
  bg: string; // timeline segment background
  glow: string; // glow color when active
}

// Standard Forex session times (in UTC).
const SESSIONS: TradingSession[] = [
  {
    id: "sydney",
    name: "Sydney",
    city: "Australie",
    flag: "🇦🇺",
    openUTC: 22,
    closeUTC: 7,
    dot: "bg-emerald-500",
    text: "text-emerald-500",
    border: "border-emerald-500/40",
    bg: "bg-emerald-500/15",
    glow: "shadow-emerald-500/30",
  },
  {
    id: "tokyo",
    name: "Tokyo",
    city: "Japon",
    flag: "🇯🇵",
    openUTC: 0,
    closeUTC: 9,
    dot: "bg-rose-500",
    text: "text-rose-500",
    border: "border-rose-500/40",
    bg: "bg-rose-500/15",
    glow: "shadow-rose-500/30",
  },
  {
    id: "london",
    name: "Londres",
    city: "Royaume-Uni",
    flag: "🇬🇧",
    openUTC: 8,
    closeUTC: 17,
    dot: "bg-sky-500",
    text: "text-sky-500",
    border: "border-sky-500/40",
    bg: "bg-sky-500/15",
    glow: "shadow-sky-500/30",
  },
  {
    id: "newyork",
    name: "New York",
    city: "États-Unis",
    flag: "🇺🇸",
    openUTC: 13,
    closeUTC: 22,
    dot: "bg-amber-500",
    text: "text-amber-500",
    border: "border-amber-500/40",
    bg: "bg-amber-500/15",
    glow: "shadow-amber-500/30",
  },
];

// ─── Helpers ─────────────────────────────────────────────────
function toLocalHour(utcHour: number): number {
  return (utcHour + UTC_OFFSET) % 24;
}

function formatHourLabel(hour: number): string {
  const h = hour % 24;
  return `${String(h).padStart(2, "0")}:00`;
}

function formatCountdown(totalMinutes: number): string {
  let m = totalMinutes;
  if (m < 0) m += 24 * 60;
  const totalSeconds = Math.floor(m * 60);
  const h = Math.floor(totalSeconds / 3600);
  const min = Math.floor((totalSeconds % 3600) / 60);
  const sec = totalSeconds % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
}

// ─── Component ───────────────────────────────────────────────
export function SessionsClock({ language }: { language: "fr" | "en" }) {
  const [now, setNow] = useState<Date | null>(null);

  // Start ticking in real-time, updating every second.
  // The first tick is deferred via requestAnimationFrame to avoid
  // synchronous setState in the effect body (prevents cascading renders
  // and SSR hydration mismatches).
  useEffect(() => {
    const rafId = requestAnimationFrame(() => setNow(new Date()));
    const interval = setInterval(() => setNow(new Date()), 1000);
    return () => {
      cancelAnimationFrame(rafId);
      clearInterval(interval);
    };
  }, []);

  // Compute status for each session based on the current UTC time.
  const sessionStatuses = useMemo(() => {
    if (!now) return null;
    const utcMinutes =
      now.getUTCHours() * 60 +
      now.getUTCMinutes() +
      now.getUTCSeconds() / 60;

    return SESSIONS.map((session) => {
      const openMin = session.openUTC * 60;
      const closeMin = session.closeUTC * 60;
      let isOpen: boolean;
      let minutesToEvent: number;

      if (session.closeUTC <= session.openUTC) {
        // Session crosses midnight (e.g. Sydney 22:00 -> 07:00).
        isOpen = utcMinutes >= openMin || utcMinutes < closeMin;
      } else {
        isOpen = utcMinutes >= openMin && utcMinutes < closeMin;
      }

      if (isOpen) {
        // Time remaining until the session closes.
        if (session.closeUTC <= session.openUTC) {
          if (utcMinutes >= openMin) {
            minutesToEvent = closeMin + 24 * 60 - utcMinutes;
          } else {
            minutesToEvent = closeMin - utcMinutes;
          }
        } else {
          minutesToEvent = closeMin - utcMinutes;
        }
      } else {
        // Time remaining until the session opens.
        if (utcMinutes < openMin) {
          minutesToEvent = openMin - utcMinutes;
        } else {
          minutesToEvent = openMin + 24 * 60 - utcMinutes;
        }
      }

      return { session, isOpen, minutesToEvent };
    });
  }, [now]);

  // Current local time & date strings (Lubumbashi).
  const timeString = now
    ? now.toLocaleTimeString("fr-FR", {
        timeZone: LUBUMBASHI_TZ,
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
      })
    : "--:--:--";

  const dateString = now
    ? now.toLocaleDateString("fr-FR", {
        timeZone: LUBUMBASHI_TZ,
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "—";

  // Current local decimal hour (for the timeline "now" marker).
  const localDecimalHour = now
    ? (now.getUTCHours() +
        now.getUTCMinutes() / 60 +
        now.getUTCSeconds() / 3600 +
        UTC_OFFSET) %
      24
    : 0;

  const openCount = sessionStatuses?.filter((s) => s.isOpen).length ?? 0;

  // Detect London / New York overlap (highest volatility window).
  const inHighVolatility = useMemo(() => {
    if (!sessionStatuses) return false;
    const london = sessionStatuses.find((s) => s.session.id === "london");
    const ny = sessionStatuses.find((s) => s.session.id === "newyork");
    return !!(london?.isOpen && ny?.isOpen);
  }, [sessionStatuses]);

  return (
    <Card className="overflow-hidden border-border bg-gradient-to-br from-background via-background to-muted/30">
      {/* ─── Header with main clock ─── */}
      <div className="relative p-4 md:p-6 border-b border-border">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary shrink-0">
              <Globe2 className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-bold tracking-tight text-foreground leading-none">
                {language === "fr" ? "HORLOGE DES SESSIONS" : "SESSIONS CLOCK"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {language === "fr"
                  ? "Lubumbashi, RDC · UTC+2 (CAT)"
                  : "Lubumbashi, DRC · UTC+2 (CAT)"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4 justify-between md:justify-end">
            {/* Open sessions indicator */}
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                {openCount > 0 && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                )}
                <span
                  className={cn(
                    "relative inline-flex h-2.5 w-2.5 rounded-full",
                    openCount > 0 ? "bg-emerald-500" : "bg-muted-foreground/40"
                  )}
                />
              </span>
              <span className="text-xs font-medium text-muted-foreground">
                {openCount}{" "}
                {language === "fr"
                  ? openCount > 1
                    ? "sessions ouvertes"
                    : "session ouverte"
                  : openCount === 1
                  ? "session open"
                  : "sessions open"}
              </span>
            </div>

            {/* Main real-time clock */}
            <div className="text-right">
              <div className="font-mono text-3xl md:text-4xl font-bold tabular-nums tracking-tight text-foreground leading-none">
                {timeString}
              </div>
              <div className="text-xs text-muted-foreground capitalize mt-1">
                {dateString}
              </div>
            </div>
          </div>
        </div>

        {/* ─── 24h timeline ─── */}
        <div className="mt-5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              {language === "fr" ? "Timeline 24h" : "24h Timeline"}
            </span>
            <span className="text-[10px] text-muted-foreground">
              {language === "fr" ? "Heure locale" : "Local time"}
            </span>
          </div>
          <div className="relative h-9 rounded-lg overflow-hidden border border-border bg-muted/30">
            {/* Hour grid lines */}
            {[0, 6, 12, 18].map((h) => (
              <div
                key={h}
                className="absolute top-0 bottom-0 w-px bg-border/70"
                style={{ left: `${(h / 24) * 100}%` }}
              />
            ))}
            {/* Session segments (local time) */}
            {SESSIONS.map((session) => {
              const localOpen = toLocalHour(session.openUTC);
              const localCloseRaw = toLocalHour(session.closeUTC);
              const localClose = localCloseRaw === 0 ? 24 : localCloseRaw;
              const openPct = (localOpen / 24) * 100;
              const widthPct = ((localClose - localOpen) / 24) * 100;
              const status = sessionStatuses?.find(
                (s) => s.session.id === session.id
              );
              const isOpen = status?.isOpen;
              return (
                <div
                  key={session.id}
                  className={cn(
                    "absolute top-0 bottom-0 transition-opacity duration-300",
                    session.bg,
                    isOpen ? "opacity-100" : "opacity-50"
                  )}
                  style={{ left: `${openPct}%`, width: `${widthPct}%` }}
                  title={`${session.name}: ${formatHourLabel(localOpen)} - ${formatHourLabel(localClose)}`}
                >
                  <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground/70 truncate px-1">
                    {session.name}
                  </span>
                </div>
              );
            })}
            {/* Current time marker */}
            {now && (
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-primary z-10"
                style={{
                  left: `${(localDecimalHour / 24) * 100}%`,
                  boxShadow: "0 0 8px var(--primary)",
                }}
              >
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
              </div>
            )}
          </div>
          {/* Hour labels */}
          <div className="flex justify-between mt-1 text-[9px] text-muted-foreground font-mono">
            <span>00:00</span>
            <span>06:00</span>
            <span>12:00</span>
            <span>18:00</span>
            <span>24:00</span>
          </div>
        </div>

        {/* High volatility overlap badge */}
        {inHighVolatility && (
          <div className="mt-3 flex items-center gap-1.5 rounded-md bg-amber-500/10 border border-amber-500/30 px-2.5 py-1.5 w-fit">
            <Activity className="h-3.5 w-3.5 text-amber-500" />
            <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400">
              {language === "fr"
                ? "Forte volatilité — chevauchement Londres / New York"
                : "High volatility — London / New York overlap"}
            </span>
          </div>
        )}
      </div>

      {/* ─── Session cards ─── */}
      <div className="p-4 md:p-6 grid grid-cols-2 lg:grid-cols-4 gap-3">
        {sessionStatuses?.map(({ session, isOpen, minutesToEvent }) => {
          const localOpen = toLocalHour(session.openUTC);
          const localCloseRaw = toLocalHour(session.closeUTC);
          const localClose = localCloseRaw === 0 ? 24 : localCloseRaw;
          return (
            <div
              key={session.id}
              className={cn(
                "relative rounded-xl border p-3 transition-all duration-300",
                isOpen
                  ? cn(session.border, "shadow-md", session.glow)
                  : "border-border/60 opacity-70"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-base leading-none">{session.flag}</span>
                  <div className="min-w-0">
                    <div className="text-xs font-bold text-foreground leading-none truncate">
                      {session.name}
                    </div>
                    <div className="text-[9px] text-muted-foreground leading-none mt-0.5 truncate">
                      {session.city}
                    </div>
                  </div>
                </div>
                <span className="relative flex h-2 w-2 shrink-0">
                  {isOpen && (
                    <span
                      className={cn(
                        "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
                        session.dot
                      )}
                    />
                  )}
                  <span
                    className={cn(
                      "relative inline-flex h-2 w-2 rounded-full",
                      isOpen ? session.dot : "bg-muted-foreground/30"
                    )}
                  />
                </span>
              </div>

              <div className="flex items-center justify-between mb-1.5">
                <span
                  className={cn(
                    "text-[10px] font-bold uppercase tracking-wide",
                    isOpen ? session.text : "text-muted-foreground"
                  )}
                >
                  {isOpen
                    ? language === "fr"
                      ? "OUVERT"
                      : "OPEN"
                    : language === "fr"
                    ? "FERMÉ"
                    : "CLOSED"}
                </span>
              </div>

              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-mono">
                <Clock className="h-3 w-3 shrink-0" />
                <span>
                  {formatHourLabel(localOpen)} – {formatHourLabel(localClose)}
                </span>
              </div>

              <div className="mt-2 pt-2 border-t border-border/40">
                <div className="text-[9px] uppercase tracking-wider text-muted-foreground leading-none mb-0.5">
                  {isOpen
                    ? language === "fr"
                      ? "Ferme dans"
                      : "Closes in"
                    : language === "fr"
                    ? "Ouvre dans"
                    : "Opens in"}
                </div>
                <div
                  className={cn(
                    "text-sm font-mono font-bold tabular-nums leading-none mt-1",
                    isOpen ? session.text : "text-foreground"
                  )}
                >
                  {formatCountdown(minutesToEvent)}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
