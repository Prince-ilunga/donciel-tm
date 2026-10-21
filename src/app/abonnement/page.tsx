"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { PLANS, PLAN_ORDER, PlanId, PlanInterval } from "@/lib/plans";
import { Check, Crown, ExternalLink, ArrowLeft, CreditCard, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SubscriptionInfo {
  plan: PlanId;
  planName: string;
  planStatus: string;
  interval: PlanInterval | null;
  currentPeriodEnd: string | null;
  isAdmin: boolean;
  hasSubscription: boolean;
  billingConfigured: boolean;
}

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  active: { label: "Actif", className: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" },
  trialing: { label: "Essai", className: "bg-amber-500/15 text-amber-400 border-amber-500/30" },
  past_due: { label: "Paiement échoué", className: "bg-red-500/15 text-red-400 border-red-500/30" },
  canceled: { label: "Annulé", className: "bg-neutral-500/15 text-neutral-400 border-neutral-500/30" },
};

export default function AbonnementPage() {
  const searchParams = useSearchParams();
  const [info, setInfo] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingPlan, setPendingPlan] = useState<string | null>(null);
  const [interval, setInterval] = useState<PlanInterval>("monthly");

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/billing/subscription");
      if (res.status === 401) {
        window.location.href = "/login";
        return;
      }
      const data = await res.json();
      setInfo(data);
    } catch {
      toast.error("Impossible de charger ton abonnement");
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
    if (searchParams.get("canceled") === "1") {
      toast.info("Paiement annulé — aucun prélèvement effectué.");
    }
  }, [load, searchParams]);

  const handleUpgrade = async (plan: PlanId) => {
    setPendingPlan(plan);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, interval }),
      });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
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
    try {
      const res = await fetch("/api/billing/portal", { method: "POST" });
      const data = await res.json();
      if (res.ok && data.url) {
        window.location.href = data.url;
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-10">
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
                  Facturation {info.interval === "yearly" ? "annuelle" : "mensuelle"} · gérée par Stripe
                </p>
              </div>
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
                      disabled={pendingPlan !== null || !info?.billingConfigured}
                      className="w-full border-amber-400/40 text-amber-400 hover:bg-amber-400/10 bg-transparent h-10 font-semibold"
                    >
                      Gérer cet abonnement
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

        {!info?.billingConfigured && (
          <p className="text-center text-xs text-neutral-500 mt-8">
            💡 Le paiement n&apos;est pas encore activé. Configure <code className="text-neutral-400">STRIPE_SECRET_KEY</code> et
            les identifiants de prix Stripe pour activer les souscriptions.
          </p>
        )}
      </main>

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
