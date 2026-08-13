"use client";

import { PlanEditor } from "./plan-editor";

// ─── Playbook Tab (self-contained Plan editor) ──────────────
// Previously rendered the user's Notion page. Now hosts a fully
// integrated, Notion-like plan editor with rich text, images and
// TradingView charts — no external dependency.
export function PlaybookTab() {
  return <PlanEditor />;
}
