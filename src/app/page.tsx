import Link from "next/link";
import { LandingNav } from "@/components/landing/landing-nav";
import { PLANS, PLAN_ORDER } from "@/lib/plans";
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
  Clock,
  Video,
  TrendingUp,
  ChevronDown,
} from "lucide-react";

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

function SectionHeading({ eyebrow, title, subtitle }: { eyebrow: string; title: string; subtitle?: string }) {
  return (
    <div className="text-center max-w-2xl mx-auto mb-12">
      <Badge variant="outline" className="mb-4 border-amber-400/40 text-amber-400 bg-amber-400/5">
        {eyebrow}
      </Badge>
      <h2 className="text-3xl sm:text-4xl font-bold text-white tracking-tight">{title}</h2>
      {subtitle && <p className="mt-3 text-neutral-400 text-lg">{subtitle}</p>}
    </div>
  );
}

export default function LandingPage() {
  const pro = PLANS.PRO;
  const elite = PLANS.ELITE;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 flex flex-col">
      <LandingNav />

      {/* ─── HERO ─────────────────────────────────────────── */}
      <section className="relative pt-36 pb-24 px-4 sm:px-6 overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(251,191,36,0.08),transparent_55%)]" />
        <div className="relative max-w-4xl mx-auto text-center">
          <Badge className="mb-6 hidden sm:inline-flex bg-amber-400/10 text-amber-400 border border-amber-400/30 hover:bg-amber-400/15">
            <TrendingUp className="w-3.5 h-3.5 mr-1.5" />
            Le journal des traders qui veulent passer au niveau supérieur
          </Badge>
          <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-white leading-[1.1]">
            Ton edge existe.
            <br />
            <span className="text-amber-400">Ton journal va le prouver.</span>
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-neutral-400 max-w-2xl mx-auto leading-relaxed">
            DONCIEL™ transforme ton historique de trades en plan d&apos;action :
            statistiques avancées, money management par paliers et Coach IA qui
            analyse tes moindres erreurs.
          </p>
          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" className="bg-amber-400 text-black hover:bg-amber-300 font-bold h-12 px-8 text-base">
              <Link href="/register">Créer mon compte gratuit</Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="h-12 px-8 text-base border-white/15 text-white hover:bg-white/5 bg-transparent">
              <a href="#features">Découvrir les fonctionnalités</a>
            </Button>
          </div>
          <p className="mt-4 text-sm text-neutral-500">
            Sans carte bancaire · 30 trades/mois offerts · Résiliable en 1 clic
          </p>
        </div>

        {/* Stats band */}
        <div className="relative max-w-4xl mx-auto mt-20 grid grid-cols-2 md:grid-cols-4 gap-4">
          {STATS.map((s) => (
            <div key={s.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-5 text-center">
              <div className="text-2xl sm:text-3xl font-bold text-amber-400">{s.value}</div>
              <div className="mt-1 text-xs sm:text-sm text-neutral-400">{s.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FEATURES ─────────────────────────────────────── */}
      <section id="features" className="py-24 px-4 sm:px-6 scroll-mt-16">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Fonctionnalités"
            title="Tout ce qu'un trader sérieux attend de son journal"
            subtitle="Chaque module est pensé pour un objectif : transformer tes données en décisions meilleures."
          />
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group rounded-2xl border border-white/10 bg-white/[0.03] p-6 hover:border-amber-400/40 hover:bg-amber-400/[0.04] transition-all duration-300"
              >
                <div className="w-11 h-11 rounded-lg bg-amber-400/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <f.icon className="w-5.5 h-5.5 text-amber-400" />
                </div>
                <h3 className="font-semibold text-white text-lg">{f.title}</h3>
                <p className="mt-2 text-sm text-neutral-400 leading-relaxed">{f.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── PRICING ──────────────────────────────────────── */}
      <section id="pricing" className="py-24 px-4 sm:px-6 scroll-mt-16 border-t border-white/5">
        <div className="max-w-6xl mx-auto">
          <SectionHeading
            eyebrow="Tarifs"
            title="Un investissement dérisoire comparé à une perte évitée"
            subtitle="Commence gratuitement. Passe au plan supérieur quand tes résultats l'exigent."
          />
          <div className="grid md:grid-cols-3 gap-6 max-w-5xl mx-auto items-stretch">
            {/* FREE */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 flex flex-col">
              <h3 className="text-xl font-bold text-white">{PLANS.FREE.name}</h3>
              <p className="text-sm text-neutral-400 mt-1">{PLANS.FREE.tagline}</p>
              <div className="mt-6 mb-6">
                <span className="text-4xl font-bold text-white">0 €</span>
                <span className="text-neutral-500 text-sm"> / pour toujours</span>
              </div>
              <ul className="space-y-3 text-sm text-neutral-300 flex-1">
                {PLANS.FREE.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-8 w-full border-white/15 text-white hover:bg-white/5 bg-transparent h-11">
                <Link href="/register">Commencer gratuitement</Link>
              </Button>
            </div>

            {/* PRO */}
            <div className="relative rounded-2xl border-2 border-amber-400 bg-gradient-to-b from-amber-400/[0.08] to-transparent p-8 flex flex-col shadow-[0_0_60px_-15px_rgba(251,191,36,0.3)]">
              <Badge className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-amber-400 text-black font-bold hover:bg-amber-400">
                Le plus populaire
              </Badge>
              <h3 className="text-xl font-bold text-white">{pro.name}</h3>
              <p className="text-sm text-neutral-400 mt-1">{pro.tagline}</p>
              <div className="mt-6 mb-2">
                <span className="text-4xl font-bold text-white">{pro.priceMonthly} €</span>
                <span className="text-neutral-500 text-sm"> / mois</span>
              </div>
              <p className="text-xs text-amber-400/90 mb-6">ou {pro.priceYearly} €/an (2 mois offerts)</p>
              <ul className="space-y-3 text-sm text-neutral-200 flex-1">
                {pro.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild className="mt-8 w-full bg-amber-400 text-black hover:bg-amber-300 font-bold h-11">
                <Link href="/register">Passer au plan Pro</Link>
              </Button>
            </div>

            {/* ELITE */}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 flex flex-col">
              <h3 className="text-xl font-bold text-white">{elite.name}</h3>
              <p className="text-sm text-neutral-400 mt-1">{elite.tagline}</p>
              <div className="mt-6 mb-2">
                <span className="text-4xl font-bold text-white">{elite.priceMonthly} €</span>
                <span className="text-neutral-500 text-sm"> / mois</span>
              </div>
              <p className="text-xs text-neutral-500 mb-6">ou {elite.priceYearly} €/an (2 mois offerts)</p>
              <ul className="space-y-3 text-sm text-neutral-300 flex-1">
                {elite.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-4 h-4 text-amber-400 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Button asChild variant="outline" className="mt-8 w-full border-amber-400/40 text-amber-400 hover:bg-amber-400/10 bg-transparent h-11 font-semibold">
                <Link href="/register">Devenir Elite</Link>
              </Button>
            </div>
          </div>
          <p className="text-center text-xs text-neutral-500 mt-8">
            Paiement sécurisé par Stripe · TVA applicable selon ton pays · Annulation à tout moment depuis ton espace
          </p>
        </div>
      </section>

      {/* ─── FAQ ──────────────────────────────────────────── */}
      <section id="faq" className="py-24 px-4 sm:px-6 scroll-mt-16 border-t border-white/5">
        <div className="max-w-3xl mx-auto">
          <SectionHeading eyebrow="FAQ" title="Les questions qu'on nous pose" />
          <div className="space-y-3">
            {FAQ.map((item) => (
              <details
                key={item.q}
                className="group rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden"
              >
                <summary className="flex items-center justify-between gap-4 cursor-pointer list-none p-5 font-medium text-white hover:bg-white/[0.03] transition-colors">
                  {item.q}
                  <ChevronDown className="w-4 h-4 shrink-0 text-neutral-500 group-open:rotate-180 transition-transform" />
                </summary>
                <p className="px-5 pb-5 text-sm text-neutral-400 leading-relaxed">{item.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FINAL CTA ────────────────────────────────────── */}
      <section className="py-24 px-4 sm:px-6 border-t border-white/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(251,191,36,0.07),transparent_60%)]" />
        <div className="relative max-w-2xl mx-auto text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white">
            Le meilleur moment pour commencer, c&apos;<span className="text-amber-400">ton prochain trade</span>.
          </h2>
          <p className="mt-4 text-neutral-400 text-lg">
            Rejoins les traders qui arrêtent de deviner et commencent à mesurer.
          </p>
          <Button asChild size="lg" className="mt-8 bg-amber-400 text-black hover:bg-amber-300 font-bold h-12 px-10 text-base">
            <Link href="/register">Créer mon compte gratuit</Link>
          </Button>
        </div>
      </section>

      {/* ─── FOOTER ───────────────────────────────────────── */}
      <footer className="mt-auto border-t border-white/10 bg-[#070707]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
          <div className="grid sm:grid-cols-3 gap-8">
            <div>
              <span className="text-lg font-bold text-white">
                DONCIEL<span className="text-amber-400">™</span>
              </span>
              <p className="mt-2 text-sm text-neutral-500">
                Journal de trading professionnel pensé par des traders, pour des traders.
              </p>
            </div>
            <div className="text-sm">
              <h4 className="font-semibold text-white mb-3">Produit</h4>
              <ul className="space-y-2 text-neutral-400">
                <li><a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a></li>
                <li><a href="#pricing" className="hover:text-white transition-colors">Tarifs</a></li>
                <li><Link href="/login" className="hover:text-white transition-colors">Se connecter</Link></li>
                <li><Link href="/register" className="hover:text-white transition-colors">Créer un compte</Link></li>
              </ul>
            </div>
            <div className="text-sm">
              <h4 className="font-semibold text-white mb-3">Légal</h4>
              <ul className="space-y-2 text-neutral-400">
                <li><Link href="/legal" className="hover:text-white transition-colors">Mentions légales & CGU</Link></li>
                <li><Link href="/legal#confidentialite" className="hover:text-white transition-colors">Confidentialité</Link></li>
                <li><Link href="/legal#risques" className="hover:text-white transition-colors">Avertissement sur les risques</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-10 pt-6 border-t border-white/5 space-y-3">
            <p className="text-xs leading-relaxed text-neutral-500">
              <Shield className="w-3.5 h-3.5 inline mr-1 -mt-0.5" />
              <strong className="text-neutral-400">Avertissement sur les risques :</strong> le trading
              de instruments financiers et de crypto-actifs comporte un risque élevé de perte en
              capital. DONCIEL TM est un outil de journalisation et d&apos;analyse et ne fournit
              aucun conseil en investissement. Les performances passées ne préjugent pas des
              performances futures. Tu restes seul(e) responsable de tes décisions de trading.
            </p>
            <p className="text-xs text-neutral-600">
              © {new Date().getFullYear()} DONCIEL TM. Tous droits réservés.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
