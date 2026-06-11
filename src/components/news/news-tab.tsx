"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Newspaper,
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
} from "lucide-react";

const ASSETS = [
  { id: "XAUUSD", emoji: "🥇", label_fr: "Or / Dollar", label_en: "Gold / Dollar", color: "from-amber-500/10 to-yellow-500/10" },
  { id: "EURUSD", emoji: "🇪🇺", label_fr: "Euro / Dollar", label_en: "Euro / Dollar", color: "from-blue-500/10 to-indigo-500/10" },
  { id: "GBPUSD", emoji: "🇬🇧", label_fr: "Livre / Dollar", label_en: "Pound / Dollar", color: "from-red-500/10 to-rose-500/10" },
  { id: "US30", emoji: "🏭", label_fr: "Dow Jones 30", label_en: "Dow Jones 30", color: "from-emerald-500/10 to-green-500/10" },
  { id: "US100", emoji: "💻", label_fr: "Nasdaq 100", label_en: "Nasdaq 100", color: "from-purple-500/10 to-violet-500/10" },
] as const;

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
      {isHigh && <AlertTriangle className="w-3 h-3" />}
      {isHigh && <Zap className="w-3 h-3" />}
      {!isHigh && !isLow && <Shield className="w-3 h-3" />}
      {impact || "N/A"}
    </Badge>
  );
}

export function NewsTab() {
  const { language } = useAppStore();
  const [activeAsset, setActiveAsset] = useState<string>("XAUUSD");
  const [newsData, setNewsData] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchNews = useCallback(async (asset: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/news?asset=${asset}&lang=${language}`);
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
    fetchNews(activeAsset);
  }, [activeAsset, fetchNews]);

  const handleRefresh = () => {
    fetchNews(activeAsset);
  };

  const currentAsset = ASSETS.find(a => a.id === activeAsset);
  const analysis = newsData?.analysis;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald bg-clip-text text-transparent">
            {language === "fr" ? "Analyse Fondamentale" : "Fundamental Analysis"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {language === "fr"
              ? "News en temps réel et interprétation IA pour vos actifs"
              : "Real-time news and AI interpretation for your assets"}
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
          {/* AI Analysis Card */}
          {analysis && (
            <Card className={cn(
              "p-4 sm:p-6 border-2",
              analysis.direction?.toUpperCase().includes("HAUSS") || analysis.direction?.toUpperCase().includes("BULL")
                ? "border-profit/20 bg-gradient-to-br from-profit/5 to-transparent"
                : analysis.direction?.toUpperCase().includes("BAISS") || analysis.direction?.toUpperCase().includes("BEAR")
                ? "border-loss/20 bg-gradient-to-br from-loss/5 to-transparent"
                : "border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-transparent"
            )}>
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center",
                    analysis.direction?.toUpperCase().includes("HAUSS") || analysis.direction?.toUpperCase().includes("BULL")
                      ? "bg-profit/10" : analysis.direction?.toUpperCase().includes("BAISS") || analysis.direction?.toUpperCase().includes("BEAR")
                      ? "bg-loss/10" : "bg-amber-500/10"
                  )}>
                    <Newspaper className={cn(
                      "w-5 h-5",
                      analysis.direction?.toUpperCase().includes("HAUSS") || analysis.direction?.toUpperCase().includes("BULL")
                        ? "text-profit" : analysis.direction?.toUpperCase().includes("BAISS") || analysis.direction?.toUpperCase().includes("BEAR")
                        ? "text-loss" : "text-amber-500"
                    )} />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">
                      {language === "fr" ? "Interprétation IA" : "AI Interpretation"} — {activeAsset}
                    </h3>
                    <p className="text-[10px] text-muted-foreground">
                      {currentAsset && (language === "fr" ? currentAsset.label_fr : currentAsset.label_en)}
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

              {/* Key Factors + Impact + Recommendation */}
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
            </Card>
          )}

          {/* News Feed */}
          <Card className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm">
                  {language === "fr" ? "News en Temps Réel" : "Real-Time News"} — {activeAsset}
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
              <div className="space-y-3 max-h-96 overflow-y-auto">
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
                          <h4 className="text-sm font-medium group-hover:text-primary transition-colors line-clamp-2">
                            {item.title}
                          </h4>
                          <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                            {item.snippet}
                          </p>
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
              ? "⚠️ L'interprétation IA est fournie à titre informatif uniquement et ne constitue pas un conseil financier. Toujours faire vos propres recherches avant de trader."
              : "⚠️ AI interpretation is for informational purposes only and does not constitute financial advice. Always do your own research before trading."}
          </p>
        </div>
      )}
    </div>
  );
}
