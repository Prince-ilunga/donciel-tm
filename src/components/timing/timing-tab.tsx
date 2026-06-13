"use client";

import React, { useState, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { useStats, useTrades } from "@/lib/hooks";
import { useTimeFilter } from "@/lib/use-time-filter";
import { TimeFilterBar } from "@/components/shared/time-filter-bar";
import { MetricCard } from "@/components/shared/metric-card";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  BarChart3,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Area,
  AreaChart,
} from "recharts";

const DAY_LABELS_FR = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const DAY_LABELS_EN = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export function TimingTab() {
  const { language } = useAppStore();
  const { period, setPeriod, filters } = useTimeFilter();
  const { stats, loading, refetch: refetchStats } = useStats(filters);
  const { trades, refetch: refetchTrades } = useTrades(filters);

  // Fetch data on mount
  React.useEffect(() => { refetchStats(); refetchTrades(); }, [refetchStats, refetchTrades]);
  const statsData = (stats as any)?.stats ?? stats;

  const dayLabels = language === "fr" ? DAY_LABELS_FR : DAY_LABELS_EN;
  const hasData = statsData?.totalTrades > 0;

  // Cumulative data from trades
  const cumulativeData = useMemo(() => {
    if (!trades.length) return [];
    let cumRR = 0;
    return trades.map((trade: any, i: number) => {
      cumRR += trade.rr || 0;
      return { trade: i + 1, rr: parseFloat(cumRR.toFixed(2)) };
    });
  }, [trades]);

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-64 w-full" /></Card>
          ))}
        </div>
      </div>
    );
  }

  const byDay = statsData?.byDay || {};
  const dayData = dayLabels.map((label, i) => {
    const dayNum = i + 1;
    const dayStats = byDay[String(dayNum)] || { totalRR: 0, count: 0, winRate: 0, totalPnL: 0 };
    return { name: label, rr: dayStats.totalRR || 0, count: dayStats.count || 0, winRate: dayStats.winRate || 0, pnl: dayStats.totalPnL || 0 };
  });

  const byHour = statsData?.byHour || {};
  const hourData = Object.entries(byHour)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([hour, val]: [string, any]) => ({
      name: `${hour}h`,
      rr: val.totalRR || 0,
      count: val.count || 0,
      winRate: val.winRate || 0,
      pnl: val.totalPnL || 0,
    }));

  const byMonth = statsData?.byMonth || {};
  const monthData = Object.entries(byMonth)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, val]: [string, any]) => ({
      name: month.length <= 7 ? month : month.substring(0, 7),
      rr: val.totalRR || 0,
      count: val.count || 0,
      winRate: val.winRate || 0,
      pnl: val.totalPnL || 0,
    }));

  const byWeek = statsData?.byWeek || {};
  const weekData = Object.entries(byWeek)
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([week, val]: [string, any]) => ({
      name: week.substring(0, 10),
      rr: val.totalRR || 0,
      count: val.count || 0,
      winRate: val.winRate || 0,
    }));

  const bySession = statsData?.bySession || {};
  const sessionEntries = Object.entries(bySession).map(([session, val]: [string, any]) => ({
    name: session,
    rr: val.totalRR || 0,
    count: val.count || 0,
    winRate: val.winRate || 0,
    avgRR: val.avgRR || 0,
  }));

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {t(language, "timingAnalysis")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t(language, "performanceByPeriod")} • {t(language, "clickToSeeTrades")}
        </p>
      </div>

      {/* Time Filter */}
      <TimeFilterBar language={language} period={period} onPeriodChange={setPeriod} />

      {!hasData ? (
        <Card className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t(language, "noData")}</p>
        </Card>
      ) : (
        <>
          {/* Bar Charts Section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t(language, "barCharts")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 md:p-6">
                <h4 className="text-sm font-semibold mb-3">{t(language, "performanceByDay")}</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dayData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }} />
                      <Bar dataKey="rr" fill="oklch(0.65 0.2 160)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 md:p-6">
                <h4 className="text-sm font-semibold mb-3">{t(language, "performanceByHour")}</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hourData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }} />
                      <Bar dataKey="rr" fill="oklch(0.75 0.18 50)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 md:p-6">
                <h4 className="text-sm font-semibold mb-3">{t(language, "performanceByMonth")}</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={monthData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }} />
                      <Bar dataKey="rr" fill="oklch(0.7 0.14 280)" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>

          {/* Line Charts Section */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t(language, "lineCharts")}
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Card className="p-4 md:p-6">
                <h4 className="text-sm font-semibold mb-3">{t(language, "weeklyPerformance")}</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={weekData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }} />
                      <Line type="monotone" dataKey="rr" stroke="oklch(0.65 0.2 160)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 md:p-6">
                <h4 className="text-sm font-semibold mb-3">{t(language, "monthlyPerformance")}</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={monthData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                      <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 10 }} angle={-30} textAnchor="end" height={40} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }} />
                      <Line type="monotone" dataKey="rr" stroke="oklch(0.7 0.14 280)" strokeWidth={2} dot={{ r: 3 }} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </Card>

              <Card className="p-4 md:p-6">
                <h4 className="text-sm font-semibold mb-3">{t(language, "cumulativeEvolution")}</h4>
                <div className="h-56">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={cumulativeData} margin={{ top: 5, right: 5, left: -15, bottom: 5 }}>
                      <XAxis dataKey="trade" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
                      <Tooltip contentStyle={{ backgroundColor: "var(--popover)", border: "1px solid var(--border)", borderRadius: "8px", color: "var(--popover-foreground)" }} />
                      <defs>
                        <linearGradient id="cumulTimingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="oklch(0.65 0.2 160)" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="oklch(0.65 0.2 160)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <Area type="monotone" dataKey="rr" stroke="oklch(0.65 0.2 160)" fill="url(#cumulTimingGrad)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </Card>
            </div>
          </div>

          {/* Details by Period */}
          <div>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {t(language, "detailsByPeriod")} ({language === "fr" ? "Cliquez pour filtrer" : "Click to filter"})
            </h3>
            <Tabs defaultValue="day">
              <TabsList>
                <TabsTrigger value="day">{t(language, "byDay")}</TabsTrigger>
                <TabsTrigger value="hour">{t(language, "byHour")}</TabsTrigger>
                <TabsTrigger value="session">{t(language, "bySession")}</TabsTrigger>
                <TabsTrigger value="month">{t(language, "byMonth")}</TabsTrigger>
              </TabsList>

              <TabsContent value="day">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-7 gap-3 mt-3">
                  {dayData.map((d) => (
                    <Card key={d.name} className="p-3 text-center hover:border-foreground/30 transition-colors cursor-pointer">
                      <div className="text-sm font-semibold">{d.name}</div>
                      <div className={cn("text-lg font-bold font-mono mt-1", d.rr >= 0 ? "text-profit" : "text-loss")}>
                        {d.rr >= 0 ? "+" : ""}{d.rr.toFixed(2)} RR
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{d.count} trades</div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="hour">
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3 mt-3">
                  {hourData.map((d) => (
                    <Card key={d.name} className="p-3 text-center hover:border-foreground/30 transition-colors cursor-pointer">
                      <div className="text-sm font-semibold">{d.name}</div>
                      <div className={cn("text-lg font-bold font-mono mt-1", d.rr >= 0 ? "text-profit" : "text-loss")}>
                        {d.rr >= 0 ? "+" : ""}{d.rr.toFixed(1)}
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{d.count} trades</div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="session">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-3">
                  {sessionEntries.map((d) => (
                    <Card key={d.name} className="p-4 hover:border-foreground/30 transition-colors cursor-pointer">
                      <div className="text-sm font-semibold">{d.name}</div>
                      <div className={cn("text-lg font-bold font-mono mt-1", d.rr >= 0 ? "text-profit" : "text-loss")}>
                        {d.rr >= 0 ? "+" : ""}{d.rr.toFixed(2)} RR
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        <Badge variant="outline" className="text-[10px]">{d.count} trades</Badge>
                        <Badge variant="outline" className="text-[10px] text-profit">{d.winRate.toFixed(0)}% WR</Badge>
                      </div>
                    </Card>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="month">
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 mt-3">
                  {monthData.map((d) => (
                    <Card key={d.name} className="p-4 text-center hover:border-foreground/30 transition-colors cursor-pointer">
                      <div className="text-sm font-semibold">{d.name}</div>
                      <div className={cn("text-lg font-bold font-mono mt-1", d.rr >= 0 ? "text-profit" : "text-loss")}>
                        {d.rr >= 0 ? "+" : ""}{d.rr.toFixed(2)} RR
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">{d.count} trades</div>
                    </Card>
                  ))}
                </div>
              </TabsContent>
            </Tabs>
          </div>
        </>
      )}
    </div>
  );
}
