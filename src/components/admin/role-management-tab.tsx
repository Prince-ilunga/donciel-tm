"use client";

import React, { useState, useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useStats, useGlobalStats } from "@/lib/hooks";
import { MetricCard } from "@/components/shared/metric-card";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  Crown,
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  DollarSign,
  Users,
  Activity,
  Lock,
  Award,
  Zap,
  AlertTriangle,
  ArrowUpRight,
  Minus,
  ArrowDownRight,
  PieChart,
} from "lucide-react";

// ─── BILAN Types ────────────────────────────────────────────
interface ConfigItem {
  key: string;
  label: string;
  category: string;
  count: number;
  wins: number;
  winRate: number;
  totalRR: number;
  avgRR: number;
  totalPnL: number;
  performance: 'best' | 'average' | 'weak';
}

interface BilanData {
  best: ConfigItem[];
  average: ConfigItem[];
  weak: ConfigItem[];
}

// ─── Main Component ─────────────────────────────────────────
export function RoleManagementTab() {
  const { user, language } = useAppStore();
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald bg-clip-text text-transparent">
          {t(language, "roleManagement")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "fr"
            ? "Statistiques individuelles et cumulées du système DONCIEL"
            : "Individual and cumulative DONCIEL system statistics"}
        </p>
      </div>

      <Tabs defaultValue="individual">
        <TabsList className="w-full">
          <TabsTrigger value="individual" className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3">
            <Users className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:block" />
            <span className="truncate">{t(language, "individualStats")}</span>
          </TabsTrigger>
          <TabsTrigger value="global" className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3">
            <Crown className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:block" />
            <span className="truncate">{t(language, "globalStats")}</span>
          </TabsTrigger>
          <TabsTrigger value="bilan" className="gap-1 text-[10px] sm:text-xs px-2 sm:px-3">
            <PieChart className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:block" />
            <span className="truncate">{t(language, "bilan")}</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <IndividualStats language={language} />
        </TabsContent>

        <TabsContent value="global">
          <GlobalStats language={language} isAdmin={isAdmin} />
        </TabsContent>

        <TabsContent value="bilan">
          <BilanSection language={language} />
        </TabsContent>
      </Tabs>

      {/* Read-only notice */}
      {!isAdmin && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 bg-muted/30 rounded-lg">
          <Lock className="w-3 h-3" />
          {language === "fr"
            ? "Lecture seule — Seuls les administrateurs peuvent modifier les vidéos et les paramètres"
            : "Read only — Only admins can modify videos and settings"}
        </div>
      )}
    </div>
  );
}

