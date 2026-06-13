"use client";

import { t } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import type { TimePeriod } from "@/lib/use-time-filter";
import { cn } from "@/lib/utils";
import { Calendar, CalendarDays, CalendarRange, Timer, Clock, Infinity } from "lucide-react";

const PERIOD_CONFIG: { value: TimePeriod; icon: typeof Calendar; key: string }[] = [
  { value: "day", icon: Calendar, key: "periodDay" },
  { value: "week", icon: CalendarDays, key: "periodWeek" },
  { value: "month", icon: CalendarRange, key: "periodMonth" },
  { value: "quarter", icon: Timer, key: "periodQuarter" },
  { value: "year", icon: Clock, key: "periodYear" },
  { value: "all", icon: Infinity, key: "periodAll" },
];

interface TimeFilterBarProps {
  language: Language;
  period: TimePeriod;
  onPeriodChange: (period: TimePeriod) => void;
  className?: string;
}

export function TimeFilterBar({ language, period, onPeriodChange, className }: TimeFilterBarProps) {
  return (
    <div className={cn("flex flex-wrap items-center gap-1 p-1 rounded-xl bg-muted/50 border border-border/50", className)}>
      {PERIOD_CONFIG.map(({ value, icon: Icon, key }) => {
        const isActive = period === value;
        return (
          <button
            key={value}
            onClick={() => onPeriodChange(value)}
            className={cn(
              "flex items-center gap-1 px-2 sm:px-3 py-1.5 rounded-lg text-xs font-medium transition-all duration-200 whitespace-nowrap",
              isActive
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted"
            )}
          >
            <Icon className="w-3.5 h-3.5 hidden sm:block" />
            <span>{t(language, key as any)}</span>
          </button>
        );
      })}
    </div>
  );
}
