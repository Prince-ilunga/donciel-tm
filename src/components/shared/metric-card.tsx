"use client";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { LucideIcon } from "lucide-react";

interface MetricCardProps {
  label: string;
  value: string | number;
  icon?: LucideIcon;
  trend?: "up" | "down" | "neutral";
  className?: string;
}

export function MetricCard({ label, value, icon: Icon, trend, className }: MetricCardProps) {
  return (
    <Card className={cn("p-4 metric-glow", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs text-muted-foreground font-medium uppercase tracking-wider">{label}</span>
        {Icon && <Icon className="w-4 h-4 text-muted-foreground" />}
      </div>
      <div
        className={cn(
          "text-2xl font-bold tracking-tight",
          trend === "up" && "text-profit",
          trend === "down" && "text-loss"
        )}
      >
        {typeof value === "number" ? value.toLocaleString() : value}
      </div>
    </Card>
  );
}