// ─── BILAN Section ──────────────────────────────────────────
function BilanSection({ language }: { language: "fr" | "en" }) {
  const [bilan, setBilan] = useState<BilanData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const res = await fetch("/api/stats/bilan");
        if (res.ok && !cancelled) {
          const data = await res.json();
          setBilan(data.bilan);
        }
      } catch {
        if (!cancelled) setBilan(null);
      }
      if (!cancelled) setLoading(false);
    };
    load();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div className="space-y-6 mt-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4">
              <Skeleton className="h-8 w-32 mb-4" />
              <div className="space-y-2">
                {Array.from({ length: 4 }).map((_, j) => (
                  <Skeleton key={j} className="h-12 w-full" />
                ))}
              </div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!bilan || (bilan.best.length === 0 && bilan.average.length === 0 && bilan.weak.length === 0)) {
    return (
      <div className="mt-4">
        <Card className="p-8 text-center">
          <PieChart className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            {t(language, "noBilanData")}
          </p>
        </Card>
      </div>
    );
  }

  // Group configs by category within each tier
  const groupByCategory = (items: ConfigItem[]) => {
    const groups: Record<string, ConfigItem[]> = {};
    items.forEach(item => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  };

  return (
    <div className="space-y-6 mt-4">
      {/* Section description */}
      <div className="flex items-center gap-2">
        <PieChart className="w-5 h-5 text-primary" />
        <div>
          <h3 className="text-lg font-semibold">{t(language, "bilan")}</h3>
          <p className="text-xs text-muted-foreground">{t(language, "bilanDescription")}</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4 border-emerald-500/20 bg-emerald-500/5">
          <div className="flex items-center gap-2 mb-1">
            <Award className="w-4 h-4 text-emerald-500" />
            <span className="text-[10px] sm:text-xs font-semibold text-emerald-600 dark:text-emerald-400 uppercase leading-tight min-w-0 break-words">
              {t(language, "bestConfigs")}
            </span>
          </div>
          <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{bilan.best.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t(language, "bestConfigsDesc")}</p>
        </Card>
        <Card className="p-4 border-amber-500/20 bg-amber-500/5">
          <div className="flex items-center gap-2 mb-1">
            <Minus className="w-4 h-4 text-amber-500" />
            <span className="text-[10px] sm:text-xs font-semibold text-amber-600 dark:text-amber-400 uppercase leading-tight min-w-0 break-words">
              {t(language, "avgConfigs")}
            </span>
          </div>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{bilan.average.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t(language, "avgConfigsDesc")}</p>
        </Card>
        <Card className="p-4 border-red-500/20 bg-red-500/5">
          <div className="flex items-center gap-2 mb-1">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <span className="text-[10px] sm:text-xs font-semibold text-red-600 dark:text-red-400 uppercase leading-tight min-w-0 break-words">
              {t(language, "weakConfigs")}
            </span>
          </div>
          <p className="text-2xl font-bold text-red-600 dark:text-red-400">{bilan.weak.length}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">{t(language, "weakConfigsDesc")}</p>
        </Card>
      </div>

      {/* Detailed tables for each tier */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* BEST */}
        <BilanTierCard
          tier="best"
          configs={bilan.best}
          language={language}
          icon={Award}
          colorScheme="emerald"
          groupByCategory={groupByCategory}
        />

        {/* AVERAGE */}
        <BilanTierCard
          tier="average"
          configs={bilan.average}
          language={language}
          icon={Minus}
          colorScheme="amber"
          groupByCategory={groupByCategory}
        />

        {/* WEAK */}
        <BilanTierCard
          tier="weak"
          configs={bilan.weak}
          language={language}
          icon={AlertTriangle}
          colorScheme="red"
          groupByCategory={groupByCategory}
        />
      </div>
    </div>
  );
}

