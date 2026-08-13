"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useAppStore } from "@/stores/app-store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Code2,
  Highlighter,
  Link2,
  Eraser,
  Plus,
  GripVertical,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Type,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Lightbulb,
  Minus,
  ImageIcon,
  CandlestickChart,
  Code,
  Pencil,
  Eye,
  Save,
  Check,
  Loader2,
  ChevronDown,
} from "lucide-react";
import { toast } from "sonner";
import { TradingViewChart } from "./tradingview-chart";

// ─── Types ──────────────────────────────────────────────────
type BlockType =
  | "h1" | "h2" | "h3"
  | "paragraph" | "bullet" | "numbered"
  | "quote" | "callout" | "divider"
  | "image" | "tradingview" | "code";

interface BaseBlock { id: string; type: BlockType; }
interface TextBlock extends BaseBlock {
  type: "h1" | "h2" | "h3" | "paragraph" | "bullet" | "numbered" | "quote" | "callout" | "code";
  html: string;
}
interface DividerBlock extends BaseBlock { type: "divider"; }
interface ImageBlock extends BaseBlock {
  type: "image";
  url: string;
  caption?: string;
  width?: number;
}
interface TVBlock extends BaseBlock {
  type: "tradingview";
  symbol: string;
  interval: string;
  height?: number;
  studies?: string[];
  caption?: string;
}
type Block = TextBlock | DividerBlock | ImageBlock | TVBlock;

interface PlanDoc {
  id: string;
  title: string;
  blocks: Block[];
  updatedAt: string;
}

// ─── Helpers ────────────────────────────────────────────────
function genId(): string {
  return `b_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function emptyBlock(type: BlockType = "paragraph"): Block {
  if (type === "divider") return { id: genId(), type: "divider" };
  if (type === "image") return { id: genId(), type: "image", url: "", caption: "", width: 100 };
  if (type === "tradingview")
    return { id: genId(), type: "tradingview", symbol: "OANDA:XAUUSD", interval: "60", height: 420, studies: [], caption: "" };
  return { id: genId(), type, html: "" } as TextBlock;
}

// Light sanitization: strip dangerous tags/attrs, keep formatting tags.
function sanitizeHtml(html: string): string {
  if (!html) return "";
  let s = html;
  s = s.replace(/<script[\s\S]*?<\/script>/gi, "");
  s = s.replace(/<style[\s\S]*?<\/style>/gi, "");
  s = s.replace(/<meta[\s\S]*?>/gi, "");
  s = s.replace(/on\w+\s*=\s*"[^"]*"/gi, "");
  s = s.replace(/on\w+\s*=\s*'[^']*'/gi, "");
  s = s.replace(/javascript:/gi, "");
  return s;
}

const TEXT_TYPES: BlockType[] = [
  "paragraph", "h1", "h2", "h3", "bullet", "numbered", "quote", "callout", "code",
];

function isTextBlock(b: Block): b is TextBlock {
  return TEXT_TYPES.includes(b.type);
}

// ─── Block type metadata ────────────────────────────────────
const BLOCK_MENU: {
  type: BlockType;
  icon: React.ElementType;
  fr: string;
  en: string;
  descFr: string;
  descEn: string;
}[] = [
  { type: "h1", icon: Heading1, fr: "Titre 1", en: "Heading 1", descFr: "Grand titre de section", descEn: "Large section heading" },
  { type: "h2", icon: Heading2, fr: "Titre 2", en: "Heading 2", descFr: "Titre de section", descEn: "Section heading" },
  { type: "h3", icon: Heading3, fr: "Titre 3", en: "Heading 3", descFr: "Sous-titre", descEn: "Subheading" },
  { type: "paragraph", icon: Type, fr: "Paragraphe", en: "Paragraph", descFr: "Texte simple", descEn: "Plain text" },
  { type: "bullet", icon: List, fr: "Liste à puces", en: "Bulleted list", descFr: "Liste non ordonnée", descEn: "Unordered list" },
  { type: "numbered", icon: ListOrdered, fr: "Liste numérotée", en: "Numbered list", descFr: "Liste ordonnée", descEn: "Ordered list" },
  { type: "quote", icon: Quote, fr: "Citation", en: "Quote", descFr: "Bloc de citation", descEn: "Quote block" },
  { type: "callout", icon: Lightbulb, fr: "Encadré", en: "Callout", descFr: "Mise en valeur", descEn: "Highlight box" },
  { type: "divider", icon: Minus, fr: "Séparateur", en: "Divider", descFr: "Ligne de séparation", descEn: "Separator line" },
  { type: "image", icon: ImageIcon, fr: "Image", en: "Image", descFr: "Téléverser une image", descEn: "Upload an image" },
  { type: "tradingview", icon: CandlestickChart, fr: "Graphique TradingView", en: "TradingView chart", descFr: "Analyse technique en direct", descEn: "Live technical analysis" },
  { type: "code", icon: Code, fr: "Code", en: "Code", descFr: "Bloc de code", descEn: "Code block" },
];

// ─── Inline formatting toolbar ──────────────────────────────
function execFormat(command: string, value?: string) {
  document.execCommand(command, false, value);
}

function getSelectionRect(): DOMRect | null {
  const sel = window.getSelection();
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return null;
  const range = sel.getRangeAt(0);
  const rect = range.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return null;
  return rect;
}

interface FloatingToolbarProps {
  onRefresh: () => void;
}

function FloatingToolbar({ onRefresh }: FloatingToolbarProps) {
  const [visible, setVisible] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [active, setActive] = useState({ bold: false, italic: false, underline: false, strike: false });

  const update = useCallback(() => {
    const rect = getSelectionRect();
    if (!rect) {
      setVisible(false);
      return;
    }
    // Only show if selection is inside a plan text block
    const sel = window.getSelection();
    let node = sel?.anchorNode;
    let inside = false;
    while (node) {
      if (node instanceof HTMLElement && node.dataset?.planText === "1") {
        inside = true;
        break;
      }
      node = node.parentNode;
    }
    if (!inside) {
      setVisible(false);
      return;
    }
    setVisible(true);
    setPos({
      top: rect.top - 48,
      left: rect.left + rect.width / 2,
    });
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        strike: document.queryCommandState("strikeThrough"),
      });
    } catch {
      /* noop */
    }
  }, []);

  useEffect(() => {
    document.addEventListener("selectionchange", update);
    return () => document.removeEventListener("selectionchange", update);
  }, [update]);

  if (!visible || !pos) return null;

  const formatBtn = (cmd: string, icon: React.ElementType, a?: boolean) => {
    const Icon = icon;
    return (
      <button
        key={cmd}
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          execFormat(cmd);
          onRefresh();
          update();
        }}
        className={`p-1.5 rounded transition-colors ${a ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
      >
        <Icon className="w-3.5 h-3.5" />
      </button>
    );
  };

  return (
    <div
      className="fixed z-50 flex items-center gap-0.5 px-1 py-1 rounded-lg border border-border bg-popover shadow-lg"
      style={{ top: pos.top, left: pos.left, transform: "translateX(-50%)" }}
    >
      {formatBtn("bold", Bold, active.bold)}
      {formatBtn("italic", Italic, active.italic)}
      {formatBtn("underline", Underline, active.underline)}
      {formatBtn("strikeThrough", Strikethrough, active.strike)}
      <div className="w-px h-4 bg-border mx-0.5" />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          const url = window.prompt("URL du lien :", "https://");
          if (url) {
            execFormat("createLink", url);
            onRefresh();
          }
        }}
        className="p-1.5 rounded hover:bg-muted"
        title="Lien"
      >
        <Link2 className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          const color = window.prompt("Couleur de surlignage (ex: #fef08a ou yellow) :", "#fef08a");
          if (color) {
            execFormat("hiliteColor", color);
            onRefresh();
          }
        }}
        className="p-1.5 rounded hover:bg-muted"
        title="Surlignage"
      >
        <Highlighter className="w-3.5 h-3.5" />
      </button>
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          const code = document.createElement("code");
          const sel = window.getSelection();
          if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
            const range = sel.getRangeAt(0);
            range.surroundContents(code);
            onRefresh();
          }
        }}
        className="p-1.5 rounded hover:bg-muted"
        title="Code inline"
      >
        <Code2 className="w-3.5 h-3.5" />
      </button>
      <div className="w-px h-4 bg-border mx-0.5" />
      <button
        type="button"
        onMouseDown={(e) => {
          e.preventDefault();
          execFormat("removeFormat");
          onRefresh();
        }}
        className="p-1.5 rounded hover:bg-muted"
        title="Effacer le formatage"
      >
        <Eraser className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Block menu (popover) ───────────────────────────────────
