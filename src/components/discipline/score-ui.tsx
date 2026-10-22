"use client";

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Composants UI partagés du Score DONCIEL
// (jauge radiale SVG accessible + badges de grade).
// Palette : saphir, emerald (gain), red (perte), amber (Elite).
// ─────────────────────────────────────────────────────────────

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { DoncielScore } from "@/lib/discipline";

export type Grade = DoncielScore["grade"];

export const GRADE_COLORS: Record<Grade, string> = {
  "A+": "#10b981", // emerald
  A: "#0ea5e9", // sky (saphir clair)
  B: "#f59e0b", // amber
  C: "#f97316", // orange
  D: "#ef4444", // red
};

export const GRADE_TAILWIND: Record<Grade, string> = {
  "A+": "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  A: "bg-sky-500/15 text-sky-500 border-sky-500/30",
  B: "bg-amber-500/15 text-amber-500 border-amber-500/30",
  C: "bg-orange-500/15 text-orange-500 border-orange-500/30",
  D: "bg-red-500/15 text-red-500 border-red-500/30",
};

/** Badge compact du grade (A+ → D). */
export function ScoreGradeBadge({
  grade,
  className,
}: {
  grade: Grade;
  className?: string;
}) {
  return (
    <Badge
      variant="outline"
      className={cn("font-bold text-xs", GRADE_TAILWIND[grade], className)}
    >
      {grade}
    </Badge>
  );
}

interface ScoreGaugeProps {
  score: DoncielScore;
  /** Libellé accessible (déjà localisé) */
  ariaLabel?: string;
  className?: string;
}

/**
 * Jauge radiale SVG custom (cercle de progression) affichant
 * le score total /100 et le grade. Couleur selon le grade.
 * Accessible : role="img" + aria-label.
 */
export function ScoreGauge({ score, ariaLabel, className }: ScoreGaugeProps) {
  const size = 190;
  const center = size / 2;
  const radius = 76;
  const strokeWidth = 14;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, score.total)) / 100;
  const dashOffset = circumference * (1 - pct);
  const color = GRADE_COLORS[score.grade];

  return (
    <div className={cn("relative inline-flex items-center justify-center", className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={
          ariaLabel || `Score DONCIEL : ${score.total} sur 100, grade ${score.grade}`
        }
      >
        {/* Piste de fond */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke="currentColor"
          className="text-muted-foreground/20"
          strokeWidth={strokeWidth}
        />
        {/* Arc de progression */}
        <circle
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${center} ${center})`}
          style={{ transition: "stroke-dashoffset 900ms ease, stroke 300ms ease" }}
        />
      </svg>
      {/* Valeur centrale */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="text-5xl font-extrabold tracking-tight leading-none"
          style={{ color }}
        >
          {score.total}
        </span>
        <span className="text-xs text-muted-foreground font-medium mt-1">
          / 100
        </span>
        <ScoreGradeBadge grade={score.grade} className="mt-2" />
      </div>
    </div>
  );
}