// ─── BILAN Tier Card ────────────────────────────────────────
function BilanTierCard({
  tier,
  configs,
  language,
  icon: Icon,
  colorScheme,
  groupByCategory,
}: {
  tier: 'best' | 'average' | 'weak';
  configs: ConfigItem[];
  language: "fr" | "en";
  icon: typeof Award;
  colorScheme: 'emerald' | 'amber' | 'red';
  groupByCategory: (items: ConfigItem[]) => Record<string, ConfigItem[]>;
}) {
  const colorMap = {
    emerald: {
      border: 'border-emerald-500/20',
      bg: 'bg-emerald-500/5',
      text: 'text-emerald-600 dark:text-emerald-400',
      badge: 'border-emerald-500/30 text-emerald-600 dark:text-emerald-400',
      icon: 'text-emerald-500',
      bar: 'bg-emerald-500',
      barBg: 'bg-emerald-500/10',
    },
    amber: {
      border: 'border-amber-500/20',
      bg: 'bg-amber-500/5',
      text: 'text-amber-600 dark:text-amber-400',
      badge: 'border-amber-500/30 text-amber-600 dark:text-amber-400',
      icon: 'text-amber-500',
      bar: 'bg-amber-500',
      barBg: 'bg-amber-500/10',
    },
    red: {
      border: 'border-red-500/20',
      bg: 'bg-red-500/5',
      text: 'text-red-600 dark:text-red-400',
      badge: 'border-red-500/30 text-red-600 dark:text-red-400',
      icon: 'text-red-500',
      bar: 'bg-red-500',
      barBg: 'bg-red-500/10',
    },
  };

  const colors = colorMap[colorScheme];
  const grouped = groupByCategory(configs);

  const tierLabels = {
    best: language === "fr" ? "Meilleures" : "Best",
    average: language === "fr" ? "Moyennes" : "Average",
    weak: language === "fr" ? "Faibles" : "Weak",
  };

  const tierIcons = {
    best: ArrowUpRight,
    average: Minus,
    weak: ArrowDownRight,
  };

  const TierIcon = tierIcons[tier];

  return (
    <Card className={cn("p-4", colors.border, colors.bg)}>
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn("w-5 h-5", colors.icon)} />
        <h4 className={cn("text-sm font-bold uppercase tracking-wide", colors.text)}>
          {tierLabels[tier]}
        </h4>
        <Badge variant="outline" className={cn("ml-auto text-[10px] font-mono", colors.badge)}>
          {configs.length}
        </Badge>
      </div>

      {configs.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          {language === "fr" ? "Aucune configuration" : "No configurations"}
        </p>
      ) : (
        <div className="space-y-3 max-h-[500px] overflow-y-auto">
          {Object.entries(grouped).map(([category, items]) => (
            <div key={category}>
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                  {category}
                </span>
                <Separator className="flex-1" />
              </div>
              <div className="space-y-1.5">
                {items.map((item) => (
                  <div
                    key={`${item.category}-${item.key}`}
                    className="flex items-center gap-2 p-2 rounded-lg bg-background/50 hover:bg-background/80 transition-colors"
                  >
                    <TierIcon className={cn("w-3 h-3 shrink-0", colors.icon)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-semibold truncate">{item.label}</span>
                      </div>
                      {/* Win rate progress bar */}
                      <div className={cn("h-1 rounded-full mt-1", colors.barBg)}>
                        <div
                          className={cn("h-full rounded-full transition-all", colors.bar)}
                          style={{ width: `${Math.min(item.winRate, 100)}%` }}
                        />
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className={cn("text-xs font-mono font-bold", colors.text)}>
                        {item.winRate.toFixed(0)}%
                      </div>
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {item.avgRR >= 0 ? '+' : ''}{item.avgRR.toFixed(2)} RR
                      </div>
                    </div>
                    <div className="text-right shrink-0 w-10">
                      <div className="text-[10px] text-muted-foreground font-mono">
                        {item.count} {language === "fr" ? "trades" : "trades"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

// ─── Individual Stats (unchanged) ───────────────────────────
function IndividualStats({ language }: { language: "fr" | "en" }) {
  const { stats, loading, refetch } = useStats();

  React.useEffect(() => { refetch(); }, [refetch]);
  const statsData = (stats as any)?.stats ?? stats;

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
      </div>
    );
  }

  const hasData = statsData?.totalTrades > 0;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={t(language, "totalTrades")} value={statsData?.totalTrades ?? 0} icon={BarChart3} />
        <MetricCard
          label={t(language, "winRate")}
          value={`${(statsData?.winRate ?? 0).toFixed(1)}%`}
          icon={statsData?.winRate >= 50 ? TrendingUp : TrendingDown}
          trend={statsData?.winRate >= 50 ? "up" : "down"}
        />
        <MetricCard
          label={t(language, "totalRR")}
          value={(statsData?.totalRR ?? 0).toFixed(2)}
          icon={Target}
          trend={(statsData?.totalRR ?? 0) > 0 ? "up" : "neutral"}
        />
        <MetricCard
          label={t(language, "avgRR")}
          value={(statsData?.avgRR ?? 0).toFixed(2)}
          icon={Activity}
        />
        <MetricCard
          label={t(language, "bestRR")}
          value={(statsData?.bestRR ?? 0).toFixed(2)}
          icon={TrendingUp}
          trend="up"
        />
        <MetricCard
          label={t(language, "worstRR")}
          value={(statsData?.worstRR ?? 0).toFixed(2)}
          icon={TrendingDown}
          trend="down"
        />
        <MetricCard
          label={t(language, "totalPnL")}
          value={`${(statsData?.totalPnL ?? 0) >= 0 ? "+" : ""}${(statsData?.totalPnL ?? 0).toFixed(2)}`}
          icon={DollarSign}
          trend={(statsData?.totalPnL ?? 0) > 0 ? "up" : (statsData?.totalPnL ?? 0) < 0 ? "down" : "neutral"}
        />
        <MetricCard
          label={t(language, "profitFactor")}
          value={statsData?.profitFactor === Infinity ? "∞" : (statsData?.profitFactor ?? 0).toFixed(2)}
          icon={Activity}
        />
      </div>

      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">{t(language, "rrByDirection")}</h4>
            <div className="space-y-2">
              {Object.entries(statsData?.byDirection || {}).map(([key, val]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className={cn("font-mono", key === "LONG" ? "text-profit" : "text-loss")}>
                      {key}
                    </Badge>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold">{val.totalRR.toFixed(2)} RR</div>
                    <div className="text-xs text-muted-foreground">{val.count} trades • {val.winRate.toFixed(0)}% WR</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">{t(language, "performanceBySession")}</h4>
            <div className="space-y-2">
              {Object.entries(statsData?.bySession || {}).map(([key, val]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <Badge variant="outline" className="text-xs">{key}</Badge>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold">{val.totalRR.toFixed(2)} RR</div>
                    <div className="text-xs text-muted-foreground">{val.count} trades • {val.winRate.toFixed(0)}% WR</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">{t(language, "performanceByAsset")}</h4>
            <div className="space-y-2">
              {Object.entries(statsData?.byPair || {}).map(([key, val]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <Badge variant="outline" className="font-mono text-xs">{key}</Badge>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold">{val.totalRR.toFixed(2)} RR</div>
                    <div className="text-xs text-muted-foreground">{val.count} trades • {val.winRate.toFixed(0)}% WR</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <h4 className="text-sm font-semibold mb-3">{t(language, "performanceByTimeframe")}</h4>
            <div className="space-y-2">
              {Object.entries(statsData?.byTimeframe || {}).map(([key, val]: [string, any]) => (
                <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <Badge variant="outline" className="font-mono text-xs">{key}</Badge>
                  <div className="text-right">
                    <div className="text-sm font-mono font-semibold">{val.totalRR.toFixed(2)} RR</div>
                    <div className="text-xs text-muted-foreground">{val.count} trades • {val.winRate.toFixed(0)}% WR</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Global Stats (unchanged) ───────────────────────────────
function GlobalStats({ language, isAdmin }: { language: "fr" | "en"; isAdmin: boolean }) {
  const { stats, loading, refetch } = useGlobalStats();

  React.useEffect(() => { refetch(); }, [refetch]);
  const statsData = (stats as any)?.stats ?? stats;

  if (loading) {
    return (
      <div className="space-y-4 mt-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-2 mb-2">
        <Crown className="w-5 h-5 text-primary" />
        <h3 className="text-lg font-semibold">{t(language, "globalStats")}</h3>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <MetricCard label={t(language, "totalTrades")} value={statsData?.totalTrades ?? 0} icon={BarChart3} />
        <MetricCard
          label={t(language, "winRate")}
          value={`${(statsData?.winRate ?? 0).toFixed(1)}%`}
          icon={statsData?.winRate >= 50 ? TrendingUp : TrendingDown}
        />
        <MetricCard label={t(language, "totalRR")} value={(statsData?.totalRR ?? 0).toFixed(2)} icon={Target} />
        <MetricCard label={t(language, "avgRR")} value={(statsData?.avgRR ?? 0).toFixed(2)} icon={Activity} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">{t(language, "performanceByAsset")}</h4>
          <div className="space-y-2">
            {Object.entries(statsData?.byPair || {}).map(([key, val]: [string, any]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <Badge variant="outline" className="font-mono text-xs">{key}</Badge>
                <div className="text-right">
                  <div className="text-sm font-mono font-semibold">{val.totalRR.toFixed(2)} RR</div>
                  <div className="text-xs text-muted-foreground">{val.count} trades</div>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <h4 className="text-sm font-semibold mb-3">{t(language, "performanceBySession")}</h4>
          <div className="space-y-2">
            {Object.entries(statsData?.bySession || {}).map(([key, val]: [string, any]) => (
              <div key={key} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                <Badge variant="outline" className="text-xs">{key}</Badge>
                <div className="text-right">
                  <div className="text-sm font-mono font-semibold">{val.totalRR.toFixed(2)} RR</div>
                  <div className="text-xs text-muted-foreground">{val.count} trades</div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
