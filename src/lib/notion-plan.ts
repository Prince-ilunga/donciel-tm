import { NotionAPI } from "notion-client";

// ─── Configuration ──────────────────────────────────────────
const NOTION_PAGE_ID = "35f7944a-cd65-8022-8856-fbfb9e2179a9";
const NOTION_PUBLIC_URL =
  "https://habitual-soil-b8a.notion.site/LES-VARIABLES-DE-MON-PLAN-35f7944acd6580228856fbfb9e2179a9";

// ─── In-memory cache ────────────────────────────────────────
// Re-fetch the Notion page at most every 10 minutes to avoid hitting the
// Notion API on every request (and to keep image signed URLs fresh).
const CACHE_TTL_MS = 10 * 60 * 1000;
let cache: { recordMap: any; fetchedAt: number } | null = null;

export async function fetchPlanRecordMap(): Promise<any> {
  if (cache && Date.now() - cache.fetchedAt < CACHE_TTL_MS) {
    return cache.recordMap;
  }
  const api = new NotionAPI();
  const recordMap = await api.getPage(NOTION_PAGE_ID);
  cache = { recordMap, fetchedAt: Date.now() };
  return recordMap;
}

// ─── Block access helper (notion-client v7 double-nesting) ──
function getBlock(recordMap: any, id: string): any {
  return recordMap?.block?.[id]?.value?.value ?? null;
}

// ─── Inline text rendering ──────────────────────────────────
// Notion stores rich text as [[text, [formatTokens]], ...].
// Tokens: "b" (bold), "i" (italic), "_" (underline), "s" (strikethrough),
// "c" (code), "a" (link → [["a", url]]).
function renderInlineText(parts: any[] | undefined): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .map((part) => {
      if (typeof part === "string") return escapeHtml(part);
      const [text, tokens] = part as [string, any[]?];
      let html = escapeHtml(text || "");
      if (Array.isArray(tokens)) {
        for (const tok of tokens) {
          const key = Array.isArray(tok) ? tok[0] : tok;
          if (key === "b") html = `<strong>${html}</strong>`;
          else if (key === "i") html = `<em>${html}</em>`;
          else if (key === "_") html = `<u>${html}</u>`;
          else if (key === "s") html = `<s>${html}</s>`;
          else if (key === "c") html = `<code>${html}</code>`;
          else if (key === "a" && Array.isArray(tok) && tok[1]) {
            html = `<a href="${escapeAttr(tok[1])}" target="_blank" rel="noopener noreferrer">${html}</a>`;
          }
        }
      }
      return html;
    })
    .join("");
}

function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

function getTitle(block: any): string {
  const p = block?.properties;
  if (!p) return "";
  return renderInlineText(p.title?.[0] ? [p.title[0]] : p.title);
}

// ─── Image URL resolution ───────────────────────────────────
export function getImageSignedUrl(recordMap: any, blockId: string): string | null {
  const signed = recordMap?.signed_urls?.[blockId];
  if (typeof signed === "string" && signed.startsWith("http")) return signed;
  const block = getBlock(recordMap, blockId);
  const displaySource = block?.format?.display_source;
  if (typeof displaySource === "string" && displaySource.startsWith("http")) {
    return displaySource;
  }
  return null;
}

// ─── Block → HTML rendering ─────────────────────────────────
function renderChildren(recordMap: any, childIds: string[], depth: number): string {
  // Render a list of child block IDs, grouping consecutive bulleted_list /
  // numbered_list blocks into <ul>/<ol> for proper HTML structure.
  const parts: string[] = [];
  let i = 0;
  while (i < childIds.length) {
    const block = getBlock(recordMap, childIds[i]);
    if (block?.type === "bulleted_list") {
      const items: string[] = [];
      while (i < childIds.length) {
        const b = getBlock(recordMap, childIds[i]);
        if (b?.type !== "bulleted_list") break;
        items.push(renderBlock(recordMap, childIds[i], depth + 1));
        i++;
      }
      parts.push(`<ul class="nt-ul">${items.join("")}</ul>`);
    } else if (block?.type === "numbered_list") {
      const items: string[] = [];
      while (i < childIds.length) {
        const b = getBlock(recordMap, childIds[i]);
        if (b?.type !== "numbered_list") break;
        items.push(renderBlock(recordMap, childIds[i], depth + 1));
        i++;
      }
      parts.push(`<ol class="nt-ol">${items.join("")}</ol>`);
    } else {
      parts.push(renderBlock(recordMap, childIds[i], depth + 1));
      i++;
    }
  }
  return parts.join("\n");
}

