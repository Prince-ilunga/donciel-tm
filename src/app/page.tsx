import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";
import { PLANS } from "@/lib/plans";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target,
  BarChart3,
  Brain,
  BookOpen,
  Wallet,
  Newspaper,
  Check,
  Shield,
  Sparkles,
  TrendingUp,
  ChevronDown,
  ArrowRight,
  PenLine,
  LineChart,
  Gem,
  Activity,
} from "lucide-react";

/* ────────────────────────────────────────────────────────────
   DONnées (inchangées — source de vérité métier)
   ──────────────────────────────────────────────────────────── */

const FEATURES = [
  {
    icon: Target,
    title: "Journal de trading complet",
    description:
      "Chaque trade documenté : session, structure, modèle d'entrée, émotions, screenshots. Rien ne se perd, tout s'analyse.",
  },
  {
    icon: BarChart3,
    title: "Statistiques de pro",
    description:
      "Win rate, expectancy, distribution RR, analyse par paire, session et setup. Tes edges deviennent visibles, tes fuites aussi.",
  },
  {
    icon: Brain,
    title: "Coach IA intégré",
    description:
      "Une IA entraînée sur TES données qui détecte tes erreurs récurrentes et te donne des axes concrets de progression.",
  },
  {
    icon: BookOpen,
    title: "Playbooks structurés",
    description:
      "Tes setups codifiés : règles d'entrée, de sortie, checklist. Tu trades ton plan, pas tes émotions.",
  },
  {
    icon: Wallet,
    title: "Money management",
    description:
      "10 paliers de capital éditables + calculateur de lot intégré. La croissance de ton compte devient mécanique.",
  },
  {
    icon: Newspaper,
    title: "Market data & briefings",
    description:
      "Calendrier économique, sentiment de marché et briefings quotidiens pour préparer tes sessions comme un fund.",
  },
];

const STATS = [
  { value: "100 %", label: "de tes trades centralisés" },
  { value: "10", label: "paliers de money management" },
  { value: "24/7", label: "Coach IA disponible" },
  { value: "FR / EN", label: "interface bilingue" },
];

const STEPS = [
  {
    n: "01",
    icon: PenLine,
    title: "Journalise",
    description:
      "Enregistre chaque trade en moins de 60 secondes : contexte, exécution, émotion. Le rituel des traders disciplinés.",
  },
  {
    n: "02",
    icon: LineChart,
    title: "Analyse",
    description:
      "Tes statistiques révèlent tes vrais edge et tes fuites de performance, session par session, setup par setup.",
  },
  {
    n: "03",
    icon: Gem,
    title: "Progresse",
    description:
      "Le Coach IA transforme ton historique en plan d'action concret. Ton capital grandit par paliers, sans improvisation.",
  },
];

const FAQ = [
  {
    q: "DONCIEL TM convient-il à mon style de trading ?",
    a: "Le journal est conçu pour le trading intraday et swing (Forex, indices, métaux, crypto). Les sessions London / New York / Asie, les structures et les modèles d'entrée sont paramétrables selon TA méthode.",
  },
  {
    q: "Puis-je exporter mes données ?",
    a: "Oui. À partir du plan Pro, tu exportes ton journal complet en PDF professionnel. Tes données t'appartiennent et restent supprimables à tout moment.",
  },
  {
    q: "Le Coach IA remplace-t-il un mentor ?",
    a: "Non — il l'accélère. Le Coach IA analyse tes performances réelles (pas des généralités) pour identifier tes patterns d'erreurs : le mentorat humain reste complémentaire.",
  },
  {
    q: "Est-ce que mes données sont en sécurité ?",
    a: "Tes données sont chiffrées en transit et au repos, isolées par compte, et hébergées sur une infrastructure cloud conforme aux standards du secteur. Nous ne partageons rien avec des tiers.",
  },
  {
    q: "Comment fonctionne l'essai du plan gratuit ?",
    a: "Le plan Découverte est gratuit pour toujours : 30 trades par mois, 2 playbooks et 5 analyses IA pour tester la méthode complète avant de passer au plan Pro.",
  },
];