function BlockMenuButton({
  onPick,
  language,
  align = "start",
}: {
  onPick: (type: BlockType) => void;
  language: string;
  align?: "start" | "center";
}) {
  const isFr = language === "fr";
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title={isFr ? "Ajouter un bloc" : "Add a block"}
        >
          <Plus className="w-4 h-4" />
        </button>
      </PopoverTrigger>
      <PopoverContent align={align} className="w-64 p-1.5 max-h-[60vh] overflow-y-auto">
        <div className="space-y-0.5">
          {BLOCK_MENU.map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.type}
                type="button"
                onClick={() => onPick(item.type)}
                className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
              >
                <span className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                  <Icon className="w-3.5 h-3.5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium">{isFr ? item.fr : item.en}</span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    {isFr ? item.descFr : item.descEn}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

// ─── Main editor ────────────────────────────────────────────
export function PlanEditor() {
  const { language } = useAppStore();
  const isFr = language === "fr";

  const [doc, setDoc] = useState<PlanDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);
  const [slashMenu, setSlashMenu] = useState<{ blockId: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const blockRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const skipNextEffect = useRef<Record<string, boolean>>({});

  // ─── Load ────────────────────────────────────────────────
  const loadDoc = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/plan", { cache: "no-store" });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
      const blocks: Block[] = Array.isArray(data.blocks) ? data.blocks : [];
      setDoc({ id: data.id, title: data.title, blocks, updatedAt: data.updatedAt });
      setLastSaved(data.updatedAt);
    } catch (err: any) {
      setError(err?.message || "Erreur de chargement");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDoc();
  }, [loadDoc]);

  // ─── Save (debounced auto-save while editing) ────────────
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const saveDoc = useCallback(async (blocks: Block[], title: string) => {
    setSaving(true);
    try {
      const res = await fetch("/api/plan", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, blocks }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Erreur");
      setLastSaved(data.updatedAt);
      setDirty(false);
    } catch {
      toast.error(isFr ? "Échec de la sauvegarde" : "Save failed");
    } finally {
      setSaving(false);
    }
  }, [isFr]);

  useEffect(() => {
    if (!isEditing || !dirty || !doc) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveDoc(doc.blocks, doc.title);
    }, 1200);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [isEditing, dirty, doc, saveDoc]);

  // ─── Block mutation helpers ──────────────────────────────
  const updateBlock = useCallback((id: string, patch: Partial<Block>) => {
    setDoc((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        blocks: prev.blocks.map((b) => (b.id === id ? ({ ...b, ...patch } as Block) : b)),
      };
    });
    setDirty(true);
  }, []);

  const insertBlockAfter = useCallback((id: string | null, type: BlockType) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const nb = emptyBlock(type);
      if (id === null) {
        return { ...prev, blocks: [...prev.blocks, nb] };
      }
      const idx = prev.blocks.findIndex((b) => b.id === id);
      const blocks = [...prev.blocks];
      blocks.splice(idx + 1, 0, nb);
      return { ...prev, blocks };
    });
    setDirty(true);
  }, []);

  const deleteBlock = useCallback((id: string) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const blocks = prev.blocks.filter((b) => b.id !== id);
      return { ...prev, blocks: blocks.length ? blocks : [emptyBlock("paragraph")] };
    });
    setDirty(true);
  }, []);

  const moveBlock = useCallback((id: string, dir: -1 | 1) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const idx = prev.blocks.findIndex((b) => b.id === id);
      const ni = idx + dir;
      if (idx < 0 || ni < 0 || ni >= prev.blocks.length) return prev;
      const blocks = [...prev.blocks];
      [blocks[idx], blocks[ni]] = [blocks[ni], blocks[idx]];
      return { ...prev, blocks };
    });
    setDirty(true);
  }, []);

  const duplicateBlock = useCallback((id: string) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const idx = prev.blocks.findIndex((b) => b.id === id);
      if (idx < 0) return prev;
      const orig = prev.blocks[idx];
      const copy = { ...JSON.parse(JSON.stringify(orig)), id: genId() } as Block;
      const blocks = [...prev.blocks];
      blocks.splice(idx + 1, 0, copy);
      return { ...prev, blocks };
    });
    setDirty(true);
  }, []);

  const setBlockType = useCallback((id: string, type: BlockType) => {
    setDoc((prev) => {
      if (!prev) return prev;
      const blocks = prev.blocks.map((b) => {
        if (b.id !== id) return b;
        if (type === "divider") return { id: b.id, type: "divider" } as DividerBlock;
        if (type === "image") return { id: b.id, type: "image", url: "", caption: "", width: 100 } as ImageBlock;
        if (type === "tradingview")
          return { id: b.id, type: "tradingview", symbol: "OANDA:XAUUSD", interval: "60", height: 420, studies: [], caption: "" } as TVBlock;
        // text block — preserve html if coming from a text block
        const prevHtml = isTextBlock(b) ? (b as TextBlock).html : "";
        return { id: b.id, type, html: prevHtml } as TextBlock;
      });
      return { ...prev, blocks };
    });
    setDirty(true);
    // Force the contentEditable to re-sync after type change
    skipNextEffect.current[id] = false;
  }, []);

  const addBlockAtEnd = useCallback((type: BlockType) => {
    insertBlockAfter(null, type);
  }, [insertBlockAfter]);

  // ─── Text block contentEditable sync ─────────────────────
  // Set innerHTML on mount / when block changes / when NOT focused.
  useEffect(() => {
    if (!doc) return;
    doc.blocks.forEach((b) => {
      if (!isTextBlock(b)) return;
      const el = blockRefs.current[b.id];
      if (!el) return;
      if (skipNextEffect.current[b.id]) {
        skipNextEffect.current[b.id] = false;
        return;
      }
      if (document.activeElement === el) return;
      const tb = b as TextBlock;
      if (el.innerHTML !== tb.html) {
        el.innerHTML = tb.html;
      }
    });
  });

  const handleBlockInput = useCallback((id: string, el: HTMLDivElement) => {
    const html = sanitizeHtml(el.innerHTML);
    updateBlock(id, { html } as Partial<Block>);
  }, [updateBlock]);

  const focusBlock = useCallback((id: string, atStart = true) => {
    requestAnimationFrame(() => {
      const el = blockRefs.current[id];
      if (!el) return;
      el.focus();
      const range = document.createRange();
      const sel = window.getSelection();
      if (el.firstChild) {
        range.selectNodeContents(el);
        range.collapse(!atStart);
      } else {
        range.setStart(el, 0);
      }
      sel?.removeAllRanges();
      sel?.addRange(range);
    });
  }, []);

  const handleBlockKeyDown = useCallback((block: Block, e: React.KeyboardEvent) => {
    if (!isTextBlock(block)) return;
    const el = e.currentTarget as HTMLDivElement;
    const tb = block as TextBlock;

    // Slash command menu
    if (e.key === "/" && (el.textContent === "" || el.textContent === "/")) {
      // open menu right after this key is processed
      setTimeout(() => setSlashMenu({ blockId: block.id }), 0);
    }

    if (slashMenu && (e.key === "Escape")) {
      setSlashMenu(null);
    }

    // Enter: create a new paragraph below (Shift+Enter = line break)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      // If current block is a heading/quote/callout, switch new block to paragraph
      const nextType: BlockType = ["h1", "h2", "h3", "quote", "callout"].includes(tb.type)
        ? "paragraph"
        : tb.type === "bullet" ? "bullet" : tb.type === "numbered" ? "numbered" : "paragraph";
      insertBlockAfter(block.id, nextType);
      const newId = (doc?.blocks ?? [])[(doc?.blocks.findIndex((b) => b.id === block.id) ?? -1) + 1]?.id;
      // We can't reliably get the new id synchronously; use a microtask + last-inserted approach
      requestAnimationFrame(() => {
        // focus the newly inserted block — it's the one right after current el in DOM
        const next = el.parentElement?.nextElementSibling?.querySelector("[data-plan-text]") as HTMLDivElement | null;
        if (next) next.focus();
      });
      void newId;
      return;
    }

    // Backspace at start of empty block → delete & focus previous
    if (e.key === "Backspace" && el.textContent === "") {
      e.preventDefault();
      const idx = doc?.blocks.findIndex((b) => b.id === block.id) ?? -1;
      const prev = doc?.blocks[idx - 1];
      deleteBlock(block.id);
      if (prev) focusBlock(prev.id, false);
      return;
    }

    // Arrow up at top → focus previous block
    if (e.key === "ArrowUp") {
      const sel = window.getSelection();
      if (sel && sel.anchorOffset === 0) {
        const idx = doc?.blocks.findIndex((b) => b.id === block.id) ?? -1;
        const prev = doc?.blocks[idx - 1];
        if (prev) {
          e.preventDefault();
          focusBlock(prev.id, false);
        }
      }
    }
    // Arrow down at bottom → focus next block
    if (e.key === "ArrowDown") {
      const sel = window.getSelection();
      const text = el.textContent || "";
      if (sel && sel.anchorOffset === text.length) {
        const idx = doc?.blocks.findIndex((b) => b.id === block.id) ?? -1;
        const next = doc?.blocks[idx + 1];
        if (next) {
          e.preventDefault();
          focusBlock(next.id, true);
        }
      }
    }
  }, [isTextBlock, insertBlockAfter, deleteBlock, focusBlock, doc, slashMenu]);

  // ─── Image upload ─────────────────────────────────────────
  const uploadingFor = useRef<string | null>(null);
  const handleImageUpload = useCallback(async (blockId: string, file: File) => {
    uploadingFor.current = blockId;
    const fd = new FormData();
    fd.append("file", file);
    try {
      const res = await fetch("/api/plan/image", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok || !data.ok) throw new Error(data.error || "Upload échoué");
      updateBlock(blockId, { url: data.url } as Partial<Block>);
      toast.success(isFr ? "Image ajoutée" : "Image added");
    } catch (err: any) {
      toast.error(err?.message || (isFr ? "Upload échoué" : "Upload failed"));
    } finally {
      uploadingFor.current = null;
    }
  }, [updateBlock, isFr]);

  // ─── Title editing ────────────────────────────────────────
  const titleRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (titleRef.current && document.activeElement !== titleRef.current) {
      titleRef.current.textContent = doc?.title || "";
    }
  }, [doc?.title, isEditing]);

  const handleTitleInput = (el: HTMLHeadingElement) => {
    const text = el.textContent || "";
    setDoc((prev) => (prev ? { ...prev, title: text } : prev));
    setDirty(true);
  };

  // ─── Save on leave edit mode ──────────────────────────────
  const toggleEdit = async () => {
    if (isEditing && doc && dirty) {
      // flush save
      if (saveTimer.current) clearTimeout(saveTimer.current);
      await saveDoc(doc.blocks, doc.title);
    }
    setIsEditing((v) => !v);
  };

  // ─── Render ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="p-4 md:p-6 max-w-[900px] mx-auto">
        <div className="flex items-center gap-2 text-muted-foreground mb-4">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">{isFr ? "Chargement du plan…" : "Loading plan…"}</span>
        </div>
        <Card className="p-6 space-y-4">
          <div className="h-8 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-4 w-full rounded bg-muted animate-pulse" />
          <div className="h-4 w-5/6 rounded bg-muted animate-pulse" />
          <div className="h-24 w-full rounded bg-muted animate-pulse" />
        </Card>
      </div>
    );
  }

  if (error || !doc) {
    return (
      <div className="p-4 md:p-6 max-w-[900px] mx-auto">
        <Card className="p-6 text-center">
          <p className="text-sm font-medium text-foreground mb-1">{isFr ? "Impossible de charger le plan." : "Could not load the plan."}</p>
          <p className="text-xs text-muted-foreground mb-3">{error}</p>
          <Button variant="outline" size="sm" onClick={loadDoc}>{isFr ? "Réessayer" : "Retry"}</Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative">
      {isEditing && <FloatingToolbar onRefresh={() => setRefreshKey((k) => k + 1)} />}

      <div className="p-4 md:p-6 max-w-[900px] mx-auto">
        {/* ─── Header ─────────────────────────────────────── */}
        <div className="flex items-center justify-between flex-wrap gap-3 mb-5">
          <div>
            <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald-600 bg-clip-text text-transparent flex items-center gap-2">
              <CandlestickChart className="w-6 h-6 text-primary" />
              {isFr ? "Mon Plan de Trading" : "My Trading Plan"}
            </h2>
            <p className="text-sm text-muted-foreground mt-1 flex items-center gap-2">
              {isEditing ? (
                <>
                  <Pencil className="w-3.5 h-3.5" />
                  {isFr ? "Édition — sauvegarde automatique" : "Editing — auto-save on"}
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5" />
                  {isFr ? "Lecture seule" : "Read-only view"}
                </>
              )}
              {saving && (
                <span className="flex items-center gap-1 text-xs text-muted-foreground ml-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {isFr ? "Sauvegarde…" : "Saving…"}
                </span>
              )}
              {!saving && dirty && isEditing && (
                <span className="text-xs text-amber-500 ml-2">{isFr ? "Modifications non enregistrées" : "Unsaved changes"}</span>
              )}
              {!saving && !dirty && lastSaved && (
                <span className="flex items-center gap-1 text-xs text-emerald-600 ml-2">
                  <Check className="w-3 h-3" />
                  {isFr ? "Enregistré" : "Saved"}
                </span>
              )}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant={isEditing ? "default" : "outline"}
              size="sm"
              className="gap-1.5"
              onClick={toggleEdit}
            >
              {isEditing ? <><Eye className="w-4 h-4" /><span className="hidden sm:inline">{isFr ? "Aperçu" : "Preview"}</span></>
                : <><Pencil className="w-4 h-4" /><span className="hidden sm:inline">{isFr ? "Éditer" : "Edit"}</span></>}
            </Button>
          </div>
        </div>

        {/* ─── Formatting toolbar (edit mode) ─────────────── */}
        {isEditing && (
          <div className="sticky top-2 z-30 mb-4">
            <Card className="p-1.5 flex items-center gap-0.5 flex-wrap bg-popover/95 backdrop-blur supports-[backdrop-filter]:bg-popover/80 shadow-sm">
              <span className="text-[11px] text-muted-foreground px-2 hidden sm:inline">{isFr ? "Format" : "Format"}</span>
              {[
                { cmd: "bold", icon: Bold, label: "G" },
                { cmd: "italic", icon: Italic, label: "I" },
                { cmd: "underline", icon: Underline, label: "U" },
                { cmd: "strikeThrough", icon: Strikethrough, label: "S" },
              ].map((b) => {
                const Icon = b.icon;
                return (
                  <button
                    key={b.cmd}
                    type="button"
                    onMouseDown={(e) => { e.preventDefault(); execFormat(b.cmd); setRefreshKey((k) => k + 1); }}
                    className="p-1.5 rounded hover:bg-muted transition-colors"
                    title={b.cmd}
                  >
                    <Icon className="w-4 h-4" />
                  </button>
                );
              })}
              <div className="w-px h-5 bg-border mx-1" />
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const url = window.prompt(isFr ? "URL du lien :" : "Link URL:", "https://");
                  if (url) { execFormat("createLink", url); setRefreshKey((k) => k + 1); }
                }}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title={isFr ? "Lien" : "Link"}
              >
                <Link2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const color = window.prompt(isFr ? "Couleur de surlignage :" : "Highlight color:", "#fef08a");
                  if (color) { execFormat("hiliteColor", color); setRefreshKey((k) => k + 1); }
                }}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title={isFr ? "Surlignage" : "Highlight"}
              >
                <Highlighter className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  const code = document.createElement("code");
                  code.style.background = "rgba(148,163,184,0.2)";
                  code.style.padding = "0 4px";
                  code.style.borderRadius = "4px";
                  code.style.fontFamily = "monospace";
                  const sel = window.getSelection();
                  if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
                    sel.getRangeAt(0).surroundContents(code);
                    setRefreshKey((k) => k + 1);
                  }
                }}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title={isFr ? "Code inline" : "Inline code"}
              >
                <Code2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onMouseDown={(e) => { e.preventDefault(); execFormat("removeFormat"); setRefreshKey((k) => k + 1); }}
                className="p-1.5 rounded hover:bg-muted transition-colors"
                title={isFr ? "Effacer le formatage" : "Clear formatting"}
              >
                <Eraser className="w-4 h-4" />
              </button>
              <div className="w-px h-5 bg-border mx-1" />
              <div className="ml-auto">
                <BlockMenuButton language={language} onPick={(type) => addBlockAtEnd(type)} align="end" />
              </div>
            </Card>
          </div>
        )}

        {/* ─── Document ───────────────────────────────────── */}
        <Card className="p-5 md:p-10 min-h-[60vh]">
          {/* Title */}
          <h1
            ref={titleRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            onInput={(e) => handleTitleInput(e.currentTarget)}
            className={`text-3xl md:text-4xl font-bold tracking-tight mb-6 outline-none ${
              isEditing ? "cursor-text focus:ring-2 focus:ring-primary/20 rounded px-1 -mx-1" : ""
            }`}
            data-placeholder={isFr ? "Titre du plan…" : "Plan title…"}
          />

          {/* Blocks */}
          <div className="space-y-1.5">
            {doc.blocks.map((block, idx) => (
              <BlockRow
                key={block.id}
                block={block}
                index={idx}
                total={doc.blocks.length}
                isEditing={isEditing}
                language={language}
                blockRef={(el) => { blockRefs.current[block.id] = el; }}
                onInput={(el) => handleBlockInput(block.id, el)}
                onKeyDown={(e) => handleBlockKeyDown(block, e)}
                onUpdate={(patch) => updateBlock(block.id, patch)}
                onInsertAfter={(type) => insertBlockAfter(block.id, type)}
                onDelete={() => deleteBlock(block.id)}
                onMove={(dir) => moveBlock(block.id, dir)}
                onDuplicate={() => duplicateBlock(block.id)}
                onSetType={(type) => setBlockType(block.id, type)}
                onImageUpload={(file) => handleImageUpload(block.id, file)}
                slashMenuOpen={slashMenu?.blockId === block.id}
                onSlashClose={() => setSlashMenu(null)}
                onSlashPick={(type) => {
                  setBlockType(block.id, type);
                  setSlashMenu(null);
                  if (type === "divider" || type === "image" || type === "tradingview") {
                    insertBlockAfter(block.id, "paragraph");
                  }
                }}
              />
            ))}
          </div>

          {/* Empty / add at end */}
          {isEditing && (
            <div className="mt-4 flex items-center gap-2">
              <BlockMenuButton language={language} onPick={(type) => addBlockAtEnd(type)} align="start" />
              <span className="text-xs text-muted-foreground">{isFr ? "Ajouter un bloc" : "Add a block"}</span>
            </div>
          )}

          {doc.blocks.length === 0 && !isEditing && (
            <div className="text-center py-16 text-muted-foreground">
              <p className="text-sm">{isFr ? "Le plan est vide. Cliquez sur « Éditer » pour commencer." : "The plan is empty. Click “Edit” to start."}</p>
            </div>
          )}
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          {isFr ? "Plan stocké localement dans votre application — aucune dépendance externe." : "Plan stored locally in your app — no external dependency."}
        </p>
      </div>

      <span className="hidden" data-refresh={refreshKey} />
    </div>
  );
}

