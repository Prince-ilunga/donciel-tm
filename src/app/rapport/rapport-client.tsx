'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, CalendarDays, Loader2, Printer, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  buildCalendarMonth,
  computeCoreStats,
  DAY_LABELS_FR,
  MONTH_LABELS_FR,
  monthSummary,
  type CalendarDay,
  type TradeLike,
} from '@/lib/analytics';
import {
  computeDoncielScore,
  computeViolations,
  type RiskProfileInput,
  type ViolationsReport,
} from '@/lib/discipline';

// ─────────────────────────────────────────────────────────────
// DONCIEL TM — Rapport mensuel imprimable (Pack 4 — Croissance)
// Page autonome /rapport : auth via /api/auth/me (→ /login),
// données via /api/trades + /api/risk-profile.
// SANS useSearchParams — le mois se choisit avec useState.
// ─────────────────────────────────────────────────────────────

const PRINT_CSS = `
@page { margin: 12mm; }
@media print {
  body * { visibility: hidden; }
  .print-report, .print-report * { visibility: visible; }
  .print-report {
    position: absolute;
    inset: 0;
    width: 100%;
    max-width: none !important;
    margin: 0 !important;
    border-radius: 0 !important;
    box-shadow: none !important;
    border: none !important;
  }
  .no-print { display: none !important; }
}
`;

