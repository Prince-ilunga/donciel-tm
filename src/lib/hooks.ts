"use client";

import { useState, useCallback } from "react";

interface Trade {
  id: string;
  userId: string;
  date: string;
  pair: string;
  direction: string;
  session: string;
  marketCondition: string;
  timeframe: string;
  setup: string | null;
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  exitPrice: number | null;
  entryTime: string | null;
  exitTime: string | null;
  duration: string | null;
  lotSize: number | null;
  rr: number | null;
  pnl: number | null;
  result: string | null;
  newsEnabled: boolean;
  emotions: string | null;
  confluence: string | null;
  mistakes: string | null;
  lessons: string | null;
  notes: string | null;
  createdAt: string;
  screenshots: { id: string; type: string; url: string }[];
}

interface Stats {
  totalTrades: number;
  winRate: number;
  totalRR: number;
  avgRR: number;
  bestRR: number;
  worstRR: number;
  stdDeviation: number;
  totalPnL: number;
  profitFactor: number;
  avgWin: number;
  avgLoss: number;
  maxConsecutiveWins: number;
  maxConsecutiveLosses: number;
  wins: number;
  losses: number;
  bes: number;
  byPair: Record<string, { count: number; winRate: number; avgRR: number; totalRR: number }>;
  byDirection: Record<string, { count: number; winRate: number; avgRR: number; totalRR: number }>;
  bySession: Record<string, { count: number; winRate: number; avgRR: number; totalRR: number }>;
  byMarketCondition: Record<string, { count: number; winRate: number; avgRR: number; totalRR: number }>;
  byTimeframe: Record<string, { count: number; winRate: number; avgRR: number; totalRR: number }>;
  bySetup: Record<string, { count: number; winRate: number; avgRR: number; totalRR: number }>;
  byDay: Record<string, { count: number; winRate: number; totalRR: number; totalPnL: number }>;
  byHour: Record<string, { count: number; winRate: number; totalRR: number; totalPnL: number }>;
  byMonth: Record<string, { count: number; winRate: number; totalRR: number; totalPnL: number }>;
  byWeek: Record<string, { count: number; winRate: number; totalRR: number; totalPnL: number }>;
  rrDistribution: { range: string; count: number }[];
  cumulativeRR: { tradeNumber: number; cumulativeRR: number }[];
  movingAvgRR: { tradeNumber: number; avgRR: number }[];
}

interface TradeFilters {
  pair?: string;
  direction?: string;
  session?: string;
  marketCondition?: string;
  timeframe?: string;
  dateFrom?: string;
  dateTo?: string;
  result?: string;
}

function buildQueryString(filters?: Record<string, string | undefined>): string {
  const params = new URLSearchParams();
  if (filters) {
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
  }
  return params.toString();
}

export function useTrades(filters?: TradeFilters) {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchTrades = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString(filters as Record<string, string | undefined>);
      const res = await fetch(`/api/trades?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setTrades(data.trades || []);
      }
    } catch {
      setTrades([]);
    }
    setLoading(false);
  }, [filters]);

  return { trades, loading, refetch: fetchTrades };
}

export function useStats(filters?: TradeFilters) {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const qs = buildQueryString(filters as Record<string, string | undefined>);
      const res = await fetch(`/api/stats?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      setStats(null);
    }
    setLoading(false);
  }, [filters]);

  return { stats, loading, refetch: fetchStats };
}

export function useGlobalStats() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchGlobalStats = useCallback(async () => {
    try {
      const res = await fetch("/api/stats/global");
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch {
      setStats(null);
    }
    setLoading(false);
  }, []);

  return { stats, loading, refetch: fetchGlobalStats };
}

export function useNotes(type?: string) {
  const [notes, setNotes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchNotes = useCallback(async () => {
    setLoading(true);
    try {
      const qs = type ? `type=${type}` : "";
      const res = await fetch(`/api/notes?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setNotes(data.notes || []);
      }
    } catch {
      setNotes([]);
    }
    setLoading(false);
  }, [type]);

  return { notes, loading, refetch: fetchNotes };
}

export function useVideos(category?: string) {
  const [videos, setVideos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchVideos = useCallback(async () => {
    setLoading(true);
    try {
      const qs = category ? `category=${category}` : "";
      const res = await fetch(`/api/videos?${qs}`);
      if (res.ok) {
        const data = await res.json();
        setVideos(data.videos || []);
      }
    } catch {
      setVideos([]);
    }
    setLoading(false);
  }, [category]);

  return { videos, loading, refetch: fetchVideos };
}
