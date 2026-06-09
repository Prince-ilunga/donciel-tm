"use client";

import { cn } from "@/lib/utils";

interface DoncielLogoProps {
  className?: string;
  size?: number;
}

export function DoncielLogo({ className, size = 36 }: DoncielLogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
    >
      {/* Elegant D letterform */}
      <rect x="2" y="2" width="36" height="36" rx="8" className="fill-foreground stroke-foreground" strokeWidth="1.5" />
      <path
        d="M14 10H20.5C24.6421 10 28 13.3579 28 17.5V22.5C28 26.6421 24.6421 30 20.5 30H14V10Z"
        className="fill-background"
        strokeWidth="0"
      />
      <path
        d="M14 10H20.5C24.6421 10 28 13.3579 28 17.5V22.5C28 26.6421 24.6421 30 20.5 30H14"
        className="stroke-background"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      <path
        d="M14 10V30"
        className="stroke-background"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
