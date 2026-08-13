"use client";

import { PlanEditor } from "./plan-editor";

// ─── Playbook Tab (in-app Plan editor) ──────────────────────
// Fully self-contained plan editor — rich text blocks (Notion-like),
// image upload, TradingView charts. No external dependency.
export function PlaybookTab() {
  return <PlanEditor />;
}