// ─── Block row ──────────────────────────────────────────────
interface BlockRowProps {
  block: Block;
  index: number;
  total: number;
  isEditing: boolean;
  language: string;
  blockRef: (el: HTMLDivElement | null) => void;
  onInput: (el: HTMLDivElement) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onUpdate: (patch: Partial<Block>) => void;
  onInsertAfter: (type: BlockType) => void;
  onDelete: () => void;
  onMove: (dir: -1 | 1) => void;
  onDuplicate: () => void;
  onSetType: (type: BlockType) => void;
  onImageUpload: (file: File) => void;
  slashMenuOpen: boolean;
  onSlashClose: () => void;
  onSlashPick: (type: BlockType) => void;
}

function BlockRow(props: BlockRowProps) {
  const {
    block, index, total, isEditing, language,
    blockRef, onInput, onKeyDown, onUpdate,
    onInsertAfter, onDelete, onMove, onDuplicate, onSetType,
    onImageUpload, slashMenuOpen, onSlashClose, onSlashPick,
  } = props;
  const isFr = language === "fr";
  const isText = isTextBlock(block);

  const blockClasses = useMemo(() => {
    const base = "outline-none focus:ring-2 focus:ring-primary/15 rounded px-1 -mx-1 transition-shadow";
    switch (block.type) {
      case "h1": return `${base} text-2xl md:text-3xl font-bold tracking-tight mt-6 mb-2`;
      case "h2": return `${base} text-xl md:text-2xl font-bold tracking-tight mt-5 mb-2`;
      case "h3": return `${base} text-lg md:text-xl font-semibold mt-4 mb-1`;
      case "paragraph": return `${base} text-[15px] leading-relaxed`;
      case "bullet": return `${base} text-[15px] leading-relaxed pl-5 relative before:content-['•'] before:absolute before:left-1.5 before:text-muted-foreground`;
      case "numbered": return `${base} text-[15px] leading-relaxed pl-6 relative before:content-[attr(data-n)] before:absolute before:left-0 before:text-muted-foreground before:font-medium`;
      case "quote": return `${base} text-[15px] leading-relaxed italic border-l-4 border-primary/40 pl-4 py-1 text-muted-foreground`;
      case "callout": return `${base} text-[15px] leading-relaxed bg-primary/5 border border-primary/20 rounded-lg p-3 my-1`;
      case "code": return `${base} text-[13px] leading-relaxed font-mono bg-muted rounded-lg p-3 my-1 overflow-x-auto`;
      default: return base;
    }
  }, [block.type]);

  const placeholder = useMemo(() => {
    const map: Record<string, string> = {
      h1: isFr ? "Titre 1" : "Heading 1",
      h2: isFr ? "Titre 2" : "Heading 2",
      h3: isFr ? "Titre 3" : "Heading 3",
      paragraph: isFr ? "Écrivez quelque chose…" : "Write something…",
      bullet: isFr ? "Élément de liste" : "List item",
      numbered: isFr ? "Élément numéroté" : "Numbered item",
      quote: isFr ? "Citation…" : "Quote…",
      callout: isFr ? "Texte à mettre en valeur…" : "Highlight text…",
      code: isFr ? "Votre code…" : "Your code…",
    };
    return map[block.type] || "";
  }, [block.type, isFr]);

  return (
    <div className="group relative flex items-start gap-1">
      {/* Hover controls */}
      {isEditing && (
        <div className="absolute -left-9 top-0 hidden group-hover:flex items-center gap-0.5 z-10">
          <BlockMenuButton language={language} onPick={(type) => onInsertAfter(type)} align="start" />
          <Popover>
            <PopoverTrigger asChild>
              <button
                type="button"
                className="p-1 rounded-md text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab"
                title={isFr ? "Options" : "Options"}
              >
                <GripVertical className="w-3.5 h-3.5" />
              </button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-48 p-1.5">
              <div className="px-2 py-1 text-[11px] font-semibold text-muted-foreground uppercase tracking-wide">
                {isFr ? "Type de bloc" : "Block type"}
              </div>
              <div className="max-h-48 overflow-y-auto">
                {BLOCK_MENU.filter((m) => TEXT_TYPES.includes(m.type) || m.type === block.type).map((m) => {
                  const Icon = m.icon;
                  return (
                    <button
                      key={m.type}
                      type="button"
                      onClick={() => onSetType(m.type)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-left text-sm hover:bg-muted ${block.type === m.type ? "bg-muted font-medium" : ""}`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      {isFr ? m.fr : m.en}
                    </button>
                  );
                })}
              </div>
              <div className="h-px bg-border my-1" />
              <button type="button" onClick={() => onMove(-1)} disabled={index === 0} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowUp className="w-3.5 h-3.5" /> {isFr ? "Monter" : "Move up"}
              </button>
              <button type="button" onClick={() => onMove(1)} disabled={index === total - 1} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted disabled:opacity-40 disabled:cursor-not-allowed">
                <ArrowDown className="w-3.5 h-3.5" /> {isFr ? "Descendre" : "Move down"}
              </button>
              <button type="button" onClick={onDuplicate} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm hover:bg-muted">
                <Copy className="w-3.5 h-3.5" /> {isFr ? "Dupliquer" : "Duplicate"}
              </button>
              <div className="h-px bg-border my-1" />
              <button type="button" onClick={onDelete} className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm text-destructive hover:bg-destructive/10">
                <Trash2 className="w-3.5 h-3.5" /> {isFr ? "Supprimer" : "Delete"}
              </button>
            </PopoverContent>
          </Popover>
        </div>
      )}

      {/* Block content */}
      <div className="flex-1 min-w-0 relative">
        {isText ? (
          <div
            ref={blockRef}
            contentEditable={isEditing}
            suppressContentEditableWarning
            spellCheck
            data-plan-text="1"
            data-placeholder={placeholder}
            data-n={block.type === "numbered" ? `${index + 1}.` : undefined}
            onInput={(e) => onInput(e.currentTarget)}
            onKeyDown={onKeyDown}
            className={blockClasses}
            style={block.type === "numbered" ? { "--n": `"${index + 1}."` } as React.CSSProperties : undefined}
          />
        ) : block.type === "divider" ? (
          <hr className="my-4 border-t border-border" />
        ) : block.type === "image" ? (
          <ImageBlockView
            block={block as ImageBlock}
            isEditing={isEditing}
            language={language}
            onUpdate={onUpdate}
            onUpload={onImageUpload}
          />
        ) : block.type === "tradingview" ? (
          <TradingViewBlockView
            block={block as TVBlock}
            isEditing={isEditing}
            language={language}
            onUpdate={onUpdate}
          />
        ) : null}

        {/* Slash command menu */}
        {slashMenuOpen && (
          <div className="absolute left-0 top-full z-40 mt-1">
            <Card className="p-1.5 w-64 shadow-xl max-h-72 overflow-y-auto">
              {BLOCK_MENU.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => onSlashPick(item.type)}
                    className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md hover:bg-muted transition-colors text-left"
                  >
                    <span className="flex-shrink-0 w-7 h-7 rounded-md bg-muted flex items-center justify-center">
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-medium">{isFr ? item.fr : item.en}</span>
                    </span>
                  </button>
                );
              })}
              <button type="button" onClick={onSlashClose} className="w-full text-center text-[11px] text-muted-foreground py-1 hover:bg-muted rounded-md">
                {isFr ? "Échap pour fermer" : "Esc to close"}
              </button>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Image block ────────────────────────────────────────────
function ImageBlockView({
  block, isEditing, language, onUpdate, onUpload,
}: {
  block: ImageBlock;
  isEditing: boolean;
  language: string;
  onUpdate: (patch: Partial<Block>) => void;
  onUpload: (file: File) => void;
}) {
  const isFr = language === "fr";
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    try {
      await onUpload(file);
    } finally {
      setUploading(false);
    }
  };

  return (
    <figure className="my-3">
      {block.url ? (
        <div className="relative rounded-lg overflow-hidden border border-border bg-muted/30">
          <img
            src={block.url}
            alt={block.caption || ""}
            className="w-full h-auto object-contain"
            style={{ maxWidth: `${block.width || 100}%`, margin: "0 auto" }}
            loading="lazy"
          />
          {isEditing && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="absolute top-2 right-2 px-2 py-1 rounded-md bg-background/90 backdrop-blur text-xs hover:bg-background shadow border border-border"
            >
              {isFr ? "Remplacer" : "Replace"}
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!isEditing || uploading}
          className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-2 text-muted-foreground hover:border-primary/50 hover:bg-muted/30 transition-colors disabled:opacity-60"
        >
          {uploading ? (
            <Loader2 className="w-8 h-8 animate-spin" />
          ) : (
            <ImageIcon className="w-8 h-8" />
          )}
          <span className="text-sm font-medium">
            {uploading ? (isFr ? "Chargement…" : "Uploading…") : isEditing ? (isFr ? "Cliquez pour téléverser une image" : "Click to upload an image") : (isFr ? "Aucune image" : "No image")}
          </span>
          <span className="text-xs">PNG, JPG, GIF, WebP — max 8 Mo</span>
        </button>
      )}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleFile(f);
          e.target.value = "";
        }}
      />
      {block.url && (isEditing || block.caption) && (
        <figcaption
          contentEditable={isEditing}
          suppressContentEditableWarning
          data-placeholder={isFr ? "Légende (optionnel)…" : "Caption (optional)…"}
          onInput={(e) => onUpdate({ caption: e.currentTarget.textContent || "" } as Partial<Block>)}
          className="text-center text-xs text-muted-foreground mt-1.5 outline-none focus:ring-2 focus:ring-primary/15 rounded px-1"
        >
          {block.caption || ""}
        </figcaption>
      )}
      {block.url && isEditing && (
        <div className="flex items-center gap-2 mt-2 px-1">
          <Label className="text-[11px] text-muted-foreground whitespace-nowrap">{isFr ? "Largeur" : "Width"}</Label>
          <input
            type="range"
            min={30}
            max={100}
            value={block.width || 100}
            onChange={(e) => onUpdate({ width: parseInt(e.target.value) } as Partial<Block>)}
            className="flex-1 accent-primary"
          />
          <span className="text-[11px] text-muted-foreground w-9 text-right">{block.width || 100}%</span>
        </div>
      )}
    </figure>
  );
}

// ─── TradingView block ──────────────────────────────────────
const TV_SYMBOLS = [
  { value: "OANDA:XAUUSD", label: "Or / XAUUSD" },
  { value: "FX:EURUSD", label: "EUR / USD" },
  { value: "FX:GBPUSD", label: "GBP / USD" },
  { value: "FX:USDJPY", label: "USD / JPY" },
  { value: "TVC:US30", label: "US30 (Dow Jones)" },
  { value: "NASDAQ:NDX", label: "US100 (Nasdaq)" },
  { value: "TVC:SPX", label: "S&P 500" },
  { value: "TVC:DXY", label: "Dollar Index (DXY)" },
  { value: "BINANCE:BTCUSDT", label: "BTC / USDT" },
  { value: "BINANCE:ETHUSDT", label: "ETH / USDT" },
  { value: "TVC:VIX", label: "VIX (Volatilité)" },
];
const TV_INTERVALS = [
  { value: "1", label: "1m" },
  { value: "5", label: "5m" },
  { value: "15", label: "15m" },
  { value: "30", label: "30m" },
  { value: "60", label: "1h" },
  { value: "240", label: "4h" },
  { value: "D", label: "1J" },
  { value: "W", label: "1S" },
];
const TV_STUDIES = [
  { value: "STD;RSI", label: "RSI" },
  { value: "STD;MACD", label: "MACD" },
  { value: "STD;Bollinger_Bands", label: "Bandes de Bollinger" },
  { value: "STD;EMA", label: "EMA" },
  { value: "STD;SMA", label: "SMA" },
  { value: "STD;VWMA", label: "VWMA" },
  { value: "STD;Stochastic", label: "Stochastique" },
  { value: "STD;ADX", label: "ADX" },
  { value: "STD;ATR", label: "ATR" },
  { value: "STD;Volume", label: "Volume" },
];

function TradingViewBlockView({
  block, isEditing, language, onUpdate,
}: {
  block: TVBlock;
  isEditing: boolean;
  language: string;
  onUpdate: (patch: Partial<Block>) => void;
}) {
  const isFr = language === "fr";
  const [showConfig, setShowConfig] = useState(false);

  return (
    <div className="my-3 rounded-lg border border-border overflow-hidden bg-background">
      <div className="relative">
        <TradingViewChart
          symbol={block.symbol}
          interval={block.interval}
          height={block.height || 420}
          studies={block.studies || []}
        />
        {isEditing && (
          <button
            type="button"
            onClick={() => setShowConfig((v) => !v)}
            className="absolute top-2 right-2 z-10 px-2.5 py-1 rounded-md bg-background/90 backdrop-blur text-xs font-medium hover:bg-background shadow border border-border flex items-center gap-1"
          >
            <CandlestickChart className="w-3 h-3" />
            {isFr ? "Configurer" : "Configure"}
            <ChevronDown className={`w-3 h-3 transition-transform ${showConfig ? "rotate-180" : ""}`} />
          </button>
        )}
      </div>

      {isEditing && showConfig && (
        <div className="p-3 border-t border-border bg-muted/30 space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{isFr ? "Actif" : "Symbol"}</Label>
              <Select value={block.symbol} onValueChange={(v) => onUpdate({ symbol: v } as Partial<Block>)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TV_SYMBOLS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{isFr ? "Unité de temps" : "Interval"}</Label>
              <Select value={block.interval} onValueChange={(v) => onUpdate({ interval: v } as Partial<Block>)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TV_INTERVALS.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{isFr ? "Indicateurs" : "Studies"}</Label>
            <div className="flex flex-wrap gap-1.5">
              {TV_STUDIES.map((s) => {
                const active = (block.studies || []).includes(s.value);
                return (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => {
                      const cur = block.studies || [];
                      const next = active ? cur.filter((x) => x !== s.value) : [...cur, s.value];
                      onUpdate({ studies: next } as Partial<Block>);
                    }}
                    className={`px-2 py-0.5 rounded-full text-[11px] border transition-colors ${
                      active ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
                    }`}
                  >
                    {s.label}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs whitespace-nowrap">{isFr ? "Hauteur" : "Height"}</Label>
            <input
              type="range"
              min={300}
              max={700}
              step={20}
              value={block.height || 420}
              onChange={(e) => onUpdate({ height: parseInt(e.target.value) } as Partial<Block>)}
              className="flex-1 accent-primary"
            />
            <span className="text-[11px] text-muted-foreground w-12 text-right">{block.height || 420}px</span>
          </div>
        </div>
      )}

      {(block.caption || isEditing) && (
        <div
          contentEditable={isEditing}
          suppressContentEditableWarning
          data-placeholder={isFr ? "Légende du graphique (optionnel)…" : "Chart caption (optional)…"}
          onInput={(e) => onUpdate({ caption: e.currentTarget.textContent || "" } as Partial<Block>)}
          className="text-center text-xs text-muted-foreground py-2 px-3 outline-none focus:ring-2 focus:ring-primary/15"
        >
          {block.caption || ""}
        </div>
      )}
    </div>
  );
}
