"use client";

import { useState, useMemo } from "react";
import type { TradeFilters } from "@/lib/hooks";

export type TimePeriod = "day" | "week" | "month" | "quarter" | "year" | "all";

/**
 * Computes dateFrom / dateTo based on the selected time period.
 * - "day"   → today
 * - "week"  → start of current week (Monday)
 * - "month" → start of current month
 * - "quarter" → start of current quarter
 * - "year"  → start of current year
 * - "all"   → no date filter (returns empty filters)
 */
export function useTimeFilter(defaultPeriod: TimePeriod = "month") {
  const [period, setPeriod] = useState<TimePeriod>(defaultPeriod);

  const { dateFrom, dateTo } = useMemo(() => {
    if (period === "all") return { dateFrom: undefined, dateTo: undefined };

    const now = new Date();
    // End of today (23:59:59)
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    let from: Date;

    switch (period) {
      case "day":
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        break;
      case "week": {
        const dayOfWeek = now.getDay(); // 0 = Sunday
        const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
        from = new Date(now.getFullYear(), now.getMonth(), now.getDate() + mondayOffset);
        break;
      }
      case "month":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "quarter": {
        const quarterMonth = Math.floor(now.getMonth() / 3) * 3;
        from = new Date(now.getFullYear(), quarterMonth, 1);
        break;
      }
      case "year":
        from = new Date(now.getFullYear(), 0, 1);
        break;
      default:
        from = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    return {
      dateFrom: from.toISOString().split("T")[0],
      dateTo: endOfToday.toISOString().split("T")[0],
    };
  }, [period]);

  const filters: TradeFilters = useMemo(() => {
    const f: TradeFilters = {};
    if (dateFrom) f.dateFrom = dateFrom;
    if (dateTo) f.dateTo = dateTo;
    return f;
  }, [dateFrom, dateTo]);

  return { period, setPeriod, dateFrom, dateTo, filters };
}
