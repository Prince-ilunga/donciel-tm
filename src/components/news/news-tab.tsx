"use client";

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  Brain,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
  Clock,
  AlertTriangle,
  Shield,
  Zap,
  Loader2,
  Globe,
  Calendar,
  CalendarDays,
  BarChart3,
  CalendarClock,
  Activity,
  Target,
  AlertCircle,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  MinusCircle,
  Radio,
  Timer,
  Gauge,
  Eye,
  Users,
  Sunrise,
  Flame,
  ShieldAlert,
  CircleDot,
} from "lucide-react";

// ──────────────────────────────────────────────────────
// Constants
// ──────────────────────────────────────────────────────

const ASSETS = [
  { id: "XAUUSD", emoji: "🥇", label_fr: "Or / Dollar", label_en: "Gold / Dollar", color: "from-amber-500/10 to-yellow-500/10" },
  { id: "EURUSD", emoji: "🇪🇺", label_fr: "Euro / Dollar", label_en: "Euro / Dollar", color: "from-blue-500/10 to-indigo-500/10" },
  { id: "GBPUSD", emoji: "🇬🇧", label_fr: "Livre / Dollar", label_en: "Pound / Dollar", color: "from-red-500/10 to-rose-500/10" },
  { id: "US30", emoji: "🏭", label_fr: "Dow Jones 30", label_en: "Dow Jones 30", color: "from-emerald-500/10 to-green-500/10" },
  { id: "US100", emoji: "💻", label_fr: "Nasdaq 100", label_en: "Nasdaq 100", color: "from-purple-500/10 to-violet-500/10" },
] as const;

const DAYS_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FR: Record<string, string> = { Mon: "Lun", Tue: "Mar", Wed: "Mer", Thu: "Jeu", Fri: "Ven", Sat: "Sam", Sun: "Dim" };

type SubTab = "calendar" | "analysis" | "sentiment" | "alerts";
type PeriodFilter = "today" | "week";

// ──────────────────────────────────────────────────────
// Shared Sub-components
// ──────────────────────────────────────────────────────

function DirectionIcon({ direction, size = "sm" }: { direction: string; size?: "sm" | "md" | "lg" }) {
  const s = size === "sm" ? "w-3.5 h-3.5" : size === "md" ? "w-4 h-4" : "w-5 h-5";
  const isUp = direction?.toUpperCase().includes("HAUSS") || direction?.toUpperCase().includes("BULL");
  const isDown = direction?.toUpperCase().includes("BAISS") || direction?.toUpperCase().includes("BEAR");

  if (isUp) return <ArrowUpRight className={cn(s, "text-profit")} />;
  if (isDown) return <ArrowDownRight className={cn(s, "text-loss")} />;
  return <MinusCircle className={cn(s, "text-amber-500")} />;
}

function DirectionBadge({ direction, confidence }: { direction: string; confidence: string }) {
  const isUp = direction?.toUpperCase().includes("HAUSS") || direction?.toUpperCase().includes("BULL");
  const isDown = direction?.toUpperCase().includes("BAISS") || direction?.toUpperCase().includes("BEAR");
  const isNeutral = !isUp && !isDown;

  const confLevel = confidence?.toLowerCase() || "moyen";
  const confColor = confLevel.includes("élev") || confLevel.includes("high")
    ? "text-profit" : confLevel.includes("fai") || confLevel.includes("low")
    ? "text-muted-foreground" : "text-amber-500";

  return (
    <div className="flex items-center gap-2">
      <Badge
        className={cn(
          "text-xs font-bold gap-1 px-3 py-1",
          isUp && "bg-profit/15 text-profit border-profit/30",
          isDown && "bg-loss/15 text-loss border-loss/30",
          isNeutral && "bg-amber-500/15 text-amber-500 border-amber-500/30"
        )}
      >
        {isUp && <TrendingUp className="w-3.5 h-3.5" />}
        {isDown && <TrendingDown className="w-3.5 h-3.5" />}
        {isNeutral && <Minus className="w-3.5 h-3.5" />}
        {direction || "N/A"}
      </Badge>
      <span className={cn("text-[10px] font-medium", confColor)}>
        {confidence || ""}
      </span>
    </div>
  );
}

function ImpactBadge({ impact }: { impact: string }) {
  const isHigh = impact?.toUpperCase().includes("ÉLEV") || impact?.toUpperCase().includes("HIGH");
  const isLow = impact?.toUpperCase().includes("FAI") || impact?.toUpperCase().includes("LOW");

  return (
    <Badge
      variant="outline"
      className={cn(
        "text-[10px] gap-1",
        isHigh && "border-loss/40 text-loss",
        isLow && "border-muted-foreground/40 text-muted-foreground",
        !isHigh && !isLow && "border-amber-500/40 text-amber-500"
      )}
    >
      {isHigh && <Zap className="w-3 h-3" />}
      {!isHigh && !isLow && <Shield className="w-3 h-3" />}
      {!isHigh && isLow && <AlertTriangle className="w-3 h-3" />}
      {impact || "N/A"}
    </Badge>
  );
}

function SentimentGauge({ sentiment, language }: { sentiment: string; language: string }) {
  const s = sentiment?.toLowerCase() || "neutre";
  const isFr = language === "fr";
  const isVeryBull = s.includes("très haus") || s.includes("very bull") || s.includes("strongly bull");
  const isBull = s.includes("haus") || s.includes("bull") || s.includes("acheteur");
  const isVeryBear = s.includes("très bai") || s.includes("very bear") || s.includes("strongly bear");
  const isBear = s.includes("bai") || s.includes("bear") || s.includes("vendeur");

  const value = isVeryBull ? 90 : isBull ? 70 : isVeryBear ? 10 : isBear ? 30 : 50;
  const label = isVeryBull ? (isFr ? "Très Haussier" : "Very Bullish")
    : isBull ? (isFr ? "Haussier" : "Bullish")
    : isVeryBear ? (isFr ? "Très Baissier" : "Very Bearish")
    : isBear ? (isFr ? "Baissier" : "Bearish")
    : (isFr ? "Neutre" : "Neutral");

  const color = value >= 70 ? "bg-profit" : value >= 55 ? "bg-profit/60" : value <= 30 ? "bg-loss" : value <= 45 ? "bg-loss/60" : "bg-amber-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">{isFr ? "Sentiment" : "Sentiment"}</span>
        <span className={cn("text-[10px] font-bold",
          value >= 55 ? "text-profit" : value <= 45 ? "text-loss" : "text-amber-500"
        )}>{label}</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-700", color)}
          style={{ width: `${value}%` }}
        />
      </div>
    </div>
  );
}