function currentMonthKey(): string {
  const n = new Date();
  return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(key: string, lang: 'fr' | 'en'): string {
  const m = parseInt(key.slice(5), 10) - 1;
  const y = key.slice(0, 4);
  if (lang === 'en') {
    const en = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    return `${en[m] || ''} ${y}`;
  }
  return `${MONTH_LABELS_FR[m] || ''} ${y}`;
}

function fmtUsd(v: number): string {
  const sign = v < 0 ? '-' : '';
  return `${sign}$${Math.abs(Math.round(v)).toLocaleString('en-US')}`;
}

function fmtSignedR(v: number): string {
  return `${v >= 0 ? '+' : ''}${v.toFixed(1)}R`;
}

interface PillarBarProps {
  label: string;
  value: number;
  max: number;
}

function PillarBar({ label, value, max }: PillarBarProps) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  return (
    <div>
      <div className="mb-1 flex items-baseline justify-between">
        <span className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
        <span className="text-[11px] font-semibold text-slate-700">
          {value}/{max}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
        <div className="h-full rounded-full bg-sky-600" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function RapportClient() {
  const [authed, setAuthed] = useState(false);
  const [dataLoading, setDataLoading] = useState(true);
  const [language, setLanguage] = useState<'fr' | 'en'>('fr');
  const [trades, setTrades] = useState<TradeLike[]>([]);
  const [profile, setProfile] = useState<RiskProfileInput | null>(null);
  const [month, setMonth] = useState<string>(currentMonthKey());

  const fr = language === 'fr';

  // ── Authentification : /api/auth/me → /login si non connecté ──
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          // Redirection dure intentionnelle (purge complète de l'état client)
          // eslint-disable-next-line @next/next/no-location-assign-relative-destination
          window.location.href = '/login';
          return;
        }
        const data = await res.json();
        if (!alive) return;
        setLanguage(data?.user?.language === 'en' ? 'en' : 'fr');
        setAuthed(true);
      } catch {
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = '/login';
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  // ── Données : trades + profil de risque (optionnel) ──
  useEffect(() => {
    if (!authed) return;
    let alive = true;
    (async () => {
      setDataLoading(true);
      const [tradesRes, profileRes] = await Promise.all([
        fetch('/api/trades'),
        fetch('/api/risk-profile').catch(() => null),
      ]);
      if (!alive) return;
      if (tradesRes.ok) {
        const d = await tradesRes.json();
        setTrades((d.trades || []) as TradeLike[]);
      }
      if (profileRes && profileRes.ok) {
        const d = await profileRes.json();
        const p = d?.profile ?? null;
        if (p && typeof p.initialCapital === 'number') {
          setProfile(p as RiskProfileInput);
        }
      }
      setDataLoading(false);
    })();
    return () => {
      alive = false;
    };
  }, [authed]);

  // ── Date de génération (rendu client uniquement : l'article n'est pas SSR) ──
  const generatedAt = useMemo(() => {
    const n = new Date();
    const locale = fr ? 'fr-FR' : 'en-GB';
    return `${n.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })} — ${n.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}`;
  }, [fr]);

  // ── Mois disponibles (trades + mois courant), max 18 ──
  const monthOptions = useMemo(() => {
    const keys = new Set<string>([currentMonthKey()]);
    for (const t of trades) {
      const d = t.date instanceof Date ? t.date : new Date(t.date);
      keys.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    }
    return [...keys].sort().reverse().slice(0, 18);
  }, [trades]);

  const year = parseInt(month.slice(0, 4), 10) || new Date().getFullYear();
  const monthNum = parseInt(month.slice(5), 10) || new Date().getMonth() + 1;

  const monthTrades = useMemo(
    () =>
      trades.filter((t) => {
        const d = t.date instanceof Date ? t.date : new Date(t.date);
        return d.getFullYear() === year && d.getMonth() === monthNum - 1;
      }),
    [trades, year, monthNum]
  );

  const summary = useMemo(
    () => monthSummary(trades, year, monthNum),
    [trades, year, monthNum]
  );
  const core: ReturnType<typeof computeCoreStats> = summary;
  const score = useMemo(() => computeDoncielScore(monthTrades), [monthTrades]);
  const violations: ViolationsReport | null = useMemo(
    () => (profile ? computeViolations(monthTrades, profile) : null),
    [profile, monthTrades]
  );

  const days = useMemo(() => buildCalendarMonth(trades, year, monthNum), [trades, year, monthNum]);

  // Semaines en lignes (lundi → dimanche)
  const weeks = useMemo(() => {
    const rows: (CalendarDay | null)[][] = [];
    let row: (CalendarDay | null)[] = Array<null>(Math.max(0, (days[0]?.weekday ?? 1) - 1)).fill(null);
    for (const d of days) {
      row.push(d);
      if (row.length === 7) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length > 0) {
      while (row.length < 7) row.push(null);
      rows.push(row);
    }
    return rows;
  }, [days]);

  const topWins = useMemo(
    () =>
      [...monthTrades]
        .filter((t) => (t.rr ?? 0) > 0)
        .sort((a, b) => (b.rr ?? 0) - (a.rr ?? 0))
        .slice(0, 3),
    [monthTrades]
  );
  const topLosses = useMemo(
    () =>
      [...monthTrades]
        .filter((t) => (t.rr ?? 0) < 0)
        .sort((a, b) => (a.rr ?? 0) - (b.rr ?? 0))
        .slice(0, 3),
    [monthTrades]
  );

  const fmtDay = (d: Date) =>
    d.toLocaleDateString(fr ? 'fr-FR' : 'en-GB', { day: '2-digit', month: '2-digit' });

  const kpis: { label: string; value: string; tone?: 'pos' | 'neg' }[] = [
    { label: fr ? 'R total' : 'Total R', value: fmtSignedR(core.totalRR), tone: core.totalRR >= 0 ? 'pos' : 'neg' },
    { label: fr ? 'P&L net' : 'Net P&L', value: fmtUsd(core.totalPnL), tone: core.totalPnL >= 0 ? 'pos' : 'neg' },
    { label: fr ? 'Win rate' : 'Win rate', value: `${core.winRate}%` },
    { label: fr ? 'Profit factor' : 'Profit factor', value: core.profitFactor >= 999 ? '∞' : core.profitFactor.toFixed(2) },
    {
      label: fr ? 'Séries max (W/L)' : 'Max streaks (W/L)',
      value: `${core.maxWinStreak} / ${core.maxLossStreak}`,
    },
    { label: fr ? 'Drawdown max' : 'Max drawdown', value: `${core.maxDrawdownR.toFixed(1)}R (${core.maxDrawdownPct}%)`, tone: 'neg' },
    {
      label: fr ? 'Jours tradés' : 'Trading days',
      value: `${summary.tradingDays} (${summary.greenDays}↑ / ${summary.redDays}↓)`,
    },
    { label: fr ? 'Trades' : 'Trades', value: `${core.totalTrades}` },
  ];

  const pillars: { label: string; value: number; max: number }[] = [
    { label: fr ? 'Discipline' : 'Discipline', value: score.pillars.discipline, max: 30 },
    { label: fr ? 'Régularité' : 'Consistency', value: score.pillars.consistency, max: 20 },
    { label: fr ? 'Risque' : 'Risk', value: score.pillars.risk, max: 20 },
    { label: fr ? 'Performance' : 'Performance', value: score.pillars.performance, max: 20 },
    { label: fr ? 'Journaling' : 'Journaling', value: score.pillars.journaling, max: 10 },
  ];

  return (
    <div className="min-h-screen bg-background">
      <style>{PRINT_CSS}</style>

      {/* ── Barre d'actions (masquée à l'impression) ── */}
      <header className="no-print sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur">
        <div className="mx-auto flex max-w-4xl flex-wrap items-center gap-2 px-3 py-2.5 sm:px-4">
          <Button asChild variant="ghost" className="h-11 gap-2 px-3">
            <Link href="/app">
              <ArrowLeft className="size-4" />
              <span className="hidden sm:inline">{fr ? 'Retour' : 'Back'}</span>
            </Link>
          </Button>
          <h1 className="font-serif text-base font-semibold tracking-tight sm:text-lg">
            {fr ? 'Rapport mensuel' : 'Monthly report'}
          </h1>
          <div className="ml-auto flex items-center gap-2">
            <Select value={month} onValueChange={setMonth}>
              <SelectTrigger className="h-11 w-[150px] sm:w-[180px]" aria-label={fr ? 'Choisir le mois' : 'Pick a month'}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {monthOptions.map((key) => (
                  <SelectItem key={key} value={key}>
                    {monthLabel(key, language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => window.print()}
              className="h-11 gap-2 bg-sky-500 text-white hover:bg-sky-600"
            >
              <Printer className="size-4" />
              <span className="hidden md:inline">
                {fr ? 'Imprimer / Enregistrer en PDF' : 'Print / Save as PDF'}
              </span>
              <span className="md:hidden">PDF</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-2 py-6 sm:px-4">
        {dataLoading ? (
          <div className="space-y-4" aria-busy="true" aria-live="polite">
            <Skeleton className="mx-auto h-16 w-full max-w-3xl rounded-xl" />
            <Skeleton className="mx-auto h-40 w-full max-w-3xl rounded-xl" />
            <Skeleton className="mx-auto h-64 w-full max-w-3xl rounded-xl" />
            <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {fr ? 'Chargement du rapport…' : 'Loading report…'}
            </div>
          </div>
        ) : (
          <article className="print-report mx-auto w-full max-w-3xl space-y-6 rounded-xl border border-border bg-white p-5 text-slate-900 shadow-xl sm:p-8">
            {/* ── En-tête ── */}
            <header className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-serif text-2xl font-bold tracking-tight">
                  DONCIEL<span className="align-super text-xs">™</span>
                </p>
                <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-slate-500">
                  {fr ? 'Journal de Trading' : 'Trading Journal'}
                </p>
              </div>
              <div className="text-right">
                <p className="font-serif text-xl font-semibold text-sky-700">
                  {monthLabel(month, language)}
                </p>
                <p className="text-[11px] text-slate-500">
                  {fr ? 'Rapport mensuel de performance' : 'Monthly performance report'}
                </p>
              </div>
            </header>
            <div className="h-1 w-full rounded-full bg-gradient-to-r from-sky-700 via-sky-500 to-blue-600" />

            {monthTrades.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <CalendarDays className="size-10 text-slate-300" />
                <p className="text-sm font-medium text-slate-500">
                  {fr ? 'Aucun trade ce mois-ci.' : 'No trades this month.'}
                </p>
              </div>
            ) : (
              <>
                {/* ── Stats clés ── */}
                <section>
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {fr ? 'Statistiques clés' : 'Key statistics'}
                  </h2>
                  <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                    {kpis.map((k) => (
                      <div key={k.label} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                        <p className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{k.label}</p>
                        <p
                          className={`mt-0.5 text-lg font-bold tabular-nums ${
                            k.tone === 'pos' ? 'text-emerald-600' : k.tone === 'neg' ? 'text-red-600' : 'text-slate-900'
                          }`}
                        >
                          {k.value}
                        </p>
                      </div>
                    ))}
                  </div>
                </section>

                {/* ── Score DONCIEL ── */}
                <section className="rounded-lg border border-sky-200 bg-sky-50/60 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                      {fr ? 'Score DONCIEL (discipline)' : 'DONCIEL Score (discipline)'}
                    </h2>
                    <span className="rounded-full border border-sky-300 bg-white px-3 py-1 text-sm font-bold text-sky-700">
                      {score.total}/100 — {fr ? 'Grade' : 'Grade'} {score.grade}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-5 gap-y-2.5 sm:grid-cols-5">
                    {pillars.map((p) => (
                      <PillarBar key={p.label} label={p.label} value={p.value} max={p.max} />
                    ))}
                  </div>
                </section>

                {/* ── Calendrier du mois ── */}
                <section>
                  <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    {fr ? 'Calendrier P&L' : 'P&L Calendar'}
                  </h2>
                  <table className="w-full table-fixed border-collapse">
                    <thead>
                      <tr>
                        {DAY_LABELS_FR.map((d) => (
                          <th
                            key={d}
                            className="border border-slate-200 bg-slate-50 py-1 text-[10px] font-semibold uppercase text-slate-500"
                          >
                            {d}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {weeks.map((week, wi) => (
                        <tr key={wi}>
                          {week.map((day: CalendarDay | null, di: number) => (
                            <td
                              key={di}
                              className="h-12 border border-slate-200 px-1 py-0.5 align-top sm:h-14"
                            >
                              {day ? (
                                <div className="flex h-full flex-col justify-between">
                                  <span className="text-[9px] font-medium text-slate-400">{day.dayOfMonth}</span>
                                  {day.count > 0 ? (
                                    <span
                                      className={`text-right text-[10px] font-bold leading-none tabular-nums sm:text-[11px] ${
                                        day.pnl > 0
                                          ? 'text-emerald-600'
                                          : day.pnl < 0
                                            ? 'text-red-600'
                                            : 'text-slate-500'
                                      }`}
                                    >
                                      {day.pnl === 0 ? 'BE' : fmtUsd(day.pnl)}
                                    </span>
                                  ) : (
                                    <span className="text-right text-[10px] leading-none text-slate-300">—</span>
                                  )}
                                </div>
                              ) : null}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>

                {/* ── Top wins / Top losses ── */}
                <section className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {[
                    {
                      title: fr ? 'Top 3 gains' : 'Top 3 wins',
                      rows: topWins,
                      tone: 'text-emerald-600',
                    },
                    {
                      title: fr ? 'Top 3 pertes' : 'Top 3 losses',
                      rows: topLosses,
                      tone: 'text-red-600',
                    },
                  ].map((block) => (
                    <div key={block.title} className="rounded-lg border border-slate-200">
                      <p className={`border-b border-slate-200 px-3 py-2 text-xs font-bold uppercase tracking-wide ${block.tone}`}>
                        {block.title}
                      </p>
                      {block.rows.length === 0 ? (
                        <p className="px-3 py-3 text-xs text-slate-400">
                          {fr ? 'Aucun trade concerné ce mois-ci.' : 'No relevant trades this month.'}
                        </p>
                      ) : (
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-left text-[10px] uppercase text-slate-400">
                              <th className="px-3 py-1.5 font-medium">{fr ? 'Paire' : 'Pair'}</th>
                              <th className="px-2 py-1.5 font-medium">{fr ? 'Date' : 'Date'}</th>
                              <th className="px-2 py-1.5 text-right font-medium">R</th>
                              <th className="px-3 py-1.5 text-right font-medium">P&L</th>
                            </tr>
                          </thead>
                          <tbody>
                            {block.rows.map((t) => {
                              const d = t.date instanceof Date ? t.date : new Date(t.date);
                              return (
                                <tr key={t.id} className="border-t border-slate-100">
                                  <td className="px-3 py-1.5 font-semibold">{t.pair}</td>
                                  <td className="px-2 py-1.5 text-slate-500">{fmtDay(d)}</td>
                                  <td className={`px-2 py-1.5 text-right font-bold tabular-nums ${block.tone}`}>
                                    {fmtSignedR(t.rr ?? 0)}
                                  </td>
                                  <td className={`px-3 py-1.5 text-right font-semibold tabular-nums ${block.tone}`}>
                                    {fmtUsd(t.pnl ?? 0)}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      )}
                    </div>
                  ))}
                </section>

                {/* ── Violations de risque ── */}
                <section className="rounded-lg border border-slate-200 p-4">
                  <h2 className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-slate-500">
                    <ShieldAlert className="size-3.5" />
                    {fr ? 'Respect des règles de risque' : 'Risk rules compliance'}
                  </h2>
                  {violations ? (
                    <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase text-slate-500">{fr ? 'Violations' : 'Violations'}</p>
                        <p className={`text-base font-bold ${violations.totalViolations > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                          {violations.totalViolations}
                        </p>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase text-slate-500">{fr ? 'Pertes jour > limite' : 'Daily loss breaches'}</p>
                        <p className="text-base font-bold text-slate-900">{violations.dailyLossViolations.length}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase text-slate-500">{fr ? 'Sur-risque' : 'Over-risk trades'}</p>
                        <p className="text-base font-bold text-slate-900">{violations.overRiskTrades.length}</p>
                      </div>
                      <div className="rounded-md bg-slate-50 px-3 py-2">
                        <p className="text-[10px] uppercase text-slate-500">{fr ? 'Série propre' : 'Clean streak'}</p>
                        <p className="text-base font-bold text-emerald-600">
                          {violations.cleanStreakDays} {fr ? 'j' : 'd'}
                        </p>
                      </div>
                      {violations.overtradingDays.length > 0 && (
                        <p className="col-span-2 text-[11px] text-slate-500 sm:col-span-4">
                          {fr ? 'Jours de surtrading : ' : 'Overtrading days: '}
                          {violations.overtradingDays.map((o) => o.dateISO).join(', ')}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-xs text-slate-500">
                      {fr
                        ? 'Configure un profil de risque dans l’onglet Discipline pour suivre tes violations ici.'
                        : 'Set up a risk profile in the Discipline tab to track your violations here.'}
                    </p>
                  )}
                </section>
              </>
            )}

            {/* ── Pied de rapport ── */}
            <footer className="border-t border-slate-200 pt-3">
              <p className="text-[10px] leading-relaxed text-slate-400">
                {fr
                  ? 'Avertissement : le trading comporte un risque élevé de perte en capital. Les performances passées ne préjugent pas des performances futures. Ce rapport est fourni à titre informatif et ne constitue pas un conseil en investissement.'
                  : 'Disclaimer: trading involves a high level of risk. Past performance is not indicative of future results. This report is for informational purposes only and does not constitute investment advice.'}
              </p>
              <p className="mt-1.5 flex flex-wrap items-center justify-between gap-1 text-[10px] font-medium text-slate-500">
                <span>donciel-trading.vercel.app</span>
                <span>
                  {fr ? 'Généré le ' : 'Generated on '}
                  {generatedAt || '—'}
                </span>
              </p>
            </footer>
          </article>
        )}
      </main>
    </div>
  );
}
