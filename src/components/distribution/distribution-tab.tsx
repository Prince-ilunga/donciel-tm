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

import {
  TrendingUp,
  TrendingDown,
  Target,
  BarChart3,
  Activity,
  Zap,
  ArrowDown,
  CircleDot,
} from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  Legend,
  Area,
  AreaChart,
} from "recharts";

const CHART_COLORS = [
  "oklch(0.65 0.2 160)",
  "oklch(0.75 0.18 50)",
  "oklch(0.7 0.14 280)",
  "oklch(0.8 0.17 30)",
  "oklch(0.75 0.22 340)",
  "oklch(0.6 0.15 200)",
];

const PROFIT_COLOR = "oklch(0.72 0.22 145)";
const LOSS_COLOR = "oklch(0.65 0.24 25)";

export function DistributionTab() {
  const { language, setSelectedTradeId, setShowTradeDetail } = useAppStore();
  const { period, setPeriod, filters } = useTimeFilter();
  const { stats, loading, refetch } = useStats(filters);
  const { trades } = useTrades(filters);

  // Fetch on mount
  React.useEffect(() => { refetch(); }, [refetch]);
  const statsData = (stats as any)?.stats ?? stats;

  // Handle chart bar click - find trades matching the clicked category
  const handleChartClick = (category: string, value: string) => {
    // Find the first trade matching this category and open its details
    const matchingTrade = trades.find((trade: any) => {
      switch (category) {
        case "setup": return (trade.setup || "N/A") === value;
        case "session": return trade.session === value;
        case "marketCondition": return trade.marketCondition === value;
        case "timeframe": return trade.timeframe === value;
        case "pair": return trade.pair === value;
        case "direction": return trade.direction === value;
        case "rrRange": return true; // For RR distribution, just open first trade
        default: return false;
      }
    });
    if (matchingTrade) {
      setSelectedTradeId(matchingTrade.id);
      setShowTradeDetail(true);
    }
  };

  if (loading) {
    return (
      <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="p-4"><Skeleton className="h-64 w-full" /></Card>
          ))}
        </div>
      </div>
    );
  }

  const rrDistributionData = statsData?.rrDistribution?.map((d: any) => ({
    name: d.range,
    count: d.count,
  })) || [];

  const directionData = Object.entries(statsData?.byDirection || {}).map(([key, val]: [string, any]) => ({
    name: key,
    value: val.count,
    winRate: val.winRate,
    avgRR: val.avgRR,
    totalRR: val.totalRR,
  }));

  const sessionData = Object.entries(statsData?.bySession || {}).map(([key, val]: [string, any]) => ({
    name: key,
    value: val.count,
    winRate: val.winRate,
    avgRR: val.avgRR,
    totalRR: val.totalRR,
  }));

  const marketCondData = Object.entries(statsData?.byMarketCondition || {}).map(([key, val]: [string, any]) => ({
    name: key,
    value: val.count,
    winRate: val.winRate,
    avgRR: val.avgRR,
    totalRR: val.totalRR,
  }));

  const timeframeData = Object.entries(statsData?.byTimeframe || {}).map(([key, val]: [string, any]) => ({
    name: key,
    value: val.count,
    winRate: val.winRate,
    avgRR: val.avgRR,
    totalRR: val.totalRR,
  }));

  const assetData = Object.entries(statsData?.byPair || {}).map(([key, val]: [string, any]) => ({
    name: key,
    value: val.count,
    winRate: val.winRate,
    avgRR: val.avgRR,
    totalRR: val.totalRR,
  }));

  const setupData = Object.entries(statsData?.bySetup || {}).map(([key, val]: [string, any]) => ({
    name: key || "N/A",
    value: val.count,
    winRate: val.winRate,
    avgRR: val.avgRR,
    totalRR: val.totalRR,
  }));

  const cumulativeRRData = statsData?.cumulativeRR?.map((d: any) => ({
    trade: d.tradeNumber,
    rr: d.cumulativeRR,
  })) || [];

  const movingAvgData = statsData?.movingAvgRR?.map((d: any) => ({
    trade: d.tradeNumber,
    avg: d.avgRR,
  })) || [];

  const hasData = statsData?.totalTrades > 0;

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight text-foreground">
          {t(language, "distributionRR")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {t(language, "completeRRAnalysis")}
        </p>
      </div>

      {/* Time Filter */}
      <TimeFilterBar language={language} period={period} onPeriodChange={setPeriod} />

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4">
        <MetricCard
          label={t(language, "totalRR")}
          value={(statsData?.totalRR ?? 0).toFixed(2)}
          icon={TrendingUp}
          trend={(statsData?.totalRR ?? 0) > 0 ? "up" : "down"}
        />
        <MetricCard
          label={t(language, "avgRR")}
          value={(statsData?.avgRR ?? 0).toFixed(2)}
          icon={CircleDot}
          trend={(statsData?.avgRR ?? 0) > 0 ? "up" : "neutral"}
        />
        <MetricCard
          label={t(language, "bestRR")}
          value={(statsData?.bestRR ?? 0).toFixed(2)}
          icon={Zap}
          trend="up"
        />
        <MetricCard
          label={t(language, "worstRR")}
          value={(statsData?.worstRR ?? 0).toFixed(2)}
          icon={ArrowDown}
          trend="down"
        />
        <MetricCard
          label={t(language, "stdDeviation")}
          value={(statsData?.stdDeviation ?? 0).toFixed(2)}
          icon={Activity}
          trend="neutral"
        />
      </div>

      {!hasData ? (
        <Card className="p-12 text-center">
          <BarChart3 className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{t(language, "noData")}</p>
        </Card>
      ) : (
        <>
          {/* Charts Row 1: Distribution + Direction */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Distribution by RR */}
            <Card className="p-4 md:p-6">
              <h3 className="text-sm font-semibold mb-4">{t(language, "distributionByRR")}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={rrDistributionData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Bar dataKey="count" fill="oklch(0.65 0.2 160)" radius={[4, 4, 0, 0]} cursor="pointer" onClick={(data) => handleChartClick("rrRange", data.name)} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* RR by Direction */}
            <Card className="p-4 md:p-6">
              <h3 className="text-sm font-semibold mb-4">{t(language, "rrByDirection")}</h3>
              <div className="h-64 flex items-center justify-center">
                {directionData.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={directionData}
                        cx="50%"
                        cy="50%"
                        innerRadius={60}
                        outerRadius={90}
                        dataKey="value"
                        label={({ name, value }) => `${name}: ${value}`}
                        cursor="pointer"
                        onClick={(data) => handleChartClick("direction", data.name)}
                      >
                        {directionData.map((_: any, index: number) => (
                          <Cell key={index} fill={index === 0 ? PROFIT_COLOR : LOSS_COLOR} />
                        ))}
                      </Pie>
                      <Tooltip />
                      <Legend />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-muted-foreground text-sm">{t(language, "noData")}</p>
                )}
              </div>
              {/* Direction details */}
              <div className="grid grid-cols-2 gap-3 mt-4">
                {directionData.map((d: any) => (
                  <div key={d.name} className="text-center p-3 rounded-lg bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => handleChartClick("direction", d.name)}>
                    <div className={cn("text-lg font-bold", d.name === "LONG" ? "text-profit" : "text-loss")}>
                      {d.name}
                    </div>
                    <div className="text-xs text-muted-foreground">{d.value} trades</div>
                    <div className="text-sm font-mono">{d.avgRR.toFixed(2)} RR</div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          {/* Charts Row 2: Cumulative + Moving Average */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Cumulative RR */}
            <Card className="p-4 md:p-6">
              <h3 className="text-sm font-semibold mb-4">{t(language, "cumulativeRR")}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={cumulativeRRData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <XAxis dataKey="trade" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <defs>
                      <linearGradient id="cumulGradient" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="oklch(0.65 0.2 160)" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="oklch(0.65 0.2 160)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="rr"
                      stroke="oklch(0.65 0.2 160)"
                      fill="url(#cumulGradient)"
                      strokeWidth={2}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </Card>

            {/* Moving Average 20 trades */}
            <Card className="p-4 md:p-6">
              <h3 className="text-sm font-semibold mb-4">{t(language, "movingAverage20")}</h3>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={movingAvgData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                    <XAxis dataKey="trade" tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "var(--popover)",
                        border: "1px solid var(--border)",
                        borderRadius: "8px",
                        color: "var(--popover-foreground)",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="avg"
                      stroke="oklch(0.75 0.18 50)"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </div>

          {/* Charts Row 3: Performance breakdowns — each in its own chart */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <PerformanceBreakdownCard data={setupData} title={t(language, "performanceBySetup")} category="setup" onChartClick={handleChartClick} />
            <PerformanceBreakdownCard data={assetData} title={t(language, "performanceByAsset")} category="pair" onChartClick={handleChartClick} />
            <PerformanceBreakdownCard data={sessionData} title={t(language, "performanceBySession")} category="session" onChartClick={handleChartClick} />
            <PerformanceBreakdownCard data={marketCondData} title={t(language, "performanceByMarketCondition")} category="marketCondition" onChartClick={handleChartClick} />
            <PerformanceBreakdownCard data={timeframeData} title={t(language, "performanceByTimeframe")} category="timeframe" onChartClick={handleChartClick} />
          </div>
        </>
      )}
    </div>
  );
}

function PerformanceBreakdownCard({ data, title, category, onChartClick }: { data: any[]; title: string; category: string; onChartClick: (category: string, value: string) => void }) {
  if (!data || data.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">{title} — No data</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 md:p-6">
      <h3 className="text-sm font-semibold mb-4">{title}</h3>
      <div className="h-64 mb-4">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
            <XAxis dataKey="name" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <YAxis tick={{ fill: "var(--muted-foreground)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--popover)",
                border: "1px solid var(--border)",
                borderRadius: "8px",
                color: "var(--popover-foreground)",
              }}
            />
            <Bar dataKey="totalRR" fill="oklch(0.65 0.2 160)" radius={[4, 4, 0, 0]} name="Total RR" cursor="pointer" onClick={(data) => onChartClick(category, data.name)} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      {/* Detail cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {data.map((d: any, i: number) => (
          <div key={d.name} className="p-3 rounded-lg bg-muted/50 border border-border/50 cursor-pointer hover:bg-muted/70 transition-colors" onClick={() => onChartClick(category, d.name)}>
            <div className="text-sm font-semibold truncate">{d.name}</div>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{d.value} trades</Badge>
              <Badge variant="outline" className="text-[10px] text-profit">{d.winRate.toFixed(0)}% WR</Badge>
            </div>
            <div className="text-xs font-mono mt-1 text-muted-foreground">
              RR: {d.avgRR.toFixed(2)} | Total: {d.totalRR.toFixed(2)}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
