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
} from "lucide-react";

export function RoleManagementTab() {
  const { user, language } = useAppStore();
  const isAdmin = user?.role === "admin";

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
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
        <TabsList>
          <TabsTrigger value="individual" className="gap-1">
            <Users className="w-3.5 h-3.5" />
            {t(language, "individualStats")}
          </TabsTrigger>
          <TabsTrigger value="global" className="gap-1">
            <Crown className="w-3.5 h-3.5" />
            {t(language, "globalStats")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="individual">
          <IndividualStats language={language} />
        </TabsContent>

        <TabsContent value="global">
          <GlobalStats language={language} isAdmin={isAdmin} />
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

function IndividualStats({ language }: { language: "fr" | "en" }) {
  const { stats, loading, refetch } = useStats();

  // Fetch on mount
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
      {/* Metrics */}
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

      {/* Breakdown */}
      {hasData && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* By Direction */}
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

          {/* By Session */}
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

          {/* By Pair */}
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

          {/* By Timeframe */}
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

function GlobalStats({ language, isAdmin }: { language: "fr" | "en"; isAdmin: boolean }) {
  const { stats, loading, refetch } = useGlobalStats();

  // Fetch on mount
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

      {/* Breakdown */}
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
