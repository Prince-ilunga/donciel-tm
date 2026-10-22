"use client";

import React, { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAppStore } from "@/stores/app-store";
import type { ImportMode, ParsedTradePreview } from "@/lib/import-parser";
import { cn } from "@/lib/utils";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import {
  AlertTriangle,
  ArrowLeft,
  BookOpen,
  CheckCircle2,
  ClipboardPaste,
  FileSpreadsheet,
  FileText,
  Loader2,
  Sparkles,
  Upload,
} from "lucide-react";

interface ImportDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: (count: number) => void;
}

type Step = "source" | "preview" | "result";

interface ImportResult {
  created: number;
  skipped: number;
  limitReached: boolean;
}

const CUSTOM_SCROLLBAR =
  "[&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border";

function fmtMoney(v: number | null): string {
  if (v === null) return "—";
  const sign = v > 0 ? "+" : v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toFixed(2)}`;
}

function fmtDate(iso: string): string {
  return iso.slice(0, 16).replace("T", " ");
}

export function ImportDialog(props: ImportDialogProps) {
  // Dé-monte complètement le contenu quand le dialog est fermé :
  // l'état (étape, fichier, previews…) se réinitialise à chaque ouverture.
  if (!props.open) return null;
  return <ImportDialogInner {...props} />;
}

function ImportDialogInner({ open, onClose, onImported }: ImportDialogProps) {
  const { language } = useAppStore();
  const setActiveTab = useAppStore((s) => s.setActiveTab);
  const router = useRouter();

  const [step, setStep] = useState<Step>("source");
  const [mode, setMode] = useState<ImportMode | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [showPaste, setShowPaste] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [importing, setImporting] = useState(false);
  const [upgradeBlocked, setUpgradeBlocked] = useState(false);
  const [previews, setPreviews] = useState<ParsedTradePreview[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [accountName, setAccountName] = useState("Principal");
  const [result, setResult] = useState<ImportResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fr = language === "fr";

  // ─── Analyse (POST /api/import) ───────────────────────────────
  const analyze = useCallback(
    async (nextContent: string, nextMode: ImportMode) => {
      if (nextContent.trim().length < 20) {
        toast.error(fr ? "Fichier vide ou illisible" : "File is empty or unreadable");
        return;
      }
      setAnalyzing(true);
      setUpgradeBlocked(false);
      try {
        const res = await fetch("/api/import", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: nextMode, content: nextContent }),
        });
        if (res.status === 402) {
          const data = await res.json().catch(() => null);
          setUpgradeBlocked(true);
          toast.error(
            data?.error ??
              (fr ? "Import réservé aux plans Pro et Elite" : "Import is Pro/Elite only")
          );
          return;
        }
        if (res.status === 401) {
          router.push("/login");
          return;
        }
        const data = (await res.json().catch(() => null)) as {
          trades?: ParsedTradePreview[];
          warnings?: string[];
          error?: string;
        } | null;
        if (!res.ok) {
          toast.error(data?.error ?? (fr ? "Erreur lors de l'analyse" : "Analysis failed"));
          return;
        }
        const trades = data?.trades ?? [];
        setWarnings(data?.warnings ?? []);
        if (trades.length === 0) {
          toast.error(
            fr
              ? "Aucun trade détecté dans ce fichier. Vérifie qu'il s'agit bien d'un rapport MT5 ou d'un CSV de trades."
              : "No trade detected in this file. Make sure it is an MT5 report or a trades CSV."
          );
          return;
        }
        setPreviews(trades);
        setStep("preview");
      } catch {
        toast.error(fr ? "Erreur réseau lors de l'analyse" : "Network error during analysis");
      } finally {
        setAnalyzing(false);
      }
    },
    [fr, router]
  );

  const detectModeFromContent = useCallback((text: string): ImportMode => {
    return /<table|<html|<tr[\s>]/i.test(text.slice(0, 5000)) ? "MT5_HTML" : "CSV";
  }, []);

  // ─── Fichier (drag & drop ou input) ───────────────────────────
  const handleFile = useCallback(
    (file: File) => {
      const isHtml = /\.(html?|htm)$/i.test(file.name) || file.type === "text/html";
      const nextMode: ImportMode = isHtml ? "MT5_HTML" : "CSV";
      setMode(nextMode);
      setFileName(file.name);
      const reader = new FileReader();
      reader.onload = () => {
        const text = typeof reader.result === "string" ? reader.result : "";
        setContent(text);
        void analyze(text, nextMode);
      };
      reader.onerror = () => {
        toast.error(fr ? "Impossible de lire ce fichier" : "Unable to read this file");
      };
      reader.readAsText(file);
    },
    [analyze, fr]
  );

  // ─── Confirmation (PUT /api/import) ───────────────────────────
  const confirmImport = useCallback(async () => {
    if (previews.length === 0) return;
    setImporting(true);
    try {
      const res = await fetch("/api/import", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trades: previews,
          accountName: accountName.trim() || "Principal",
          mode,
        }),
      });
      if (res.status === 402) {
        const data = await res.json().catch(() => null);
        setUpgradeBlocked(true);
        toast.error(
          data?.error ??
            (fr ? "Limite du plan atteinte" : "Plan limit reached")
        );
        return;
      }
      if (res.status === 401) {
        router.push("/login");
        return;
      }
      const data = (await res.json().catch(() => null)) as
        | (ImportResult & { error?: string })
        | null;
      if (!res.ok) {
        toast.error(data?.error ?? (fr ? "Erreur lors de l'import" : "Import failed"));
        return;
      }
      setResult({
        created: data?.created ?? 0,
        skipped: data?.skipped ?? 0,
        limitReached: Boolean(data?.limitReached),
      });
      onImported(data?.created ?? 0);
      toast.success(
        fr ? `${data?.created ?? 0} trades importés !` : `${data?.created ?? 0} trades imported!`
      );
      setStep("result");
    } catch {
      toast.error(fr ? "Erreur réseau lors de l'import" : "Network error during import");
    } finally {
      setImporting(false);
    }
  }, [previews, accountName, mode, fr, onImported, router]);

  const updateTrade = useCallback(
    (index: number, patch: Partial<ParsedTradePreview>) => {
      setPreviews((prev) => prev.map((t, i) => (i === index ? { ...t, ...patch } : t)));
    },
    []
  );

  const openJournal = useCallback(() => {
    onClose();
    setActiveTab("journal");
  }, [onClose, setActiveTab]);

  const winCount = previews.filter((t) => t.result === "WIN").length;
  const lossCount = previews.filter((t) => t.result === "LOSS").length;
  const totalPnl = previews.reduce((acc, t) => acc + (t.pnl ?? 0), 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className={cn(
          "max-h-[92dvh] overflow-y-auto sm:max-w-3xl",
          CUSTOM_SCROLLBAR
        )}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Upload className="h-5 w-5 text-primary" />
            {step === "result"
              ? fr
                ? "Import terminé"
                : "Import complete"
              : fr
                ? "Importer mes trades"
                : "Import my trades"}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {fr
              ? "Importe ton rapport MetaTrader 5 ou un fichier CSV pour journaliser automatiquement tes trades."
              : "Import your MetaTrader 5 report or a CSV file to auto-journal your trades."}
          </DialogDescription>
        </DialogHeader>

        {/* ─── Étape 1 : choix de la source ─────────────────── */}
        {step === "source" && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => setMode("MT5_HTML")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-accent/40",
                  mode === "MT5_HTML" && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <FileText className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {fr ? "Rapport MetaTrader 5 (HTML)" : "MetaTrader 5 report (HTML)"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fr
                        ? "Historique / transactions clôturées (.html)"
                        : "History / closed deals report (.html)"}
                    </p>
                  </div>
                </div>
              </button>
              <button
                type="button"
                onClick={() => setMode("CSV")}
                className={cn(
                  "rounded-xl border p-4 text-left transition-all hover:border-primary/50 hover:bg-accent/40",
                  mode === "CSV" && "border-primary bg-primary/5 ring-1 ring-primary"
                )}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
                    <FileSpreadsheet className="h-4.5 w-4.5 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {fr ? "Fichier CSV" : "CSV file"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {fr
                        ? "Export broker ou tableur (.csv, .txt)"
                        : "Broker or spreadsheet export (.csv, .txt)"}
                    </p>
                  </div>
                </div>
              </button>
            </div>

            {/* Zone de dépôt */}
            <div
              role="button"
              tabIndex={0}
              aria-label={fr ? "Déposer ou choisir un fichier" : "Drop or choose a file"}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => {
                e.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                const file = e.dataTransfer.files?.[0];
                if (file) handleFile(file);
              }}
              className={cn(
                "flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors",
                dragging ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"
              )}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".html,.htm,.csv,.txt"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
              {analyzing ? (
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              ) : (
                <Upload className="h-6 w-6 text-muted-foreground" />
              )}
              <p className="text-sm font-medium">
                {analyzing
                  ? fr
                    ? "Analyse du fichier…"
                    : "Analyzing file…"
                  : fileName
                    ? fileName
                    : fr
                      ? "Glisse ton fichier ici ou clique pour parcourir"
                      : "Drop your file here or click to browse"}
              </p>
              <p className="text-xs text-muted-foreground">
                {fr
                  ? "Formats acceptés : .html, .htm, .csv, .txt — export HTML complet de MT5 accepté"
                  : "Accepted formats: .html, .htm, .csv, .txt — full MT5 HTML export supported"}
              </p>
            </div>

            {/* Coller le contenu */}
            <div className="space-y-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground"
                onClick={() => setShowPaste((v) => !v)}
              >
                <ClipboardPaste className="h-4 w-4" />
                {fr ? "Coller le contenu" : "Paste content"}
              </Button>
              {showPaste && (
                <Textarea
                  value={content}
                  onChange={(e) => {
                    setContent(e.target.value);
                    setFileName(null);
                  }}
                  placeholder={
                    fr
                      ? "Colle ici le contenu du rapport MT5 ou du CSV…"
                      : "Paste your MT5 report or CSV content here…"
                  }
                  className={cn("min-h-32 font-mono text-xs", CUSTOM_SCROLLBAR)}
                />
              )}
            </div>

            {upgradeBlocked && (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {fr
                      ? "L'import MT5/CSV est disponible à partir du plan Pro."
                      : "MT5/CSV import is available from the Pro plan."}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => router.push("/abonnement")}
                  >
                    {fr ? "Passer au plan Pro" : "Upgrade to Pro"}
                  </Button>
                </AlertDescription>
              </Alert>
            )}

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={onClose}>
                {fr ? "Annuler" : "Cancel"}
              </Button>
              <Button
                disabled={!content.trim() || analyzing}
                onClick={() => void analyze(content, mode ?? detectModeFromContent(content))}
              >
                {analyzing && <Loader2 className="h-4 w-4 animate-spin" />}
                {fr ? "Analyser" : "Analyze"}
              </Button>
            </div>
          </div>
        )}

        {/* ─── Étape 2 : prévisualisation ───────────────────── */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-semibold">
                {fr
                  ? `${previews.length} trade${previews.length > 1 ? "s" : ""} détecté${previews.length > 1 ? "s" : ""}`
                  : `${previews.length} trade${previews.length > 1 ? "s" : ""} detected`}
              </span>
              {fileName && (
                <Badge variant="outline" className="max-w-48 truncate font-mono text-[10px]">
                  {fileName}
                </Badge>
              )}
              <Badge variant="outline" className="text-[10px] text-profit border-profit/30">
                {winCount} {fr ? "gagnants" : "wins"}
              </Badge>
              <Badge variant="outline" className="text-[10px] text-loss border-loss/30">
                {lossCount} {fr ? "perdants" : "losses"}
              </Badge>
              <Badge
                variant="outline"
                className={cn(
                  "text-[10px] font-mono",
                  totalPnl >= 0 ? "text-profit border-profit/30" : "text-loss border-loss/30"
                )}
              >
                {fmtMoney(totalPnl)}
              </Badge>
            </div>

            {warnings.length > 0 && (
              <Alert className="border-amber-500/40 bg-amber-500/10">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <AlertDescription>
                  <ul className="list-inside list-disc space-y-0.5 text-xs">
                    {warnings.map((w, i) => (
                      <li key={i}>{w}</li>
                    ))}
                  </ul>
                </AlertDescription>
              </Alert>
            )}

            <ScrollArea
              className={cn(
                "max-h-96 rounded-lg border [&>[data-slot=scroll-area-viewport]]:max-h-96 [&>[data-slot=scroll-area-viewport]]:[&::-webkit-scrollbar]:w-1.5 [&>[data-slot=scroll-area-viewport]]:[&::-webkit-scrollbar-thumb]:rounded-full [&>[data-slot=scroll-area-viewport]]:[&::-webkit-scrollbar-thumb]:bg-border"
              )}
            >
              <div className="min-w-[880px]">
                {/* En-têtes */}
                <div className="grid grid-cols-[132px_104px_92px_64px_80px_80px_80px_64px_88px_76px] gap-1.5 border-b bg-muted/50 px-2 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                  <span>{fr ? "Date" : "Date"}</span>
                  <span>{fr ? "Paire" : "Pair"}</span>
                  <span>{fr ? "Direction" : "Direction"}</span>
                  <span>{fr ? "Lot" : "Lot"}</span>
                  <span>{fr ? "Entrée" : "Entry"}</span>
                  <span>SL</span>
                  <span>TP</span>
                  <span>RR</span>
                  <span>PnL</span>
                  <span>{fr ? "Résultat" : "Result"}</span>
                </div>
                {/* Lignes éditables */}
                {previews.map((t, i) => (
                  <div
                    key={`${t.date}-${t.pair}-${i}`}
                    className="grid grid-cols-[132px_104px_92px_64px_80px_80px_80px_64px_88px_76px] items-center gap-1.5 border-b px-2 py-1.5 text-xs last:border-b-0 hover:bg-muted/30"
                  >
                    <span className="font-mono text-[11px] text-muted-foreground">
                      {fmtDate(t.date)}
                    </span>
                    <Input
                      value={t.pair}
                      onChange={(e) => updateTrade(i, { pair: e.target.value })}
                      className="h-7 w-full min-w-0 px-1.5 font-mono text-[11px] uppercase"
                      aria-label={fr ? "Paire" : "Pair"}
                    />
                    <Select
                      value={t.direction}
                      onValueChange={(v) =>
                        updateTrade(i, { direction: v as "LONG" | "SHORT" })
                      }
                    >
                      <SelectTrigger
                        className="h-7 w-full min-w-0 px-1.5 text-[11px]"
                        aria-label={fr ? "Direction" : "Direction"}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LONG">LONG</SelectItem>
                        <SelectItem value="SHORT">SHORT</SelectItem>
                      </SelectContent>
                    </Select>
                    <span className="text-right font-mono text-[11px]">
                      {t.lotSize !== null ? t.lotSize.toFixed(2) : "—"}
                    </span>
                    <span className="text-right font-mono text-[11px]">
                      {t.entryPrice.toFixed(t.entryPrice >= 100 ? 1 : 4)}
                    </span>
                    <span className="text-right font-mono text-[11px]">
                      {t.stopLoss > 0 ? t.stopLoss.toFixed(t.stopLoss >= 100 ? 1 : 4) : "—"}
                    </span>
                    <span className="text-right font-mono text-[11px]">
                      {t.takeProfit > 0
                        ? t.takeProfit.toFixed(t.takeProfit >= 100 ? 1 : 4)
                        : "—"}
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-[11px]",
                        t.rr === null && "text-muted-foreground",
                        t.rr !== null && t.rr >= 0 && "text-profit",
                        t.rr !== null && t.rr < 0 && "text-loss"
                      )}
                    >
                      {t.rr !== null ? `${t.rr.toFixed(2)}R` : "—"}
                    </span>
                    <span
                      className={cn(
                        "text-right font-mono text-[11px] font-semibold",
                        (t.pnl ?? 0) > 0 && "text-profit",
                        (t.pnl ?? 0) < 0 && "text-loss",
                        t.pnl === null && "text-muted-foreground"
                      )}
                    >
                      {fmtMoney(t.pnl)}
                    </span>
                    <Badge
                      className={cn(
                        "justify-center text-[10px]",
                        t.result === "WIN" && "bg-profit/10 text-profit",
                        t.result === "LOSS" && "bg-loss/10 text-loss",
                        t.result === "BE" && "bg-muted text-muted-foreground"
                      )}
                    >
                      {t.result}
                    </Badge>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="space-y-1.5">
                <Label htmlFor="import-account-name" className="text-xs">
                  {fr ? "Nom du compte" : "Account name"}
                </Label>
                <Input
                  id="import-account-name"
                  value={accountName}
                  onChange={(e) => setAccountName(e.target.value)}
                  placeholder="Principal"
                  className="h-9 w-full sm:w-56"
                  maxLength={60}
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setStep("source")}
                  disabled={importing}
                >
                  <ArrowLeft className="h-4 w-4" />
                  {fr ? "Retour" : "Back"}
                </Button>
                <Button onClick={() => void confirmImport()} disabled={importing}>
                  {importing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {fr
                    ? `Importer ${previews.length} trade${previews.length > 1 ? "s" : ""}`
                    : `Import ${previews.length} trade${previews.length > 1 ? "s" : ""}`}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* ─── Étape 3 : résultat ───────────────────────────── */}
        {step === "result" && result && (
          <div className="space-y-5 py-2 text-center">
            <div className="flex flex-col items-center gap-2">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-profit/10">
                <CheckCircle2 className="h-8 w-8 text-profit" />
              </div>
              <p className="text-lg font-bold">
                {fr
                  ? `${result.created} trade${result.created > 1 ? "s" : ""} importé${result.created > 1 ? "s" : ""} !`
                  : `${result.created} trade${result.created > 1 ? "s" : ""} imported!`}
              </p>
              {result.skipped > 0 && (
                <p className="text-sm text-muted-foreground">
                  {fr
                    ? `${result.skipped} ignoré${result.skipped > 1 ? "s" : ""}${result.limitReached ? " (quota du plan atteint)" : ""}`
                    : `${result.skipped} skipped${result.limitReached ? " (plan quota reached)" : ""}`}
                </p>
              )}
            </div>

            <div className="mx-auto flex max-w-md items-start gap-2.5 rounded-xl border bg-muted/40 p-3.5 text-left">
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <p className="text-sm text-muted-foreground">
                {fr
                  ? "Tes trades sont journalisés ! Ajoute tes émotions et leçons dans le journal."
                  : "Your trades are journalled! Add your emotions and lessons in the journal."}
              </p>
            </div>

            <div className="flex flex-col justify-center gap-2 sm:flex-row">
              <Button onClick={openJournal}>
                <BookOpen className="h-4 w-4" />
                {fr ? "Ouvrir le journal" : "Open journal"}
              </Button>
              <Button variant="outline" onClick={onClose}>
                {fr ? "Fermer" : "Close"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
