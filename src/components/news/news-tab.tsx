"use client";

import React, { useState, useCallback, useEffect, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
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
} from "lucide-react";

const ASSETS = [
  { id: "XAUUSD", emoji: "🥇", label_fr: "Or / Dollar", label_en: "Gold / Dollar", color: "from-amber-500/10 to-yellow-500/10" },
  { id: "EURUSD", emoji: "🇪🇺", label_fr: "Euro / Dollar", label_en: "Euro / Dollar", color: "from-blue-500/10 to-indigo-500/10" },
  { id: "GBPUSD", emoji: "🇬🇧", label_fr: "Livre / Dollar", label_en: "Pound / Dollar", color: "from-red-500/10 to-rose-500/10" },
  { id: "US30", emoji: "🏭", label_fr: "Dow Jones 30", label_en: "Dow Jones 30", color: "from-emerald-500/10 to-green-500/10" },
  { id: "US100", emoji: "💻", label_fr: "Nasdaq 100", label_en: "Nasdaq 100", color: "from-purple-500/10 to-violet-500/10" },
] as const;

const DAYS_ORDER = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const DAYS_FR: Record<string, string> = { Mon: "Lun", Tue: "Mar", Wed: "Mer", Thu: "Jeu", Fri: "Ven", Sat: "Sam", Sun: "Dim" };

const barChartConfig = {
  count: {
    label: "News",
    color: "hsl(var(--primary))",
  },
} as const;

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