/** Horizontal Fear & Greed gauge */
function FearGreedGauge({ value, label, language }: { value: number; label: string; language: string }) {
  const isFr = language === "fr";
  const color = value >= 75 ? "bg-profit" : value >= 55 ? "bg-profit/60" : value <= 25 ? "bg-loss" : value <= 45 ? "bg-loss/60" : "bg-amber-500";
  const textColor = value >= 55 ? "text-profit" : value <= 45 ? "text-loss" : "text-amber-500";
  const displayLabel = label || (value >= 80 ? (isFr ? "Extrême Avidité" : "Extreme Greed")
    : value >= 60 ? (isFr ? "Avidité" : "Greed")
    : value >= 40 ? (isFr ? "Neutre" : "Neutral")
    : value >= 20 ? (isFr ? "Peur" : "Fear")
    : (isFr ? "Extrême Peur" : "Extreme Fear"));

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Gauge className="w-5 h-5 text-primary" />
          <span className="text-sm font-bold">{isFr ? "Indice Peur & Avidité" : "Fear & Greed Index"}</span>
        </div>
        <div className="text-right">
          <div className={cn("text-3xl font-bold", textColor)}>{value}</div>
          <div className="text-[10px] text-muted-foreground font-medium">{displayLabel}</div>
        </div>
      </div>
      <div className="relative h-4 rounded-full bg-muted overflow-hidden">
        {/* Color gradient background */}
        <div className="absolute inset-0 flex">
          <div className="flex-1 bg-loss/30" />
          <div className="flex-1 bg-loss/15" />
          <div className="flex-1 bg-amber-500/15" />
          <div className="flex-1 bg-profit/15" />
          <div className="flex-1 bg-profit/30" />
        </div>
        {/* Indicator */}
        <div
          className="absolute top-0 h-full w-1 bg-foreground rounded-full transition-all duration-700 shadow-lg"
          style={{ left: `${Math.min(99, Math.max(1, value))}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] text-muted-foreground">
        <span>{isFr ? "Peur Extrême" : "Extreme Fear"}</span>
        <span>{isFr ? "Neutre" : "Neutral"}</span>
        <span>{isFr ? "Avidité Extrême" : "Extreme Greed"}</span>
      </div>
    </div>
  );
}

/** Probability bar for scenario cards */
function ProbabilityBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-2.5 rounded-full bg-muted overflow-hidden">
      <div
        className={cn("h-full rounded-full transition-all duration-700", color)}
        style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
      />
    </div>
  );
}

/** Countdown timer display */
function CountdownTimer({ targetDate, language }: { targetDate: string; language: string }) {
  const [timeLeft, setTimeLeft] = useState("");
  const isFr = language === "fr";

  useEffect(() => {
    const update = () => {
      const now = new Date().getTime();
      const target = new Date(targetDate).getTime();
      const diff = target - now;

      if (diff <= 0) {
        setTimeLeft(isFr ? "En cours" : "Live");
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      if (hours > 24) {
        const days = Math.floor(hours / 24);
        setTimeLeft(`${days}d ${hours % 24}h`);
      } else if (hours > 0) {
        setTimeLeft(`${hours}h ${minutes}m`);
      } else {
        setTimeLeft(`${minutes}m ${seconds}s`);
      }
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate, isFr]);

  return <span className="text-[10px] font-mono font-bold text-primary">{timeLeft}</span>;
}

// ──────────────────────────────────────────────────────
// Sub-tab: Calendar (📅)
// ──────────────────────────────────────────────────────

function CalendarSubTab({ language }: { language: string }) {
  const isFr = language === "fr";
  const [calendarData, setCalendarData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchCalendar = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/calendar?lang=${language}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setCalendarData(data);
      setError(null);
    } catch {
      setError(isFr ? "Erreur lors du chargement du calendrier" : "Error loading calendar");
    } finally {
      setLoading(false);
    }
  }, [language, isFr]);

  useEffect(() => {
    fetchCalendar();
    intervalRef.current = setInterval(fetchCalendar, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchCalendar]);

  // Normalize events from API format to component format
  const normalizedEvents = useMemo(() => {
    const rawEvents: any[] = calendarData?.events || [];
    return rawEvents.map((evt: any) => {
      // Build a date from today + time
      const today = new Date();
      let eventDate: Date;
      if (evt.date) {
        eventDate = new Date(evt.date);
      } else if (evt.time) {
        const [h, m] = evt.time.split(":").map(Number);
        eventDate = new Date(today.getFullYear(), today.getMonth(), today.getDate(), h || 0, m || 0);
      } else {
        eventDate = today;
      }

      return {
        title: evt.event || evt.title || "",
        date: eventDate.toISOString(),
        time: evt.time || "",
        currency: (evt.currency || "").toUpperCase(),
        impact: (evt.impact || "low").toUpperCase(),
        countryFlag: evt.country || "🌍",
        forecast: evt.forecast || null,
        previous: evt.previous || null,
        actual: evt.actual || null,
      };
    });
  }, [calendarData]);

  // Find next high-impact event
  const nextHighImpact = useMemo(() => {
    const now = new Date();
    return normalizedEvents.find(e => e.impact === "HIGH" && new Date(e.date) > now) || null;
  }, [normalizedEvents]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <Card className="p-3 sm:p-4"><Skeleton className="h-8 w-12 mx-auto mb-1" /><Skeleton className="h-3 w-16 mx-auto" /></Card>
          <Card className="p-3 sm:p-4"><Skeleton className="h-8 w-12 mx-auto mb-1" /><Skeleton className="h-3 w-16 mx-auto" /></Card>
          <Card className="p-3 sm:p-4"><Skeleton className="h-8 w-12 mx-auto mb-1" /><Skeleton className="h-3 w-16 mx-auto" /></Card>
        </div>
        <Card className="p-4 sm:p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3">
                <Skeleton className="h-4 w-14" />
                <Skeleton className="h-4 w-6" />
                <Skeleton className="h-4 w-10" />
                <Skeleton className="h-4 flex-1" />
              </div>
            ))}
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchCalendar} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="w-4 h-4" />
          {isFr ? "Réessayer" : "Retry"}
        </Button>
      </Card>
    );
  }

  const highCount = normalizedEvents.filter((e: any) => e.impact === "HIGH").length;
  const mediumCount = normalizedEvents.filter((e: any) => e.impact === "MEDIUM").length;

  const todayEvents = normalizedEvents.filter((e: any) => {
    const d = new Date(e.date);
    const now = new Date();
    return d.toDateString() === now.toDateString();
  });

  const weekEvents = normalizedEvents.filter((e: any) => {
    const d = new Date(e.date);
    const now = new Date();
    const weekEnd = new Date(now);
    weekEnd.setDate(now.getDate() + 7);
    return d >= now && d <= weekEnd;
  });

  return (
    <div className="space-y-4">
      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-2xl font-bold text-loss">{highCount}</div>
          <div className="text-[10px] text-muted-foreground">{isFr ? "Impact Élevé" : "High Impact"}</div>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-2xl font-bold text-amber-500">{mediumCount}</div>
          <div className="text-[10px] text-muted-foreground">{isFr ? "Impact Modéré" : "Medium Impact"}</div>
        </Card>
        <Card className="p-3 sm:p-4 text-center">
          <div className="text-2xl font-bold text-muted-foreground">{normalizedEvents.length}</div>
          <div className="text-[10px] text-muted-foreground">{isFr ? "Total" : "Total"}</div>
        </Card>
      </div>

      {/* Next high-impact event highlight */}
      {nextHighImpact && (
        <Card className="p-4 border-2 border-loss/30 bg-gradient-to-r from-loss/5 to-transparent">
          <div className="flex items-center gap-2 mb-2">
            <Zap className="w-4 h-4 text-loss" />
            <span className="text-xs font-bold text-loss">
              {isFr ? "Prochain événement à fort impact" : "Next High-Impact Event"}
            </span>
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <h4 className="text-sm font-bold">{nextHighImpact.title}</h4>
              <div className="flex items-center gap-2 mt-1 flex-wrap">
                <span className="text-xs">{nextHighImpact.countryFlag}</span>
                <span className="text-xs text-muted-foreground">{nextHighImpact.currency}</span>
                {nextHighImpact.forecast && (
                  <span className="text-[10px] text-muted-foreground">
                    {isFr ? "Prévision" : "Forecast"}: {nextHighImpact.forecast}
                  </span>
                )}
                {nextHighImpact.previous && (
                  <span className="text-[10px] text-muted-foreground">
                    {isFr ? "Précédent" : "Previous"}: {nextHighImpact.previous}
                  </span>
                )}
              </div>
            </div>
            <CountdownTimer targetDate={nextHighImpact.date} language={language} />
          </div>
        </Card>
      )}

      {/* Today's events */}
      {todayEvents.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Calendar className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm">{isFr ? "Aujourd'hui" : "Today"}</h3>
            <Badge variant="secondary" className="text-[10px]">{todayEvents.length}</Badge>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {todayEvents.map((evt: any, i: number) => (
              <CalendarEventRow key={i} event={evt} language={language} isHighlighted={nextHighImpact?.title === evt.title} />
            ))}
          </div>
        </Card>
      )}

      {/* This week's events */}
      {weekEvents.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <CalendarDays className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm">{isFr ? "Cette Semaine" : "This Week"}</h3>
            <Badge variant="secondary" className="text-[10px]">{weekEvents.length}</Badge>
          </div>
          <div className="space-y-2 max-h-96 overflow-y-auto">
            {weekEvents.map((evt: any, i: number) => (
              <CalendarEventRow key={i} event={evt} language={language} isHighlighted={false} />
            ))}
          </div>
        </Card>
      )}

      {normalizedEvents.length === 0 && (
        <Card className="p-8 text-center">
          <CalendarClock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">{isFr ? "Aucun événement économique prévu" : "No economic events scheduled"}</p>
        </Card>
      )}
    </div>
  );
}

function CalendarEventRow({ event, language, isHighlighted }: { event: any; language: string; isHighlighted: boolean }) {
  const isFr = language === "fr";
  const impactDot = event.impact === "HIGH" ? "🔴" : event.impact === "MEDIUM" ? "🟡" : "🟢";

  const timeStr = event.time
    || (event.date
      ? new Date(event.date).toLocaleTimeString(
          isFr ? "fr-FR" : "en-US",
          { hour: "2-digit", minute: "2-digit" }
        )
      : "--:--");

  return (
    <div className={cn(
      "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
      isHighlighted
        ? "border-loss/30 bg-loss/5"
        : "border-border hover:border-primary/20 hover:bg-primary/5"
    )}>
      <span className="text-[10px] font-mono text-muted-foreground w-12 shrink-0">{timeStr}</span>
      <span className="text-xs">{event.countryFlag || "🌍"}</span>
      <span className="text-[10px] font-bold w-10 shrink-0 text-center">{event.currency || ""}</span>
      <span className="text-xs">{impactDot}</span>
      <div className="flex-1 min-w-0">
        <h4 className="text-xs font-medium line-clamp-1">{event.title}</h4>
      </div>
      <div className="hidden sm:flex items-center gap-2 shrink-0">
        {event.actual && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-profit/30 text-profit">
            {isFr ? "Act." : "Act"} {event.actual}
          </Badge>
        )}
        {event.forecast && (
          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
            {isFr ? "Prév." : "Fcst"} {event.forecast}
          </Badge>
        )}
        {event.previous && (
          <Badge variant="secondary" className="text-[9px] px-1.5 py-0">
            {isFr ? "Préc." : "Prev"} {event.previous}
          </Badge>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Sub-tab: Analyse IA (🧠) — existing news analysis
// ──────────────────────────────────────────────────────

function AnalysisSubTab({ language }: { language: string }) {
  const isFr = language === "fr";
  const [activeAsset, setActiveAsset] = useState<string>("XAUUSD");
  const [periodFilter, setPeriodFilter] = useState<PeriodFilter>("week");
  const [newsData, setNewsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async (asset: string, period: PeriodFilter) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/news?asset=${asset}&lang=${language}&period=${period}`);
      if (!res.ok) throw new Error("Erreur lors du chargement");
      const data = await res.json();
      setNewsData(data);
    } catch {
      setError(isFr ? "Erreur lors du chargement des news" : "Error loading news");
    }
    setLoading(false);
  }, [language, isFr]);

  useEffect(() => {
    fetchNews(activeAsset, periodFilter);
  }, [activeAsset, periodFilter, fetchNews]);

  const handleRefresh = () => fetchNews(activeAsset, periodFilter);

  const currentAsset = ASSETS.find(a => a.id === activeAsset);
  const analysis = newsData?.analysis;
  const aiPowered = newsData?.aiPowered;

  const barChartData = useMemo(() => {
    if (!newsData?.dailyCounts) return [];
    const countMap: Record<string, number> = {};
    newsData.dailyCounts.forEach((d: any) => {
      countMap[d.day] = d.count;
    });
    return DAYS_ORDER.map(day => ({
      day: language === "fr" ? DAYS_FR[day] : day,
      count: countMap[day] || 0,
    }));
  }, [newsData, language]);

  const upcomingCount = newsData?.upcomingEvents?.length || 0;

  return (
    <div className="space-y-4">
      {/* Asset Selector */}
      <div className="grid grid-cols-5 gap-2 sm:gap-3">
        {ASSETS.map((asset) => {
          const isActive = activeAsset === asset.id;
          return (
            <button
              key={asset.id}
              onClick={() => setActiveAsset(asset.id)}
              className={cn(
                "p-3 sm:p-4 rounded-xl border-2 transition-all duration-200 text-center",
                isActive
                  ? "border-primary bg-gradient-to-br " + asset.color + " shadow-lg shadow-primary/10"
                  : "border-border hover:border-primary/30 bg-card"
              )}
            >
              <div className="text-lg sm:text-2xl mb-1">{asset.emoji}</div>
              <div className="text-[10px] sm:text-sm font-bold">{asset.id}</div>
              <div className="text-[8px] sm:text-xs text-muted-foreground hidden sm:block">
                {language === "fr" ? asset.label_fr : asset.label_en}
              </div>
            </button>
          );
        })}
      </div>

      {/* Period Filter */}
      <div className="flex items-center gap-2">
        <Button
          variant={periodFilter === "today" ? "default" : "outline"}
          size="sm"
          className={cn("gap-1.5", periodFilter === "today" && "shadow-sm")}
          onClick={() => setPeriodFilter("today")}
        >
          <Calendar className="w-3.5 h-3.5" />
          {isFr ? "Aujourd'hui" : "Today"}
        </Button>
        <Button
          variant={periodFilter === "week" ? "default" : "outline"}
          size="sm"
          className={cn("gap-1.5", periodFilter === "week" && "shadow-sm")}
          onClick={() => setPeriodFilter("week")}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {isFr ? "Cette Semaine" : "This Week"}
        </Button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="space-y-4">
          <Card className="p-6">
            <Skeleton className="h-6 w-48 mb-4" />
            <div className="space-y-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-4 w-1/2" />
            </div>
          </Card>
          <Card className="p-6">
            <Skeleton className="h-6 w-32 mb-4" />
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-16 w-full" />
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <Card className="p-12 text-center">
          <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{error}</p>
          <Button onClick={handleRefresh} variant="outline" className="mt-4 gap-2">
            <RefreshCw className="w-4 h-4" />
            {isFr ? "Réessayer" : "Retry"}
          </Button>
        </Card>
      )}

      {/* Content */}
      {newsData && !loading && !error && (
        <div className="space-y-4">
          {/* DONCIEL-AI™ Finance Analysis Card */}
          {analysis && (
            <Card className={cn(
              "p-4 sm:p-6 border-2 overflow-hidden",
              analysis.direction?.toUpperCase().includes("HAUSS") || analysis.direction?.toUpperCase().includes("BULL")
                ? "border-profit/20 bg-gradient-to-br from-profit/5 to-transparent"
                : analysis.direction?.toUpperCase().includes("BAISS") || analysis.direction?.toUpperCase().includes("BEAR")
                ? "border-loss/20 bg-gradient-to-br from-loss/5 to-transparent"
                : "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent"
            )}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2 min-w-0">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center shrink-0",
                    analysis.direction?.toUpperCase().includes("HAUSS") || analysis.direction?.toUpperCase().includes("BULL")
                      ? "bg-profit/10" : analysis.direction?.toUpperCase().includes("BAISS") || analysis.direction?.toUpperCase().includes("BEAR")
                      ? "bg-loss/10" : "bg-amber-500/10"
                  )}>
                    <Brain className={cn(
                      "w-6 h-6",
                      analysis.direction?.toUpperCase().includes("HAUSS") || analysis.direction?.toUpperCase().includes("BULL")
                        ? "text-profit" : analysis.direction?.toUpperCase().includes("BAISS") || analysis.direction?.toUpperCase().includes("BEAR")
                        ? "text-loss" : "text-amber-500"
                    )} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-sm">
                        {aiPowered
                          ? (isFr ? "IA Financière Spécialisée" : "Finance AI Specialist")
                          : (isFr ? "Interprétation IA" : "AI Interpretation")} — {activeAsset}
                      </h3>
                      {aiPowered && (
                        <Badge className="bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0 gap-1 text-[9px] px-2 py-0.5 shadow-lg shadow-purple-500/20 shrink-0">
                          <Sparkles className="w-3 h-3" />
                          DONCIEL-AI™
                        </Badge>
                      )}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {currentAsset && (isFr ? currentAsset.label_fr : currentAsset.label_en)}
                      {periodFilter === "today"
                        ? (isFr ? " · Aujourd'hui" : " · Today")
                        : (isFr ? " · Cette semaine" : " · This Week")}
                      {aiPowered && (
                        <span className="ml-1 text-purple-500">
                          · {isFr ? "Analyse CFA en temps réel" : "CFA-level real-time analysis"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <DirectionBadge direction={analysis.direction} confidence={analysis.confidence} />
              </div>

              {analysis.summary && (
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">{analysis.summary}</p>
              )}

              <Separator className="mb-4" />

              {analysis.sentiment && (
                <div className="mb-4">
                  <SentimentGauge sentiment={analysis.sentiment} language={language} />
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {analysis.keyFactors && analysis.keyFactors.length > 0 && (
                  <div className="sm:col-span-2">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {isFr ? "Facteurs Clés" : "Key Factors"}
                    </h4>
                    <div className="space-y-1.5">
                      {analysis.keyFactors.map((factor: string, i: number) => (
                        <div key={i} className="flex items-start gap-2 text-sm">
                          <span className="text-primary font-bold text-xs mt-0.5">•</span>
                          <span>{factor}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {isFr ? "Impact" : "Impact"}
                    </h4>
                    {analysis.impact && <ImpactBadge impact={analysis.impact} />}
                  </div>
                  {analysis.recommendation && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {isFr ? "Conseil" : "Advice"}
                      </h4>
                      <p className="text-xs bg-primary/5 border border-primary/10 rounded-lg p-2.5">
                        💡 {analysis.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {(analysis.shortTerm || analysis.mediumTerm) && (
                <>
                  <Separator className="my-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analysis.shortTerm && (
                      <div className="p-3 rounded-lg border border-border bg-card/50">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Activity className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isFr ? "Court Terme (Intraday)" : "Short Term (Intraday)"}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">{analysis.shortTerm}</p>
                      </div>
                    )}
                    {analysis.mediumTerm && (
                      <div className="p-3 rounded-lg border border-border bg-card/50">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Target className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {isFr ? "Moyen Terme (Swing)" : "Medium Term (Swing)"}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">{analysis.mediumTerm}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {analysis.riskWarning && (
                <div className="mt-3 p-2.5 rounded-lg border border-loss/20 bg-loss/5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-loss mt-0.5 shrink-0" />
                    <p className="text-[11px] text-loss/80 leading-relaxed">{analysis.riskWarning}</p>
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Weekly News Bar Chart */}
          {periodFilter === "week" && barChartData.length > 0 && (
            <Card className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary" />
                  <h3 className="font-bold text-sm">
                    {isFr ? "Actualités de la Semaine" : "Weekly News"}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {upcomingCount > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-500">
                      <CalendarClock className="w-3 h-3" />
                      {upcomingCount} {isFr ? "à venir" : "upcoming"}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {newsData.news?.length || 0} {isFr ? "actualités" : "news"}
                  </Badge>
                </div>
              </div>
              <div className="flex items-end gap-2 h-[120px]">
                {barChartData.map((d, i) => {
                  const maxCount = Math.max(...barChartData.map(b => b.count), 1);
                  const heightPct = (d.count / maxCount) * 100;
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <span className="text-[9px] text-muted-foreground font-medium">{d.count || ""}</span>
                      <div className="w-full flex items-end justify-center" style={{ height: "100px" }}>
                        <div
                          className="w-full max-w-[40px] rounded-t-md bg-primary/70 transition-all duration-500"
                          style={{ height: `${Math.max(heightPct, 4)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{d.day}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          )}

          {/* Upcoming Economic Events */}
          {periodFilter === "week" && newsData.upcomingEvents?.length > 0 && (
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm">
                  {isFr ? "Événements Économiques à Venir" : "Upcoming Economic Events"}
                </h3>
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {newsData.upcomingEvents.map((item: any, i: number) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="p-2.5 rounded-lg border border-amber-500/20 hover:border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition-all duration-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <h4 className="text-xs font-medium group-hover:text-amber-600 transition-colors line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                            {item.snippet}
                          </p>
                        </div>
                        <ExternalLink className="w-3 h-3 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            </Card>
          )}

          {/* News Feed with AI Interpretation Tags */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">
                  {periodFilter === "today"
                    ? (isFr ? "Actualités du Jour" : "Today's News")
                    : (isFr ? "Actualités de la Semaine" : "This Week's News")} — {activeAsset}
                </h3>
                {newsData.news?.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">{newsData.news.length}</Badge>
                )}
              </div>
              {newsData.updatedAt && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(newsData.updatedAt).toLocaleTimeString(
                    isFr ? "fr-FR" : "en-US",
                    { hour: "2-digit", minute: "2-digit" }
                  )}
                </div>
              )}
            </div>

            {newsData.news?.length > 0 ? (
              <div className="space-y-3 max-h-[500px] overflow-y-auto">
                {newsData.news.map((item: any, i: number) => (
                  <a
                    key={i}
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block group"
                  >
                    <div className="p-3 rounded-lg border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-200">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            {item.aiDirection && <DirectionIcon direction={item.aiDirection} size="sm" />}
                            <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                              {item.title}
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.snippet}</p>
                          {item.aiReason && (
                            <div className="mt-1.5 flex items-start gap-1.5">
                              <Brain className="w-3 h-3 text-purple-500 mt-0.5 shrink-0" />
                              <p className="text-[10px] text-purple-500/80 leading-relaxed line-clamp-2">
                                {item.aiReason}
                              </p>
                            </div>
                          )}
                        </div>
                        <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {item.source && (
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">{item.source}</Badge>
                        )}
                        {item.date && (
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(item.date).toLocaleDateString(
                              isFr ? "fr-FR" : "en-US",
                              { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }
                            )}
                          </span>
                        )}
                        {item.aiDirection && (
                          <Badge className={cn(
                            "text-[8px] px-1.5 py-0 border-0",
                            item.aiDirection === "HAUSSIER" && "bg-profit/15 text-profit",
                            item.aiDirection === "BAISSIER" && "bg-loss/15 text-loss",
                            item.aiDirection === "NEUTRE" && "bg-amber-500/15 text-amber-500",
                          )}>
                            {item.aiDirection}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </a>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">
                {isFr ? "Aucune actualité disponible" : "No news available"}
              </p>
            )}
          </Card>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground/60 text-center px-4">
            {isFr
              ? "⚠️ DONCIEL-AI™ est fourni à titre informatif uniquement et ne constitue pas un conseil financier. L'IA analyse les données en temps réel mais les marchés restent imprévisibles. Effectuez toujours vos propres recherches avant de trader."
              : "⚠️ DONCIEL-AI™ is for informational purposes only and does not constitute financial advice. AI analyzes real-time data but markets remain unpredictable. Always do your own research before trading."}
          </p>
        </div>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Sub-tab: Sentiment (📡)
// ──────────────────────────────────────────────────────

function SentimentSubTab({ language }: { language: string }) {
  const isFr = language === "fr";
  const [sentimentData, setSentimentData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchSentiment = useCallback(async () => {
    try {
      const res = await fetch(`/api/market/sentiment?lang=${language}`);
      if (!res.ok) throw new Error("Fetch failed");
      const data = await res.json();
      setSentimentData(data);
      setError(null);
    } catch {
      setError(isFr ? "Erreur lors du chargement du sentiment" : "Error loading sentiment");
    } finally {
      setLoading(false);
    }
  }, [language, isFr]);

  useEffect(() => {
    fetchSentiment();
    intervalRef.current = setInterval(fetchSentiment, 5 * 60 * 1000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [fetchSentiment]);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <Skeleton className="h-6 w-40 mb-4" />
          <Skeleton className="h-3 w-full mb-2" />
          <Skeleton className="h-8 w-full mb-4" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchSentiment} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="w-4 h-4" />
          {isFr ? "Réessayer" : "Retry"}
        </Button>
      </Card>
    );
  }

  // API returns: fearGreed, vix, smartMoney, retail, contrarianSignal, overallSentiment, interpretation
  const fearGreed = sentimentData?.fearGreed ?? { value: 50, label: "Neutral", trend: "stable" };
  const vix = sentimentData?.vix ?? null;
  const smartMoney = sentimentData?.smartMoney ?? null;
  const retail = sentimentData?.retail ?? null;
  const contrarianSignal = sentimentData?.contrarianSignal ?? null;
  const overallSentiment = sentimentData?.overallSentiment ?? "NEUTRAL";
  const interpretation = sentimentData?.interpretation ?? null;

  const isRiskOn = overallSentiment === "RISK-ON";
  const isRiskOff = overallSentiment === "RISK-OFF";

  // Derive strength from confidence for smartMoney/retail bars
  const confidenceToStrength = (conf: string) => {
    const c = conf?.toLowerCase() || "low";
    if (c.includes("high") || c.includes("élev")) return 85;
    if (c.includes("medium") || c.includes("moyen") || c.includes("modéré")) return 55;
    return 30;
  };

  return (
    <div className="space-y-4">
      {/* Fear & Greed Gauge + Market Regime */}
      <Card className="p-4 sm:p-6">
        <FearGreedGauge value={fearGreed.value} label={fearGreed.label} language={language} />

        <Separator className="my-4" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Market Regime */}
          <div className="p-3 rounded-lg border border-border">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                {isFr ? "Régime de Marché" : "Market Regime"}
              </span>
              <Badge className={cn(
                "text-xs font-bold gap-1",
                isRiskOn && "bg-profit/15 text-profit border-profit/30",
                isRiskOff && "bg-loss/15 text-loss border-loss/30",
                !isRiskOn && !isRiskOff && "bg-amber-500/15 text-amber-500 border-amber-500/30"
              )}>
                {isRiskOn && <TrendingUp className="w-3.5 h-3.5" />}
                {isRiskOff && <TrendingDown className="w-3.5 h-3.5" />}
                {!isRiskOn && !isRiskOff && <Minus className="w-3.5 h-3.5" />}
                {overallSentiment}
              </Badge>
            </div>
          </div>

          {/* VIX */}
          {vix && (
            <div className="p-3 rounded-lg border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-500" />
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    VIX
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">{vix.value}</span>
                  {vix.trend === "rising" && <TrendingUp className="w-4 h-4 text-loss" />}
                  {vix.trend === "declining" && <TrendingDown className="w-4 h-4 text-profit" />}
                  {vix.trend === "stable" && <Minus className="w-4 h-4 text-muted-foreground" />}
                </div>
              </div>
              {vix.interpretation && (
                <p className="text-[10px] text-muted-foreground mt-1">{vix.interpretation}</p>
              )}
            </div>
          )}
        </div>
      </Card>

      {/* Smart Money vs Retail */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Smart Money */}
        {smartMoney && (
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Eye className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-sm">{isFr ? "Smart Money" : "Smart Money"}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{isFr ? "Position" : "Position"}</span>
                <Badge className={cn(
                  "text-xs gap-1",
                  smartMoney.direction?.includes("LONG") && "bg-profit/15 text-profit",
                  smartMoney.direction?.includes("SHORT") && "bg-loss/15 text-loss",
                  !smartMoney.direction?.includes("LONG") && !smartMoney.direction?.includes("SHORT") && "bg-amber-500/15 text-amber-500"
                )}>
                  {smartMoney.direction?.includes("LONG") && <TrendingUp className="w-3 h-3" />}
                  {smartMoney.direction?.includes("SHORT") && <TrendingDown className="w-3 h-3" />}
                  {smartMoney.direction || "NEUTRAL"}
                </Badge>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">{isFr ? "Confiance" : "Confidence"}</span>
                  <span className="text-[10px] font-bold">{smartMoney.confidence || "low"}</span>
                </div>
                <ProbabilityBar
                  value={confidenceToStrength(smartMoney.confidence)}
                  color={smartMoney.direction?.includes("LONG") ? "bg-profit" : smartMoney.direction?.includes("SHORT") ? "bg-loss" : "bg-amber-500"}
                />
              </div>
            </div>
          </Card>
        )}

        {/* Retail */}
        {retail && (
          <Card className="p-4 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <Users className="w-4 h-4 text-amber-500" />
              <h3 className="font-bold text-sm">{isFr ? "Traders Particuliers" : "Retail Traders"}</h3>
            </div>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{isFr ? "Position" : "Position"}</span>
                <Badge className={cn(
                  "text-xs gap-1",
                  retail.direction?.includes("LONG") && "bg-profit/15 text-profit",
                  retail.direction?.includes("SHORT") && "bg-loss/15 text-loss",
                  !retail.direction?.includes("LONG") && !retail.direction?.includes("SHORT") && "bg-amber-500/15 text-amber-500"
                )}>
                  {retail.direction?.includes("LONG") && <TrendingUp className="w-3 h-3" />}
                  {retail.direction?.includes("SHORT") && <TrendingDown className="w-3 h-3" />}
                  {retail.direction || "NEUTRAL"}
                </Badge>
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] text-muted-foreground">{isFr ? "Confiance" : "Confidence"}</span>
                  <span className="text-[10px] font-bold">{retail.confidence || "low"}</span>
                </div>
                <ProbabilityBar
                  value={confidenceToStrength(retail.confidence)}
                  color={retail.direction?.includes("LONG") ? "bg-profit" : retail.direction?.includes("SHORT") ? "bg-loss" : "bg-amber-500"}
                />
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* Contrarian Signal */}
      {contrarianSignal && (
        <Card className={cn(
          "p-4 sm:p-6 border-2",
          contrarianSignal.toLowerCase().includes("buy") || contrarianSignal.toLowerCase().includes("acheter") || contrarianSignal.toLowerCase().includes("long")
            ? "border-profit/30 bg-gradient-to-r from-profit/5 to-transparent"
            : contrarianSignal.toLowerCase().includes("sell") || contrarianSignal.toLowerCase().includes("vendre") || contrarianSignal.toLowerCase().includes("short")
            ? "border-loss/30 bg-gradient-to-r from-loss/5 to-transparent"
            : "border-amber-500/20"
        )}>
          <div className="flex items-center gap-2 mb-2">
            <ShieldAlert className="w-4 h-4 text-purple-500" />
            <h3 className="font-bold text-sm">{isFr ? "Signal Contrarien" : "Contrarian Signal"}</h3>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{contrarianSignal}</p>
        </Card>
      )}

      {/* AI Interpretation */}
      {interpretation && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-3">
            <Brain className="w-4 h-4 text-purple-500" />
            <h3 className="font-bold text-sm">
              {isFr ? "Interprétation DONCIEL-AI™" : "DONCIEL-AI™ Interpretation"}
            </h3>
            <Badge className="bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0 gap-1 text-[9px] px-2 py-0.5 shadow-lg shadow-purple-500/20 shrink-0">
              <Sparkles className="w-3 h-3" />
              AI
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{interpretation}</p>
        </Card>
      )}

      {/* Disclaimer */}
      <p className="text-[10px] text-muted-foreground/60 text-center px-4">
        {isFr
          ? "⚠️ Les données de sentiment sont agrégées à partir de multiples sources et sont fournies à titre indicatif. Elles ne constituent pas un conseil en investissement."
          : "⚠️ Sentiment data is aggregated from multiple sources and provided for informational purposes only. This does not constitute investment advice."}
      </p>
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Sub-tab: Alertes (⏰)
// ──────────────────────────────────────────────────────

function AlertsSubTab({ language }: { language: string }) {
  const isFr = language === "fr";
  const [briefingData, setBriefingData] = useState<any>(null);
  const [calendarData, setCalendarData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [briefingRes, calendarRes] = await Promise.all([
        fetch(`/api/market/briefing?lang=${language}`),
        fetch(`/api/market/calendar?lang=${language}`),
      ]);

      if (briefingRes.ok) {
        const briefing = await briefingRes.json();
        setBriefingData(briefing);
      }
      if (calendarRes.ok) {
        const calendar = await calendarRes.json();
        setCalendarData(calendar);
      }
      setError(null);
    } catch {
      setError(isFr ? "Erreur lors du chargement des alertes" : "Error loading alerts");
    } finally {
      setLoading(false);
    }
  }, [language, isFr]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // API returns: summary, asia, today, keyLevels (string[]), scenarios ({ name, probability, description }[]), riskEvents (string[])
  const summary = briefingData?.summary ?? null;
  const asia = briefingData?.asia ?? null;
  const today = briefingData?.today ?? null;
  const keyLevels: string[] = briefingData?.keyLevels ?? [];
  const scenarios: { name: string; probability: number; description: string }[] = briefingData?.scenarios ?? [];
  const riskEvents: string[] = briefingData?.riskEvents ?? [];

  // Normalize calendar events for countdown (must be before early returns for hooks rules)
  const normalizedCalendarEvents = useMemo(() => {
    const rawEvents: any[] = calendarData?.events || [];
    return rawEvents
      .filter((e: any) => (e.impact || "").toLowerCase() === "high")
      .map((evt: any) => {
        const todayDate = new Date();
        let eventDate: Date;
        if (evt.date) {
          eventDate = new Date(evt.date);
        } else if (evt.time) {
          const [h, m] = evt.time.split(":").map(Number);
          eventDate = new Date(todayDate.getFullYear(), todayDate.getMonth(), todayDate.getDate(), h || 0, m || 0);
        } else {
          eventDate = todayDate;
        }
        return {
          title: evt.event || evt.title || "",
          date: eventDate.toISOString(),
          currency: (evt.currency || "").toUpperCase(),
          countryFlag: evt.country || "🌍",
        };
      })
      .filter((e: any) => new Date(e.date) > new Date())
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [calendarData]);

  // Determine scenario type from name
  const getScenarioType = useCallback((name: string): "BULLISH" | "BEARISH" | "NEUTRAL" => {
    const n = name.toLowerCase();
    if (n.includes("bull") || n.includes("hauss") || n.includes("optimist")) return "BULLISH";
    if (n.includes("bear") || n.includes("baiss") || n.includes("pessimist")) return "BEARISH";
    return "NEUTRAL";
  }, []);

  if (loading) {
    return (
      <div className="space-y-4">
        <Card className="p-6">
          <Skeleton className="h-6 w-48 mb-4" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </Card>
        <div className="grid grid-cols-3 gap-3">
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <Card className="p-12 text-center">
        <AlertTriangle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
        <p className="text-muted-foreground">{error}</p>
        <Button onClick={fetchData} variant="outline" className="mt-4 gap-2">
          <RefreshCw className="w-4 h-4" />
          {isFr ? "Réessayer" : "Retry"}
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Morning Briefing */}
      {summary && (
        <Card className="p-4 sm:p-6 border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
          <div className="flex items-center gap-2 mb-3">
            <Sunrise className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm">
              {isFr ? "Briefing du Jour" : "Morning Briefing"}
            </h3>
            <Badge className="bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0 gap-1 text-[9px] px-2 py-0.5 shadow-lg shadow-purple-500/20 shrink-0">
              <Sparkles className="w-3 h-3" />
              DONCIEL-AI™
            </Badge>
          </div>

          {/* Summary */}
          <p className="text-sm text-muted-foreground leading-relaxed mb-3">{summary}</p>

          {/* Asia session */}
          {asia && (
            <div className="p-2.5 rounded-lg border border-border bg-card/50 mb-2">
              <div className="flex items-center gap-1.5 mb-1">
                <Globe className="w-3 h-3 text-amber-500" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isFr ? "Session Asiatique" : "Asian Session"}
                </span>
              </div>
              <p className="text-xs leading-relaxed">{asia}</p>
            </div>
          )}

          {/* Today */}
          {today && (
            <div className="p-2.5 rounded-lg border border-border bg-card/50">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {isFr ? "Aujourd'hui" : "Today"}
                </span>
              </div>
              <p className="text-xs leading-relaxed">{today}</p>
            </div>
          )}
        </Card>
      )}

      {/* 3 Scenario Cards */}
      {scenarios.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {scenarios.map((scenario, i) => {
            const scenarioType = getScenarioType(scenario.name);
            const isBull = scenarioType === "BULLISH";
            const isBear = scenarioType === "BEARISH";
            return (
              <Card key={i} className={cn(
                "p-4 border-2",
                isBull && "border-profit/20 bg-gradient-to-br from-profit/5 to-transparent",
                isBear && "border-loss/20 bg-gradient-to-br from-loss/5 to-transparent",
                !isBull && !isBear && "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent"
              )}>
                <div className="flex items-center gap-2 mb-2">
                  {isBull && <TrendingUp className="w-4 h-4 text-profit" />}
                  {isBear && <TrendingDown className="w-4 h-4 text-loss" />}
                  {!isBull && !isBear && <Minus className="w-4 h-4 text-amber-500" />}
                  <span className={cn(
                    "text-xs font-bold",
                    isBull && "text-profit",
                    isBear && "text-loss",
                    !isBull && !isBear && "text-amber-500"
                  )}>
                    {isBull ? (isFr ? "🟢 Haussier" : "🟢 Bullish")
                      : isBear ? (isFr ? "🔴 Baissier" : "🔴 Bearish")
                      : (isFr ? "🟡 Neutre" : "🟡 Neutral")}
                  </span>
                </div>
                <div className="mb-2">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[10px] text-muted-foreground">{isFr ? "Probabilité" : "Probability"}</span>
                    <span className="text-[10px] font-bold">{scenario.probability}%</span>
                  </div>
                  <ProbabilityBar
                    value={scenario.probability}
                    color={isBull ? "bg-profit" : isBear ? "bg-loss" : "bg-amber-500"}
                  />
                </div>
                {scenario.description && (
                  <p className="text-[10px] text-muted-foreground leading-relaxed mt-2">{scenario.description}</p>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Key Levels Watchlist */}
      {keyLevels.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Target className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm">{isFr ? "Niveaux Clés à Surveiller" : "Key Levels to Watch"}</h3>
          </div>
          <div className="space-y-2">
            {keyLevels.map((level, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg border border-border">
                <CircleDot className="w-3 h-3 text-primary shrink-0" />
                <span className="text-xs leading-relaxed">{level}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Risk Events Timeline */}
      {riskEvents.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Flame className="w-4 h-4 text-loss" />
            <h3 className="font-bold text-sm">{isFr ? "Événements à Risque" : "Risk Events"}</h3>
          </div>
          <div className="space-y-2">
            {riskEvents.map((evt, i) => (
              <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg border border-loss/20 bg-loss/5">
                <AlertTriangle className="w-3.5 h-3.5 text-loss shrink-0" />
                <span className="text-xs">{evt}</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Upcoming High-Impact Events with Countdown */}
      {normalizedCalendarEvents.length > 0 && (
        <Card className="p-4 sm:p-6">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-4 h-4 text-amber-500" />
            <h3 className="font-bold text-sm">{isFr ? "Prochains Événements à Fort Impact" : "Upcoming High-Impact Events"}</h3>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {normalizedCalendarEvents.slice(0, 8).map((evt: any, i: number) => (
              <div key={i} className="flex items-center justify-between p-2.5 rounded-lg border border-border hover:border-loss/20 transition-colors">
                <div className="flex items-center gap-3">
                  <span className="text-xs">🔴</span>
                  <div>
                    <h4 className="text-xs font-medium">{evt.title}</h4>
                    <div className="flex items-center gap-1 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">{evt.currency}</span>
                      <span className="text-xs">{evt.countryFlag}</span>
                    </div>
                  </div>
                </div>
                <CountdownTimer targetDate={evt.date} language={language} />
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* No data fallback */}
      {!summary && scenarios.length === 0 && keyLevels.length === 0 && riskEvents.length === 0 && normalizedCalendarEvents.length === 0 && (
        <Card className="p-8 text-center">
          <Clock className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">
            {isFr ? "Aucune alerte pour le moment" : "No alerts at this time"}
          </p>
        </Card>
      )}
    </div>
  );
}

// ──────────────────────────────────────────────────────
// Main Component: NewsTab (exported as MARCHÉ)
// ──────────────────────────────────────────────────────

export function NewsTab() {
  const { language } = useAppStore();
  const [subTab, setSubTab] = useState<SubTab>("calendar");
  const [refreshKey, setRefreshKey] = useState(0);
  const isFr = language === "fr";

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  const SUB_TABS: { id: SubTab; icon: typeof CalendarClock; label_fr: string; label_en: string }[] = [
    { id: "calendar", icon: CalendarClock, label_fr: "Calendrier", label_en: "Calendar" },
    { id: "analysis", icon: Brain, label_fr: "Analyse IA", label_en: "AI Analysis" },
    { id: "sentiment", icon: Radio, label_fr: "Sentiment", label_en: "Sentiment" },
    { id: "alerts", icon: Timer, label_fr: "Alertes", label_en: "Alerts" },
  ];

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald bg-clip-text text-transparent">
            MARCHÉ
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {isFr
              ? "Radar fondamental en temps réel — DONCIEL-AI™"
              : "Real-time fundamental radar — DONCIEL-AI™"}
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleRefresh}
        >
          <RefreshCw className="w-4 h-4" />
          {isFr ? "Actualiser" : "Refresh"}
        </Button>
      </div>

      {/* Sub-tab navigation pills */}
      <div className="flex flex-wrap gap-2">
        {SUB_TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = subTab === tab.id;
          return (
            <Button
              key={tab.id}
              variant={isActive ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={() => setSubTab(tab.id)}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="text-xs">{isFr ? tab.label_fr : tab.label_en}</span>
            </Button>
          );
        })}
      </div>

      <Separator />

      {/* Sub-tab content */}
      {subTab === "calendar" && <CalendarSubTab key={`calendar-${refreshKey}`} language={language} />}
      {subTab === "analysis" && <AnalysisSubTab key={`analysis-${refreshKey}`} language={language} />}
      {subTab === "sentiment" && <SentimentSubTab key={`sentiment-${refreshKey}`} language={language} />}
      {subTab === "alerts" && <AlertsSubTab key={`alerts-${refreshKey}`} language={language} />}
    </div>
  );
}