const INSTRUMENTS = [
  "EUR/USD", "XAU/USD", "GBP/JPY", "NAS100", "US30",
  "BTC/USD", "ETH/USD", "GBP/USD", "GER40", "USD/CHF",
];

/* Barres décoratives (distribution RR) — valeurs fixes, SSR-safe */
const RR_BARS = [34, 58, 46, 72, 61, 88, 100, 76];

/* ────────────────────────────────────────────────────────────
   Sous-composants
   ──────────────────────────────────────────────────────────── */

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: React.ReactNode; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-14">
      <div className="relative inline-block mb-5">
        <Badge variant="outline" className="relative overflow-hidden border-sky-300/30 bg-sky-300/[0.06] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-sky-200/90">
          <span className="absolute inset-0 dct-anim-shimmer motion-reduce:animate-none" aria-hidden />
          {eyebrow}
        </Badge>
      </div>
      <h2 className="text-3xl sm:text-[2.6rem] leading-[1.12] font-bold text-white tracking-tight">{title}</h2>
      {subtitle && <p className="mt-4 text-neutral-400 text-lg leading-relaxed">{subtitle}</p>}
    </div>
  );
}

/* Courbe d'équité décorative (SVG statique) */
function EquityCurve() {
  return (
    <svg viewBox="0 0 420 150" className="w-full h-full" preserveAspectRatio="none" aria-hidden>
      <defs>
        <linearGradient id="dct-eq-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#38bdf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#38bdf8" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="dct-eq-line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3b82f6" />
          <stop offset="55%" stopColor="#7dd3fc" />
          <stop offset="100%" stopColor="#38bdf8" />
        </linearGradient>
      </defs>
      {[30, 65, 100, 135].map((y) => (
        <line key={y} x1="0" y1={y} x2="420" y2={y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
      ))}
      <path
        d="M0,122 C28,116 44,104 68,106 S114,84 142,88 S196,62 224,66 S286,40 316,44 S372,22 420,18 L420,150 L0,150 Z"
        fill="url(#dct-eq-fill)"
      />
      <path
        d="M0,122 C28,116 44,104 68,106 S114,84 142,88 S196,62 224,66 S286,40 316,44 S372,22 420,18"
        fill="none"
        stroke="url(#dct-eq-line)"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
      <circle cx="420" cy="18" r="4" fill="#7dd3fc" />
      <circle cx="420" cy="18" r="8" fill="#7dd3fc" opacity="0.25" className="dct-anim-ping motion-reduce:animate-none" />
    </svg>
  );
}

/* Mock du tableau de bord (vitrine hero) */
function DashboardMock() {
  return (
    <div className="relative mt-16 sm:mt-20 max-w-4xl mx-auto">
      {/* Halo sous la vitrine */}
      <div className="absolute -inset-x-8 top-10 bottom-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.16),transparent_65%)] blur-2xl" aria-hidden />

      <div className="relative dct-border-sapphire rounded-[22px] motion-reduce:animate-none">
        <div className="rounded-[21px] bg-[#0b0a08]/95 backdrop-blur-xl overflow-hidden">
          {/* Barre de fenêtre */}
          <div className="flex items-center gap-2 px-5 h-11 border-b border-white/[0.06] bg-white/[0.02]">
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-white/15" />
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400/60" />
            <div className="ml-3 flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-neutral-500">
              DONCIEL<span className="text-sky-400/80">™</span>
              <span className="text-neutral-700">·</span>
              <span className="text-neutral-400">Session New York</span>
            </div>
            <div className="ml-auto flex items-center gap-1.5 text-[10px] text-emerald-400/90">
              <span className="relative flex w-1.5 h-1.5">
                <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 dct-anim-ping motion-reduce:animate-none" />
                <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
              </span>
              LIVE
            </div>
          </div>

          <div className="grid md:grid-cols-[1.6fr_1fr] gap-4 p-5">
            {/* Courbe d'équité */}
            <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-neutral-500 uppercase tracking-widest">Courbe d&apos;équité</span>
                <span className="text-xs font-semibold text-emerald-400 tabular-nums">+12.4R · 30j</span>
              </div>
              <div className="h-36">
                <EquityCurve />
              </div>
            </div>

            {/* Chips de stats */}
            <div className="grid grid-cols-2 md:grid-cols-1 gap-3 content-start">
              {[
                { label: "Win rate", value: "61.2 %", tone: "text-emerald-400" },
                { label: "Facteur de profit", value: "2.14", tone: "text-sky-300" },
                { label: "Expectancy", value: "0.42R", tone: "text-sky-300" },
                { label: "Palier capital", value: "6 / 10", tone: "text-white" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-4 py-3">
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">{s.label}</div>
                  <div className={`mt-0.5 text-lg font-bold tabular-nums ${s.tone}`}>{s.value}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Chip flottante — Coach IA */}
      <div className="absolute -top-6 -right-3 sm:right-[-2.5rem] dct-anim-float motion-reduce:animate-none hidden sm:block">
        <div className="dct-border-sapphire rounded-2xl">
          <div className="flex items-center gap-3 rounded-2xl bg-[#0b0a08] px-4 py-3 backdrop-blur-xl">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-300/25 to-blue-600/10 border border-sky-300/25 flex items-center justify-center">
              <Brain className="w-4.5 h-4.5 text-sky-300" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-white">Coach IA</div>
              <div className="text-[11px] text-neutral-400">Entrées tardives détectées · London</div>
            </div>
          </div>
        </div>
      </div>

      {/* Chip flottante — Palier */}
      <div className="absolute -bottom-6 left-[-2rem] dct-anim-float-late motion-reduce:animate-none hidden sm:block">
        <div className="dct-border-hairline rounded-2xl">
          <div className="flex items-center gap-3 rounded-2xl bg-[#0b0a08] px-4 py-3 backdrop-blur-xl">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-400/20 to-emerald-600/5 border border-emerald-300/25 flex items-center justify-center">
              <TrendingUp className="w-4.5 h-4.5 text-emerald-300" />
            </div>
            <div>
              <div className="text-[11px] font-semibold text-white">Palier 6 → 7 validé</div>
              <div className="text-[11px] text-emerald-400/90">+8.4 % de capital ce mois</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────────────────────
   Page
   ──────────────────────────────────────────────────────────── */

export default function LandingPage() {
  const pro = PLANS.PRO;
  const elite = PLANS.ELITE;

  return (
    <div className="min-h-screen bg-[#04060a] text-neutral-200 flex flex-col overflow-x-clip">
      <LandingNav />

      {/* ═══ HERO ═══ */}
      <section className="relative pt-36 pb-28 px-4 sm:px-6 overflow-hidden">
        {/* Lueurs d'ambiance */}
        <div className="absolute inset-0" aria-hidden>
          <div className="absolute -top-40 left-1/2 -translate-x-1/2 w-[900px] h-[520px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.13),transparent_60%)] dct-anim-aurora motion-reduce:animate-none" />
          <div className="absolute top-[420px] -left-40 w-[560px] h-[560px] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.05),transparent_65%)] dct-anim-aurora-slow motion-reduce:animate-none" />
          <div className="absolute top-[220px] -right-52 w-[620px] h-[620px] rounded-full bg-[radial-gradient(circle_at_center,rgba(56,189,248,0.06),transparent_65%)] dct-anim-aurora motion-reduce:animate-none" />
        </div>
        <div className="absolute inset-0 dct-grid" aria-hidden />
        <div className="absolute inset-0 dct-noise pointer-events-none" aria-hidden />

        <div className="relative max-w-4xl mx-auto text-center">
          <div className="relative inline-block mb-7">
            <Badge className="relative overflow-hidden bg-sky-300/[0.07] text-sky-200 border border-sky-300/25 px-4 py-1.5 text-xs tracking-wide hover:bg-sky-300/[0.12]">
              <span className="absolute inset-0 dct-anim-shimmer motion-reduce:animate-none" aria-hidden />
              <Sparkles className="w-3.5 h-3.5 mr-1.5 text-sky-300" />
              Journal de trading nouvelle génération
            </Badge>
          </div>

          <h1 className="text-[2.6rem] leading-[1.05] sm:text-6xl lg:text-7xl font-bold tracking-tight text-white">
            Ton edge existe.
            <br />
            <span className="font-display italic font-semibold dct-text-sapphire pb-2">
              Ton journal va le prouver.
            </span>
          </h1>

          <p className="mt-7 text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            DONCIEL™ transforme ton historique de trades en plan d&apos;action :
            statistiques avancées, money management par paliers et Coach IA qui
            analyse tes moindres erreurs.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Button
              asChild
              size="lg"
              className="dct-btn-glow bg-gradient-to-b from-sky-400 to-blue-600 text-white hover:from-sky-300 hover:to-blue-500 font-bold h-[52px] px-9 text-base border-0 transition-transform hover:-translate-y-0.5"
            >
              <Link href="/register" className="flex items-center gap-2">
                Créer mon compte gratuit
                <ArrowRight className="w-4 h-4" />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="h-[52px] px-9 text-base border-white/12 text-white hover:bg-white/[0.05] bg-white/[0.02] backdrop-blur"
            >
              <a href="#features">Découvrir les fonctionnalités</a>
            </Button>
          </div>
          <p className="mt-5 text-sm text-neutral-500">
            Sans carte bancaire · 30 trades/mois offerts · Résiliable en 1 clic
          </p>
        </div>

        {/* Vitrine produit */}
        <DashboardMock />

        {/* Bandeau stats */}
        <div className="relative max-w-4xl mx-auto mt-24 grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="dct-border-hairline rounded-2xl">
              <div className="rounded-2xl bg-white/[0.03] backdrop-blur-sm p-5 text-center h-full">
                <div className="text-2xl sm:text-3xl font-bold tabular-nums">
                  <span className="dct-text-sapphire">{s.value}</span>
                </div>
                <div className="mt-1 text-xs sm:text-sm text-neutral-400">{s.label}</div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ═══ BANDEAU INSTRUMENTS ═══ */}
      <section className="border-y border-white/[0.05] bg-white/[0.015] py-5 overflow-hidden dct-marquee-mask" aria-label="Instruments couverts">
        <div className="flex w-max dct-anim-marquee motion-reduce:animate-none">
          {[0, 1].map((copy) => (
            <div key={copy} className="flex items-center" aria-hidden={copy === 1}>
              {INSTRUMENTS.map((ins) => (
                <div key={`${copy}-${ins}`} className="flex items-center">
                  <span className="px-7 text-xs uppercase tracking-[0.3em] text-neutral-500 whitespace-nowrap">
                    {ins}
                  </span>
                  <span className="w-1 h-1 rotate-45 bg-sky-400/40" />
                </div>
              ))}
            </div>
          ))}
        </div>
      </section>

      {/* ═══ MÉTHODE ═══ */}
      <section className="relative py-28 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="La méthode"
            title={<>Trois rituels pour arrêter de <span className="font-display italic font-semibold dct-text-sapphire">deviner</span></>}
            subtitle="La discipline n'est pas un talent : c'est un système. DONCIEL™ l'installe pour toi."
          />
          <div className="relative grid md:grid-cols-3 gap-5">
            {/* Ligne de liaison */}
            <div className="hidden md:block absolute top-[52px] left-[16%] right-[16%] h-px bg-gradient-to-r from-transparent via-sky-400/25 to-transparent" aria-hidden />
            {STEPS.map((s) => (
              <div key={s.n} className="relative dct-border-hairline rounded-3xl group">
                <div className="rounded-3xl bg-[#070a0f] p-8 h-full transition-colors group-hover:bg-[#090d12]">
                  <div className="flex items-start justify-between">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-300/20 to-blue-600/[0.06] border border-sky-300/20 flex items-center justify-center group-hover:scale-105 transition-transform">
                      <s.icon className="w-5 h-5 text-sky-300" />
                    </div>
                    <span className="font-display italic text-4xl text-white/[0.12] font-semibold select-none">{s.n}</span>
                  </div>
                  <h3 className="mt-6 text-xl font-semibold text-white">{s.title}</h3>
                  <p className="mt-2.5 text-sm text-neutral-400 leading-relaxed">{s.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ FONCTIONNALITÉS (bento) ═══ */}
      <section id="features" className="py-28 px-4 sm:px-6 scroll-mt-16 border-t border-white/[0.05] relative">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(56,189,248,0.05),transparent_70%)]" aria-hidden />
        <div className="relative max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Fonctionnalités"
            title={<>Tout ce qu&apos;un trader sérieux attend de <span className="font-display italic font-semibold dct-text-sapphire">son journal</span></>}
            subtitle="Chaque module est pensé pour un objectif : transformer tes données en décisions meilleures."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Carte vedette — distribution RR */}
            <div className="sm:col-span-2 dct-border-hairline rounded-3xl group">
              <div className="rounded-3xl bg-[#070a0f] p-7 h-full grid sm:grid-cols-2 gap-6 items-center transition-colors group-hover:bg-[#090d12]">
                <div>
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-300/20 to-blue-600/[0.06] border border-sky-300/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <BarChart3 className="w-5 h-5 text-sky-300" />
                  </div>
                  <h3 className="font-semibold text-white text-xl">{FEATURES[1].title}</h3>
                  <p className="mt-2.5 text-sm text-neutral-400 leading-relaxed">{FEATURES[1].description}</p>
                </div>
                {/* Mini graphique distribution RR */}
                <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4" aria-hidden>
                  <div className="text-[10px] uppercase tracking-[0.16em] text-neutral-500 mb-3">Distribution RR · 90 derniers trades</div>
                  <div className="flex items-end gap-2 h-28">
                    {RR_BARS.map((h, i) => (
                      <div key={i} className="flex-1 rounded-t-md bg-gradient-to-t from-blue-600/25 to-sky-300/80" style={{ height: `${h}%`, opacity: 0.45 + (i / RR_BARS.length) * 0.55 }} />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {FEATURES.filter((_, i) => i !== 1).map((f) => (
              <div key={f.title} className="dct-border-hairline rounded-3xl group">
                <div className="rounded-3xl bg-[#070a0f] p-7 h-full transition-colors group-hover:bg-[#090d12]">
                  <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-sky-300/20 to-blue-600/[0.06] border border-sky-300/20 flex items-center justify-center mb-5 group-hover:scale-105 transition-transform">
                    <f.icon className="w-5 h-5 text-sky-300" />
                  </div>
                  <h3 className="font-semibold text-white text-lg">{f.title}</h3>
                  <p className="mt-2.5 text-sm text-neutral-400 leading-relaxed">{f.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ TARIFS ═══ */}
      <section id="pricing" className="py-28 px-4 sm:px-6 scroll-mt-16 border-t border-white/[0.05]">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Tarifs"
            title={<>Un investissement dérisoire comparé à <span className="font-display italic font-semibold dct-text-sapphire">une perte évitée</span></>}
            subtitle="Commence gratuitement. Passe au plan supérieur quand tes résultats l'exigent."
          />
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {/* DÉCOUVERTE */}
            <div className="dct-border-hairline rounded-3xl">
              <div className="rounded-3xl bg-[#070a0f] p-8 flex flex-col h-full">
                <h3 className="text-xl font-bold text-white">{PLANS.FREE.name}</h3>
                <p className="text-sm text-neutral-500 mt-1">{PLANS.FREE.tagline}</p>
                <div className="mt-6 mb-7 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white tabular-nums">0 €</span>
                  <span className="text-neutral-500 text-sm">/ pour toujours</span>
                </div>
                <ul className="space-y-3 text-sm text-neutral-300 flex-1">
                  {PLANS.FREE.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-sky-400/80 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-8 w-full border-white/12 text-white hover:bg-white/[0.05] bg-white/[0.02] h-11">
                  <Link href="/register">Commencer gratuitement</Link>
                </Button>
              </div>
            </div>

            {/* PRO */}
            <div className="relative dct-border-sapphire rounded-3xl shadow-[0_0_80px_-18px_rgba(56,189,248,0.45)] md:-translate-y-3">
              <Badge className="absolute -top-3.5 left-1/2 -translate-x-1/2 z-10 bg-gradient-to-b from-sky-300 to-blue-500 text-white font-bold border-0 hover:from-sky-300 hover:to-blue-500">
                <Gem className="w-3 h-3 mr-1" />
                Le plus choisi
              </Badge>
              <div className="rounded-3xl bg-gradient-to-b from-[#0d1220] to-[#070a0f] p-8 flex flex-col h-full">
                <h3 className="text-xl font-bold text-white">{pro.name}</h3>
                <p className="text-sm text-neutral-500 mt-1">{pro.tagline}</p>
                <div className="mt-6 mb-1 flex items-baseline gap-2">
                  <span className="text-5xl font-bold tabular-nums"><span className="dct-text-sapphire">{pro.priceMonthly} €</span></span>
                  <span className="text-neutral-500 text-sm">/ mois</span>
                </div>
                <p className="text-xs text-sky-300/80 mb-7">ou {pro.priceYearly} €/an — 2 mois offerts</p>
                <ul className="space-y-3 text-sm text-neutral-200 flex-1">
                  {pro.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-sky-300 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild className="mt-8 w-full dct-btn-glow bg-gradient-to-b from-sky-400 to-blue-600 text-white hover:from-sky-300 hover:to-blue-500 font-bold h-11 border-0">
                  <Link href="/register">Passer au plan Pro</Link>
                </Button>
              </div>
            </div>

            {/* ELITE */}
            <div className="dct-border-hairline rounded-3xl">
              <div className="rounded-3xl bg-[#070a0f] p-8 flex flex-col h-full">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">{elite.name}</h3>
                  <Activity className="w-4 h-4 text-neutral-600" />
                </div>
                <p className="text-sm text-neutral-500 mt-1">{elite.tagline}</p>
                <div className="mt-6 mb-1 flex items-baseline gap-2">
                  <span className="text-4xl font-bold text-white tabular-nums">{elite.priceMonthly} €</span>
                  <span className="text-neutral-500 text-sm">/ mois</span>
                </div>
                <p className="text-xs text-neutral-600 mb-7">ou {elite.priceYearly} €/an — 2 mois offerts</p>
                <ul className="space-y-3 text-sm text-neutral-300 flex-1">
                  {elite.features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5">
                      <Check className="w-4 h-4 text-sky-400/80 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <Button asChild variant="outline" className="mt-8 w-full border-sky-300/30 text-sky-200 hover:bg-sky-300/[0.07] bg-transparent h-11 font-semibold">
                  <Link href="/register">Devenir Elite</Link>
                </Button>
              </div>
            </div>
          </div>
          <p className="text-center text-xs text-neutral-500 mt-10">
            Paiement sécurisé par carte (Paddle) · Mobile Money : M-Pesa, Airtel &amp; Orange · TVA applicable selon ton pays · Annulation en 1 clic
          </p>
        </div>
      </section>

      {/* ═══ FAQ ═══ */}
      <section id="faq" className="py-28 px-4 sm:px-6 scroll-mt-16 border-t border-white/[0.05]">
        <div className="max-w-3xl mx-auto">
          <SectionHeading eyebrow="FAQ" title={<>Les questions <span className="font-display italic font-semibold dct-text-sapphire">qu&apos;on nous pose</span></>} />
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group dct-border-hairline rounded-2xl overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 font-medium text-white bg-white/[0.02] hover:bg-white/[0.045] transition-colors rounded-2xl">
                  {item.q}
                  <span className="w-7 h-7 rounded-full border border-white/10 flex items-center justify-center shrink-0 group-open:border-sky-300/40 transition-colors">
                    <ChevronDown className="w-3.5 h-3.5 text-neutral-400 group-open:text-sky-300 group-open:rotate-180 transition-transform" />
                  </span>
                </summary>
                <p className="px-5 pb-5 pt-1 text-sm text-neutral-400 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ═══ CTA FINAL ═══ */}
      <section className="py-28 px-4 sm:px-6 border-t border-white/[0.05] relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.09),transparent_60%)]" aria-hidden />
        <div className="relative max-w-3xl mx-auto dct-border-sapphire rounded-[28px]">
          <div className="relative rounded-[27px] bg-gradient-to-b from-[#0a1016] to-[#070a0c] px-6 sm:px-14 py-16 text-center overflow-hidden">
            <div className="absolute inset-0 dct-noise" aria-hidden />
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[520px] h-[280px] bg-[radial-gradient(ellipse_at_center,rgba(56,189,248,0.14),transparent_65%)]" aria-hidden />
            <div className="relative">
              <Sparkles className="w-5 h-5 text-sky-300 mx-auto mb-5" aria-hidden />
              <h2 className="text-3xl sm:text-[2.6rem] leading-[1.15] font-bold text-white">
                Le meilleur moment pour commencer, c&apos;est{" "}
                <span className="font-display italic font-semibold dct-text-sapphire">ton prochain trade</span>.
              </h2>
              <p className="mt-5 text-neutral-400 text-lg">
                Rejoins les traders qui arrêtent de deviner et commencent à mesurer.
              </p>
              <Button
                asChild
                size="lg"
                className="mt-9 dct-btn-glow bg-gradient-to-b from-sky-400 to-blue-600 text-white hover:from-sky-300 hover:to-blue-500 font-bold h-[52px] px-10 text-base border-0 transition-transform hover:-translate-y-0.5"
              >
                <Link href="/register" className="flex items-center gap-2">
                  Créer mon compte gratuit
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </Button>
              <p className="mt-4 text-xs text-neutral-500">Installation en 60 secondes · Données chiffrées</p>
            </div>
          </div>
        </div>
      </section>

      {/* ═══ FOOTER ═══ */}
      <footer className="mt-auto border-t border-white/[0.07] bg-[#05070a]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-14">
          <div className="grid sm:grid-cols-3 gap-10">
            <div>
              <span className="text-lg font-bold tracking-tight">
                <span className="text-white">DONCIEL</span><span className="dct-text-sapphire">™</span>
              </span>
              <p className="mt-3 text-sm text-neutral-500 leading-relaxed">
                Journal de trading professionnel pensé par des traders, pour des traders.
              </p>
              <div className="mt-5 flex items-center gap-2 text-[11px] uppercase tracking-[0.18em] text-neutral-600">
                <Shield className="w-3.5 h-3.5 text-sky-400/50" />
                Données chiffrées · Infrastructure sécurisée
              </div>
            </div>
            <div className="text-sm">
              <h4 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.16em] text-neutral-300">Produit</h4>
              <ul className="space-y-2.5 text-neutral-500">
                <li><a href="#features" className="hover:text-sky-200 transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-sky-200 transition-colors">Tarifs</a></li>
                <li><Link href="/login" className="hover:text-sky-200 transition-colors">Se connecter</Link></li>
                <li><Link href="/register" className="hover:text-sky-200 transition-colors">Créer un compte</Link></li>
              </ul>
            </div>
            <div className="text-sm">
              <h4 className="font-semibold text-white mb-4 text-xs uppercase tracking-[0.16em] text-neutral-300">Légal</h4>
              <ul className="space-y-2.5 text-neutral-500">
                <li><Link href="/legal" className="hover:text-sky-200 transition-colors">Mentions légales &amp; CGU</Link></li>
                <li><Link href="/legal#confidentialite" className="hover:text-sky-200 transition-colors">Confidentialité</Link></li>
                <li><Link href="/legal#risques" className="hover:text-sky-200 transition-colors">Avertissement sur les risques</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-7 border-t border-white/[0.05] space-y-3">
            <p className="text-xs leading-relaxed text-neutral-600">
              <Shield className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              <strong className="text-neutral-500">Avertissement sur les risques :</strong> le trading
              de instruments financiers et de crypto-actifs comporte un risque élevé de perte en
              capital. DONCIEL TM est un outil de journalisation et d&apos;analyse et ne fournit
              aucun conseil en investissement. Les performances passées ne préjugent pas des
              performances futures. Tu restes seul(e) responsable de tes décisions de trading.
            </p>
            <p className="text-xs text-neutral-700">
              © {new Date().getFullYear()} DONCIEL TM. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