function SentimentGauge({ sentiment }: { sentiment: string }) {
  const s = sentiment?.toLowerCase() || "neutre";
  const isVeryBull = s.includes("très haus") || s.includes("very bull") || s.includes("strongly bull");
  const isBull = s.includes("haus") || s.includes("bull") || s.includes("acheteur");
  const isVeryBear = s.includes("très bai") || s.includes("very bear") || s.includes("strongly bear");
  const isBear = s.includes("bai") || s.includes("bear") || s.includes("vendeur");

  const value = isVeryBull ? 90 : isBull ? 70 : isVeryBear ? 10 : isBear ? 30 : 50;
  const label = isVeryBull ? (s.includes("haus") ? "Très Haussier" : "Very Bullish")
    : isBull ? (s.includes("haus") ? "Haussier" : "Bullish")
    : isVeryBear ? (s.includes("bai") ? "Très Baissier" : "Very Bearish")
    : isBear ? (s.includes("bai") ? "Baissier" : "Bearish")
    : (s.includes("neutre") ? "Neutre" : "Neutral");

  const color = value >= 70 ? "bg-profit" : value >= 55 ? "bg-profit/60" : value <= 30 ? "bg-loss" : value <= 45 ? "bg-loss/60" : "bg-amber-500";

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium text-muted-foreground">Sentiment</span>
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

type PeriodFilter = "today" | "week";

export function NewsTab() {
  const { language } = useAppStore();
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
      if (!res.ok) {
        throw new Error("Erreur lors du chargement");
      }
      const data = await res.json();
      setNewsData(data);
    } catch {
      setError(language === "fr" ? "Erreur lors du chargement des news" : "Error loading news");
    }
    setLoading(false);
  }, [language]);

  useEffect(() => {
    fetchNews(activeAsset, periodFilter);
  }, [activeAsset, periodFilter, fetchNews]);

  const handleRefresh = () => {
    fetchNews(activeAsset, periodFilter);
  };

  const currentAsset = ASSETS.find(a => a.id === activeAsset);
  const analysis = newsData?.analysis;
  const aiPowered = newsData?.aiPowered;

  // Bar chart data
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

  // Upcoming events count
  const upcomingCount = newsData?.upcomingEvents?.length || 0;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald bg-clip-text text-transparent">
            {language === "fr" ? "Analyse Fondamentale" : "Fundamental Analysis"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr"
              ? "Interprétation IA spécialisée en finance sur données réelles"
              : "Finance-specialized AI interpretation on real-time data"}
          </p>
        </div>
        <Button
          variant="outline"
          className="gap-2"
          onClick={handleRefresh}
          disabled={loading}
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {language === "fr" ? "Actualiser" : "Refresh"}
        </Button>
      </div>

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
          {language === "fr" ? "Aujourd'hui" : "Today"}
        </Button>
        <Button
          variant={periodFilter === "week" ? "default" : "outline"}
          size="sm"
          className={cn("gap-1.5", periodFilter === "week" && "shadow-sm")}
          onClick={() => setPeriodFilter("week")}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          {language === "fr" ? "Cette Semaine" : "This Week"}
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
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
              <Skeleton className="h-16 w-full" />
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
            {language === "fr" ? "Réessayer" : "Retry"}
          </Button>
        </Card>
      )}

      {/* Content */}
      {newsData && !loading && !error && (
        <div className="space-y-4">
          {/* ============================================ */}
          {/* DONCIEL-AI™ Finance Analysis Card            */}
          {/* ============================================ */}
          {analysis && (
            <Card className={cn(
              "p-4 sm:p-6 border-2 overflow-hidden relative",
              analysis.direction?.toUpperCase().includes("HAUSS") || analysis.direction?.toUpperCase().includes("BULL")
                ? "border-profit/20 bg-gradient-to-br from-profit/5 to-transparent"
                : analysis.direction?.toUpperCase().includes("BAISS") || analysis.direction?.toUpperCase().includes("BEAR")
                ? "border-loss/20 bg-gradient-to-br from-loss/5 to-transparent"
                : "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent"
            )}>
              {/* AI Powered Badge */}
              {aiPowered && (
                <div className="absolute top-3 right-3">
                  <Badge className="bg-gradient-to-r from-violet-600 to-purple-600 text-white border-0 gap-1 text-[9px] px-2 py-0.5 shadow-lg shadow-purple-500/20">
                    <Sparkles className="w-3 h-3" />
                    DONCIEL-AI™
                  </Badge>
                </div>
              )}

              {/* Header */}
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-11 h-11 rounded-xl flex items-center justify-center",
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
                  <div>
                    <h3 className="font-bold text-sm">
                      {aiPowered
                        ? (language === "fr" ? "IA Finance Spécialisée" : "Finance AI Specialist")
                        : (language === "fr" ? "Interprétation IA" : "AI Interpretation")} — {activeAsset}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      {currentAsset && (language === "fr" ? currentAsset.label_fr : currentAsset.label_en)}
                      {periodFilter === "today"
                        ? (language === "fr" ? " · Aujourd'hui" : " · Today")
                        : (language === "fr" ? " · Cette semaine" : " · This Week")}
                      {aiPowered && (
                        <span className="ml-1 text-purple-500">
                          · {language === "fr" ? "Analyse CFA en temps réel" : "CFA-level real-time analysis"}
                        </span>
                      )}
                    </p>
                  </div>
                </div>
                <DirectionBadge direction={analysis.direction} confidence={analysis.confidence} />
              </div>

              {/* Summary */}
              {analysis.summary && (
                <p className="text-sm text-muted-foreground mb-4 leading-relaxed">
                  {analysis.summary}
                </p>
              )}

              <Separator className="mb-4" />

              {/* Sentiment Gauge */}
              {analysis.sentiment && (
                <div className="mb-4">
                  <SentimentGauge sentiment={analysis.sentiment} />
                </div>
              )}

              {/* Key Factors + Right column */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {/* Key Factors */}
                {analysis.keyFactors && analysis.keyFactors.length > 0 && (
                  <div className="sm:col-span-2">
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {language === "fr" ? "Facteurs Clés" : "Key Factors"}
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
                  {/* Impact */}
                  <div>
                    <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                      {language === "fr" ? "Impact" : "Impact"}
                    </h4>
                    {analysis.impact && <ImpactBadge impact={analysis.impact} />}
                  </div>

                  {/* Recommendation */}
                  {analysis.recommendation && (
                    <div>
                      <h4 className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                        {language === "fr" ? "Conseil" : "Advice"}
                      </h4>
                      <p className="text-xs bg-primary/5 border border-primary/10 rounded-lg p-2.5">
                        💡 {analysis.recommendation}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Short-term & Medium-term — only when AI is active */}
              {(analysis.shortTerm || analysis.mediumTerm) && (
                <>
                  <Separator className="my-4" />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {analysis.shortTerm && (
                      <div className="p-3 rounded-lg border border-border bg-card/50">
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <Activity className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                            {language === "fr" ? "Court Terme (Intraday)" : "Short Term (Intraday)"}
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
                            {language === "fr" ? "Moyen Terme (Swing)" : "Medium Term (Swing)"}
                          </span>
                        </div>
                        <p className="text-xs leading-relaxed">{analysis.mediumTerm}</p>
                      </div>
                    )}
                  </div>
                </>
              )}

              {/* Risk Warning */}
              {analysis.riskWarning && (
                <div className="mt-3 p-2.5 rounded-lg border border-loss/20 bg-loss/5">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-3.5 h-3.5 text-loss mt-0.5 shrink-0" />
                    <p className="text-[11px] text-loss/80 leading-relaxed">
                      {analysis.riskWarning}
                    </p>
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
                    {language === "fr" ? "News de la Semaine" : "Weekly News"}
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  {upcomingCount > 0 && (
                    <Badge variant="outline" className="text-[10px] gap-1 border-amber-500/40 text-amber-500">
                      <CalendarClock className="w-3 h-3" />
                      {upcomingCount} {language === "fr" ? "à venir" : "upcoming"}
                    </Badge>
                  )}
                  <Badge variant="secondary" className="text-[10px]">
                    {newsData.news?.length || 0} {language === "fr" ? "news" : "news"}
                  </Badge>
                </div>
              </div>
              <ChartContainer config={barChartConfig} className="h-[180px] w-full">
                <BarChart data={barChartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border/50" />
                  <XAxis
                    dataKey="day"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }}
                    allowDecimals={false}
                  />
                  <ChartTooltip
                    content={<ChartTooltipContent />}
                  />
                  <Bar
                    dataKey="count"
                    fill="hsl(var(--primary))"
                    radius={[4, 4, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ChartContainer>
            </Card>
          )}

          {/* Upcoming Economic Events */}
          {periodFilter === "week" && newsData.upcomingEvents?.length > 0 && (
            <Card className="p-4 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <CalendarClock className="w-4 h-4 text-amber-500" />
                <h3 className="font-bold text-sm">
                  {language === "fr" ? "Événements Économiques à Venir" : "Upcoming Economic Events"}
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
                    ? (language === "fr" ? "News du Jour" : "Today's News")
                    : (language === "fr" ? "News de la Semaine" : "This Week's News")} — {activeAsset}
                </h3>
                {newsData.news?.length > 0 && (
                  <Badge variant="secondary" className="text-[10px]">
                    {newsData.news.length}
                  </Badge>
                )}
              </div>
              {newsData.updatedAt && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {new Date(newsData.updatedAt).toLocaleTimeString(
                    language === "fr" ? "fr-FR" : "en-US",
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
                            {/* AI Direction Tag */}
                            {item.aiDirection && (
                              <DirectionIcon direction={item.aiDirection} size="sm" />
                            )}
                            <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                              {item.title}
                            </h4>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.snippet}
                          </p>
                          {/* AI Reason Tag */}
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
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {item.source}
                          </Badge>
                        )}
                        {item.date && (
                          <span className="text-[9px] text-muted-foreground">
                            {new Date(item.date).toLocaleDateString(
                              language === "fr" ? "fr-FR" : "en-US",
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
                {language === "fr" ? "Aucune news disponible" : "No news available"}
              </p>
            )}
          </Card>

          {/* Disclaimer */}
          <p className="text-[10px] text-muted-foreground/60 text-center px-4">
            {language === "fr"
              ? "⚠️ DONCIEL-AI™ est fourni à titre informatif uniquement et ne constitue pas un conseil financier. L'IA analyse les données en temps réel mais les marchés restent imprévisibles. Toujours faire vos propres recherches avant de trader."
              : "⚠️ DONCIEL-AI™ is for informational purposes only and does not constitute financial advice. AI analyzes real-time data but markets remain unpredictable. Always do your own research before trading."}
          </p>
        </div>
      )}
    </div>
  );
}
