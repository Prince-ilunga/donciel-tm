"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PLANS, PLAN_ORDER, PlanId, PlanInterval } from "@/lib/plans";
import { Check, Crown, ExternalLink, ArrowLeft, CreditCard, Loader2, Smartphone, Info } from "lucide-react";
import { toast } from "sonner";

// ─── Paddle.js minimal typing ────────────────────────────────
interface PaddleEventPayload {
  name: string;
  data?: { status?: string; transaction_id?: string };
}
interface PaddleGlobal {
  Environment: { set: (env: string) => void };
  Initialize: (opts: { token: string; eventCallback?: (e: PaddleEventPayload) => void }) => void;
  Checkout: { open: (opts: Record<string, unknown>) => void };
}
declare global {
  interface Window {
    Paddle?: PaddleGlobal;
  }
}

interface PaddleConfig {
  clientToken: string;
  environment: "sandbox" | "production";
  priceIds: Record<string, string | null>;
}

interface MobileMoneyConfig {
  number: string;
  name: string;
  operators: readonly string[];
}

interface PendingRequest {
  id: string;
  plan: string;
  interval: string;
  method: string;
  amount: number;
  currency: string;
  createdAt: string;
}

interface SubscriptionInfo {
  userId: string;
  plan: PlanId;
  planName: string;
  planStatus: string;
  interval: PlanInterval | null;
  currentPeriodEnd: string | null;
  isAdmin: boolean;
  hasSubscription: boolean;
  billingConfigured: boolean;
  billingProvider: "paddle" | "stripe" | "mobile_money" | null;
  paddle: PaddleConfig | null;
  mobileMoney: MobileMoneyConfig | null;
  email: string;
  pendingRequest: PendingRequest | null;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  trialing: { label: "Essai", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  past_due: { label: "Paiement échoué", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  canceled: { label: "Annulé", className: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" },
};

const METHOD_LABELS: Record<string, string> = {
  MPESA: "M-Pesa (Vodacom)",
  AIRTEL: "Airtel Money",
  ORANGE: "Orange Money",
};

function AbonnementContent() {
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [interval, setInterval] = useState<PlanInterval>("monthly");

  // Mobile money dialog state
  const [mmOpen, setMmOpen] = useState(false);
  const [mmPlan, setMmPlan] = useState<PlanId>("PRO");
  const [mmMethod, setMmMethod] = useState<string>("MPESA");
  const [mmPhone, setMmPhone] = useState("");
  const [mmReference, setMmReference] = useState("");
  const [mmSubmitting, setMmSubmitting] = useState(false);

  const paddleInitStarted = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/billing/subscription");
        if (res.status === 401) {
          window.location.assign("/login");
          return;
        }
        const data = await res.json();
        if (!cancelled) setInfo(data);
      } catch {
        if (!cancelled) toast.error("Impossible de charger ton abonnement");
      }
      if (!cancelled) setLoading(false);
    })();
    if (searchParams.get("canceled") === "1") {
      toast.info("Paiement annulé — aucun prélèvement effectué.");
    }
    return () => {
      cancelled = true;
    };
  }, [searchParams]);

  // ─── Paddle.js loader ──────────────────────────────────────
  const loadPaddle = (paddle: PaddleConfig): Promise<PaddleGlobal | null> =>
    new Promise((resolve) => {
      if (typeof window === "undefined") return resolve(null);
      const finish = (p: PaddleGlobal) => {
        if (!paddleInitStarted.current) {
          paddleInitStarted.current = true;
          if (paddle.environment === "sandbox") p.Environment.set("sandbox");
          p.Initialize({
            token: paddle.clientToken,
            eventCallback: (event: PaddleEventPayload) => {
              if (event.name === "checkout.completed") {
                toast.success("Paiement réussi ! Ton plan s'active dans quelques instants…");
                setTimeout(() => window.location.reload(), 5000);
              }
              if (event.name === "checkout.closed") {
                setPendingPlan(null);
              }
            },
          });
        }
        resolve(p);
      };
      if (window.Paddle) return finish(window.Paddle);
      const script = document.createElement("script");
      script.src = "https://cdn.paddle.com/paddle/v2/paddle.js";
      script.onload = () => {
        if (window.Paddle) finish(window.Paddle);
        else resolve(null);
      };
      script.onerror = () => resolve(null);
      document.head.appendChild(script);
    });

  // ─── Checkout Paddle (carte bancaire internationale) ───────
  const handlePaddleCheckout = async (plan: PlanId) => {
    if (!info?.paddle) return;
    const priceId = info.paddle.priceIds[`${plan}:${interval}`];
    if (!priceId) {
      toast.error(`Prix Paddle non configuré pour ${plan} ${interval === "yearly" ? "annuel" : "mensuel"}`);
      setPendingPlan(null);
      return;
    }
    const Paddle = await loadPaddle(info.paddle);
    if (!Paddle) {
      toast.error("Impossible de charger le module de paiement");
      setPendingPlan(null);
      return;
    }
    Paddle.Checkout.open({
      items: [{ priceId, quantity: 1 }],
      customer: { email: info.email },
      customData: { userId: info.userId, plan },
    });
  };

  // ─── Mobile money (demande manuelle validée par l'admin) ───
  const openMobileMoney = (plan: PlanId) => {
    setMmPlan(plan);
    setMmMethod("MPESA");
    setMmPhone("");
    setMmReference("");
    setMmOpen(true);
  };

  const submitMobileMoney = async () => {
    setMmSubmitting(true);
    try {
      const res = await fetch("/api/billing/manual-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan: mmPlan, interval, method: mmMethod, reference: mmReference, phone: mmPhone }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Demande envoyée ! Ton plan sera activé après vérification du paiement.");
        setMmOpen(false);
        window.location.reload();
        return;
      }
      toast.error(data.error || "Erreur lors de l'envoi de la demande");
    } catch {
      toast.error("Erreur de connexion");
    }
    setMmSubmitting(false);
  };

  // ─── Upgrade dispatcher ────────────────────────────────────
  const handleUpgrade = async (plan: PlanId) => {
    setPendingPlan(plan);
    if (info?.paddle) {
      await handlePaddleCheckout(plan);
      return;
    }
    if (info?.mobileMoney) {
      openMobileMoney(plan);
      setPendingPlan(null);
      return;
    }
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      toast.error(data.error || "Erreur lors de la création du paiement");
    } catch {
      toast.error("Erreur de connexion");
    }
    setPendingPlan(null);
  };

  const handlePortal = async () => {
    setPendingPlan("portal");
    const endpoint = info?.billingProvider === "paddle" ? "/api/billing/paddle/portal" : "/api/billing/portal";
    try {
      const res = await fetch(endpoint, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.assign(data.url);
        return;
      }
      toast.error(data.error || "Erreur lors de l'ouverture du portail");
    } catch {
      toast.error("Erreur de connexion");
    }
    setPendingPlan(null);
  };

  const statusBadge = () => {
    if (!info) return null;
    const s = STATUS_LABELS[info.planStatus] || { label: info.planStatus, className: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" };
    return <Badge variant="outline" className={s.className}>{s.label}</Badge>;
  };

  const providerLabel = () => {
    if (info?.billingProvider === "paddle") return "géré par Paddle";
    if (info?.billingProvider === "stripe") return "géré par Stripe";
    return "paiement mobile money";
  };

  const mmAmount = mmPlan === "ELITE"
    ? (interval === "yearly" ? PLANS.ELITE.priceYearly : PLANS.ELITE.priceMonthly)
    : (interval === "yearly" ? PLANS.PRO.priceYearly : PLANS.PRO.priceMonthly);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-neutral-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-white/10 bg-[#0a0a0a]/90 sticky top-0 z-40 backdrop-blur">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm" className="text-neutral-400 hover:text-white hover:bg-white/5">
              <Link href="/app">
                <ArrowLeft className="w-4 h-4 mr-1" />
                Retour à l&apos;app
              </Link>
            </Button>
          </div>
          <span className="font-bold text-white">
            DONCIEL<span className="text-amber-400">™</span>
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-10">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-3xl font-bold text-white">Mon abonnement</h1>
            <p className="text-neutral-400 mt-1">Gère ton plan et ta facturation.</p>
          </div>
          {loading ? (
            <div className="h-8 w-28 rounded bg-white/5 animate-pulse" />
          ) : info && (
            <div className="flex items-center gap-2">
              <Badge className="bg-amber-400/10 text-amber-400 border border-amber-400/30">
                <Crown className="w-3 h-3 mr-1" />
                {info.isAdmin ? "Elite (Admin)" : info.planName}
              </Badge>
              {statusBadge()}
            </div>
          )}
        </div>

        {/* Demande mobile money en attente */}
        {info?.pendingRequest && (
          <Card className="mb-6 border-amber-400/30 bg-amber-400/[0.06]">
            <CardContent className="p-4 flex items-start gap-3">
              <Info className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div className="text-sm">
                <p className="text-amber-300 font-medium">Demande de paiement en attente de validation</p>
                <p className="text-neutral-400 mt-0.5">
                  Plan {info.pendingRequest.plan} ({info.pendingRequest.interval === "yearly" ? "annuel" : "mensuel"}) ·{" "}
                  {info.pendingRequest.amount} {info.pendingRequest.currency} via{" "}
                  {METHOD_LABELS[info.pendingRequest.method] || info.pendingRequest.method} — tu recevras un email dès l&apos;activation.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {info?.hasSubscription && info.currentPeriodEnd && info.planStatus !== "canceled" && (
          <Card className="mb-8 border-white/10 bg-white/[0.03]">
            <CardContent className="p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="text-sm">
                <p className="text-white font-medium">
                  Prochain renouvellement :{" "}
                  {new Date(info.currentPeriodEnd).toLocaleDateString("fr-FR", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
                <p className="text-neutral-500 text-xs mt-0.5">
                  Facturation {info.interval === "yearly" ? "annuelle" : "mensuelle"} · {providerLabel()}
                </p>
              </div>
              {info.billingProvider !== "mobile_money" && (
                <Button
                  variant="outline"
                  onClick={handlePortal}
                  disabled={pendingPlan === "portal"}
                  className="border-white/15 text-white hover:bg-white/5 bg-transparent shrink-0"
                >
                  {pendingPlan === "portal" ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CreditCard className="w-4 h-4 mr-2" />
                  )}
                  Gérer ma facturation
                  <ExternalLink className="w-3.5 h-3.5 ml-2" />
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        {/* Interval toggle */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="inline-flex rounded-lg border border-white/10 bg-white/[0.03] p-1">
            {(["monthly", "yearly"] as PlanInterval[]).map((i) => (
              <button
                key={i}
                onClick={() => setInterval(i)}
                className={`px-4 py-1.5 text-sm rounded-md transition-colors ${
                  interval === i ? "bg-amber-400 text-black font-semibold" : "text-neutral-400 hover:text-white"
                }`}
              >
                {i === "monthly" ? "Mensuel" : "Annuel −17 %"}
              </button>
            ))}
          </div>
        </div>

        {/* Plans */}
        <div className="grid md:grid-cols-3 gap-5">
          {PLAN_ORDER.map((planId) => {
            const plan = PLANS[planId];
            const isCurrent = info?.plan === planId && !info?.isAdmin;
            const highlight = plan.highlight;
            return (
              <div
                key={planId}
                className={`relative rounded-2xl border p-6 flex flex-col ${
                  highlight
                    ? "border-amber-400/60 bg-amber-400/[0.05]"
                    : "border-white/10 bg-white/[0.03]"
                } ${isCurrent ? "ring-2 ring-amber-400/50" : ""}`}
              >
                {isCurrent && (
                  <Badge className="absolute -top-3 right-4 bg-amber-400 text-black font-semibold hover:bg-amber-400">
                    Plan actuel
                  </Badge>
                )}
                <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">{plan.tagline}</p>
                <div className="mt-4 mb-5">
                  {planId === "FREE" ? (
                    <span className="text-3xl font-bold text-white">0 €</span>
                  ) : (
                    <>
                      <span className="text-3xl font-bold text-white">
                        {interval === "yearly" ? plan.priceYearly : plan.priceMonthly} €
                      </span>
                      <span className="text-neutral-500 text-xs">
                        {interval === "yearly" ? " / an" : " / mois"}
                      </span>
                    </>
                  )}
                </div>
                <ul className="space-y-2.5 text-sm text-neutral-300 flex-1">
                  {plan.features.map((f) => (
                    <li key={f} className="flex items-start gap-2">
                      <Check className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" />
                      {f}
                    </li>
                  ))}
                </ul>
                <div className="mt-6">
                  {planId === "FREE" ? (
                    <Button
                      variant="outline"
                      disabled
                      className="w-full border-white/10 text-neutral-500 bg-transparent h-10"
                    >
                      {isCurrent ? "Ton plan actuel" : "Plan gratuit"}
                    </Button>
                  ) : isCurrent ? (
                    <Button
                      variant="outline"
                      onClick={handlePortal}
                      disabled={pendingPlan !== null || info?.billingProvider === "mobile_money"}
                      className="w-full border-amber-400/40 text-amber-400 hover:bg-amber-400/10 bg-transparent h-10 font-semibold"
                    >
                      {info?.billingProvider === "mobile_money" ? "Renouvellement manuel" : "Gérer cet abonnement"}
                    </Button>
                  ) : (
                    <Button
                      onClick={() => handleUpgrade(planId)}
                      disabled={pendingPlan !== null}
                      className={`w-full h-10 font-bold ${
                        highlight
                          ? "bg-amber-400 text-black hover:bg-amber-300"
                          : "bg-white/10 text-white hover:bg-white/15"
                      }`}
                    >
                      {pendingPlan === planId ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        `Passer au plan ${plan.name}`
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Modes de paiement disponibles */}
        {!loading && (
          <div className="mt-10 rounded-2xl border border-white/10 bg-white/[0.03] p-5">
            <h2 className="text-sm font-semibold text-white flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-amber-400" />
              Moyens de paiement acceptés
            </h2>
            <div className="flex flex-wrap gap-2 mt-3">
              {info?.paddle && (
                <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/5">
                  Carte bancaire internationale (via Paddle)
                </Badge>
              )}
              {info?.mobileMoney && (
                <Badge variant="outline" className="border-amber-500/30 text-amber-400 bg-amber-500/5">
                  <Smartphone className="w-3 h-3 mr-1" />
                  Mobile money RDC (M-Pesa · Airtel · Orange)
                </Badge>
              )}
              {!info?.billingConfigured && (
                <span className="text-xs text-neutral-500">
                  Le paiement n&apos;est pas encore activé. Configure Paddle (carte bancaire) ou Mobile Money.
                </span>
              )}
            </div>
            {info?.mobileMoney && (
              <p className="text-xs text-neutral-500 mt-3">
                Mobile money : envoie le montant au {info.mobileMoney.number} ({info.mobileMoney.name}), puis clique
                sur « Passer au plan… » et saisis la référence de ta transaction. Un administrateur valide l&apos;activation
                sous 24 h.
              </p>
            )}
          </div>
        )}
      </main>

      {/* Dialog Mobile Money */}
      <Dialog open={mmOpen} onOpenChange={setMmOpen}>
        <DialogContent className="bg-[#111] border-white/10 text-neutral-200 max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white flex items-center gap-2">
              <Smartphone className="w-5 h-5 text-amber-400" />
              Payer par Mobile Money — plan {mmPlan}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              Suis les 3 étapes ci-dessous. Ton plan est activé après vérification par un administrateur (sous 24 h).
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Étape 1 */}
            <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
              <p className="text-xs font-semibold text-amber-400 mb-1">ÉTAPE 1 — Envoie le montant</p>
              <p className="text-sm text-neutral-300">
                Envoie <strong className="text-white">{mmAmount} $</strong> ({interval === "yearly" ? "12 mois" : "1 mois"})
                au numéro <strong className="text-amber-300">{info?.mobileMoney?.number}</strong> ({info?.mobileMoney?.name})
                via l&apos;opérateur de ton choix.
              </p>
              <div className="flex gap-2 mt-2">
                {info?.mobileMoney?.operators.map((op) => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => setMmMethod(op)}
                    className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
                      mmMethod === op
                        ? "border-amber-400 bg-amber-400/10 text-amber-300 font-semibold"
                        : "border-white/10 text-neutral-400 hover:text-white"
                    }`}
                  >
                    {METHOD_LABELS[op] || op}
                  </button>
                ))}
              </div>
            </div>

            {/* Étape 2 */}
            <div className="space-y-1.5">
              <Label htmlFor="mm-phone" className="text-xs text-neutral-400">
                ÉTAPE 2 — Ton numéro de téléphone (expéditeur)
              </Label>
              <Input
                id="mm-phone"
                placeholder="+243 8xx xxx xxx"
                value={mmPhone}
                onChange={(e) => setMmPhone(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
            </div>

            {/* Étape 3 */}
            <div className="space-y-1.5">
              <Label htmlFor="mm-reference" className="text-xs text-neutral-400">
                ÉTAPE 3 — L&apos;ID de la transaction (reçu de l&apos;opérateur)
              </Label>
              <Input
                id="mm-reference"
                placeholder="Ex : MP240915.1234.A56789"
                value={mmReference}
                onChange={(e) => setMmReference(e.target.value)}
                className="bg-white/5 border-white/10 text-white"
              />
              <p className="text-[11px] text-neutral-500">
                Tu le trouves dans le SMS de confirmation reçu après l&apos;envoi.
              </p>
            </div>

            <Button
              onClick={submitMobileMoney}
              disabled={mmSubmitting || mmPhone.length < 8 || mmReference.trim().length < 4}
              className="w-full bg-amber-400 text-black hover:bg-amber-300 font-bold h-11"
            >
              {mmSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Envoyer ma demande d'activation"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <footer className="border-t border-white/10 bg-[#070707] mt-auto">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 text-center">
          <p className="text-xs text-neutral-600">
            DONCIEL TM — Outil de journalisation. Ne constitue pas un conseil en investissement.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default function AbonnementPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#0a0a0a]" />}>
      <AbonnementContent />
    </Suspense>
  );
}