function renderBlock(recordMap: any, blockId: string, depth = 0): string {
  if (depth > 12) return ""; // safety against deep nesting
  const block = getBlock(recordMap, blockId);
  if (!block || block.alive === false) return "";

  const type: string = block.type;
  const childrenHtml =
    Array.isArray(block.content) && block.content.length > 0
      ? renderChildren(recordMap, block.content, depth)
      : "";

  switch (type) {
    case "page":
      // Don't render the page title here (handled at top level); render children.
      return childrenHtml;
    case "header":
      return `<h2 class="nt-h2">${getTitle(block)}</h2>${childrenHtml}`;
    case "sub_header": {
      // Toggleable sub-headers contain nested content (bullets, images, etc.).
      // Render as an open <details> so the full plan is visible.
      const toggleable = block?.format?.toggleable;
      if (toggleable) {
        return `<details class="nt-toggle" open><summary class="nt-h3">${getTitle(block)}</summary><div class="nt-toggle-body">${childrenHtml}</div></details>`;
      }
      return `<h3 class="nt-h3">${getTitle(block)}</h3>${childrenHtml}`;
    }
    case "sub_sub_header":
      return `<h4 class="nt-h4">${getTitle(block)}</h4>${childrenHtml}`;
    case "text":
      return `<p class="nt-p">${getTitle(block) || "&nbsp;"}</p>${childrenHtml}`;
    case "bulleted_list":
      // Consecutive bullets are wrapped in <ul> by renderChildren. Nested
      // children are already grouped, so render them directly here.
      return `<li class="nt-li nt-bullet">${getTitle(block)}${childrenHtml}</li>`;
    case "numbered_list":
      return `<li class="nt-li nt-num">${getTitle(block)}${childrenHtml}</li>`;
    case "quote":
      return `<blockquote class="nt-quote">${getTitle(block)}</blockquote>`;
    case "divider":
      return `<hr class="nt-hr" />`;
    case "callout":
      return `<div class="nt-callout">${getTitle(block)}${childrenHtml}</div>`;
    case "toggle":
      return `<details class="nt-toggle"><summary>${getTitle(block) || "Détails"}</summary>${childrenHtml}</details>`;
    case "column_list":
      return `<div class="nt-columns">${childrenHtml}</div>`;
    case "column": {
      const ratio = block?.format?.column_ratio;
      const flex = ratio ? `flex: ${ratio};` : "flex: 1;";
      return `<div class="nt-column" style="${flex}">${childrenHtml}</div>`;
    }
    case "image": {
      const url = getImageSignedUrl(recordMap, blockId);
      const caption = block?.properties?.caption;
      const captionHtml =
        caption && caption[0]
          ? `<figcaption class="nt-figcap">${renderInlineText([caption[0]])}</figcaption>`
          : "";
      if (!url) {
        return `<figure class="nt-fig"><div class="nt-img-placeholder">🖼️</div>${captionHtml}</figure>`;
      }
      // Route image through our proxy so the browser can load it (the raw
      // Notion file URL returns 403 without auth cookies).
      const proxy = `/api/playbook/image?blockId=${encodeURIComponent(blockId)}`;
      return `<figure class="nt-fig"><img class="nt-img" src="${escapeAttr(proxy)}" alt="${escapeAttr(getTitle(block) || "image")}" loading="lazy" />${captionHtml}</figure>`;
    }
    default:
      // Unknown block type: render children if any, skip the block itself.
      return childrenHtml;
  }
}

// ─── Top-level renderer ─────────────────────────────────────
export function renderPlanHtml(recordMap: any): { title: string; html: string } {
  const pageBlock = getBlock(recordMap, NOTION_PAGE_ID);
  const title =
    pageBlock?.properties?.title?.[0]?.[0] || "LES VARIABLES DE MON PLAN";

  const childIds: string[] = pageBlock?.content || [];
  const html = renderChildren(recordMap, childIds, 0);
  return { title, html };
}

export { NOTION_PAGE_ID, NOTION_PUBLIC_URL };
