"use client";

import React, { useState, useEffect, useCallback } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
  Smartphone,
  Check,
  X,
  Clock,
  User,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface PaymentRequestItem {
  id: string;
  plan: string;
  interval: string;
  method: string;
  amount: number;
  currency: string;
  reference: string;
  phone: string;
  status: string;
  adminNote: string | null;
  reviewedAt: string | null;
  reviewedBy: string | null;
  createdAt: string;
  user: { email: string; name: string | null; plan: string };
}

const METHOD_LABELS: Record<string, string> = {
  MPESA: "M-Pesa (Vodacom)",
  AIRTEL: "Airtel Money",
  ORANGE: "Orange Money",
};

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  APPROVED: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  REJECTED: "bg-red-500/15 text-red-400 border-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "En attente",
  APPROVED: "Approuvé",
  REJECTED: "Rejeté",
};

export function PaymentRequestsPanel() {
  const [requests, setRequests] = useState<PaymentRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("PENDING");
  const [reviewTarget, setReviewTarget] = useState<{ request: PaymentRequestItem; action: "APPROVED" | "REJECTED" } | null>(null);
  const [adminNote, setAdminNote] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/payment-requests?status=${status}`);
      if (res.ok) {
        const data = await res.json();
        setRequests(data.requests || []);
      } else {
        setRequests([]);
      }
    } catch {
      setRequests([]);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await load(filter);
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [filter, load]);

  const submitReview = async () => {
    if (!reviewTarget) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/payment-requests", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: reviewTarget.request.id,
          action: reviewTarget.action,
          adminNote: adminNote.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success(
          reviewTarget.action === "APPROVED"
            ? `Plan ${reviewTarget.request.plan} activé pour ${reviewTarget.request.user.email}`
            : "Demande rejetée"
        );
        setReviewTarget(null);
        setAdminNote("");
        load(filter);
      } else {
        toast.error(data.error || "Erreur");
      }
    } catch {
      toast.error("Erreur de connexion");
    }
    setSubmitting(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        {["PENDING", "APPROVED", "REJECTED"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-md text-xs border transition-colors ${
              filter === s
                ? "border-amber-400 bg-amber-400/10 text-amber-300 font-semibold"
                : "border-white/10 text-neutral-400 hover:text-white"
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <Button variant="ghost" size="sm" onClick={() => load(filter)} className="ml-auto text-neutral-400">
          Rafraîchir
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : requests.length === 0 ? (
        <Card className="p-10 text-center">
          <Smartphone className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground text-sm">
            Aucune demande {STATUS_LABELS[filter]?.toLowerCase() || ""} pour le moment.
          </p>
        </Card>
      ) : (
        <ScrollArea className="max-h-[60vh] pr-2">
          <div className="space-y-3">
            {requests.map((r) => (
              <Card key={r.id} className="p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-amber-400/10 text-amber-400 border border-amber-400/30">
                        Plan {r.plan} · {r.interval === "yearly" ? "annuel" : "mensuel"}
                      </Badge>
                      <Badge variant="outline" className={STATUS_STYLES[r.status]}>
                        {STATUS_LABELS[r.status] || r.status}
                      </Badge>
                      <span className="text-sm font-semibold text-white">
                        {r.amount} {r.currency}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <User className="w-3 h-3" />
                      {r.user.email} {r.user.name ? `(${r.user.name})` : ""}
                    </p>
                  </div>
                  <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(r.createdAt).toLocaleString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs rounded-lg bg-muted/30 p-3">
                  <div>
                    <span className="text-muted-foreground">Opérateur :</span>{" "}
                    <span className="text-foreground font-medium">{METHOD_LABELS[r.method] || r.method}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Référence :</span>{" "}
                    <span className="text-foreground font-mono font-medium break-all">{r.reference}</span>
                  </div>
                  <div className="sm:col-span-2">
                    <span className="text-muted-foreground">Téléphone :</span>{" "}
                    <span className="text-foreground font-medium">{r.phone}</span>
                  </div>
                  <div className="sm:col-span-1 text-right">
                    {r.status === "PENDING" ? (
                      <span className="text-amber-400 font-medium">→ Vérifier dans le SMS opérateur</span>
                    ) : r.reviewedBy ? (
                      <span className="text-muted-foreground">par {r.reviewedBy}</span>
                    ) : null}
                  </div>
                </div>

                {r.adminNote && (
                  <p className="text-xs text-muted-foreground">
                    Note : {r.adminNote}
                  </p>
                )}

                {r.status === "PENDING" && (
                  <div className="flex gap-2 justify-end">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => { setReviewTarget({ request: r, action: "REJECTED" }); setAdminNote(""); }}
                      className="border-red-500/30 text-red-400 hover:bg-red-500/10 bg-transparent"
                    >
                      <X className="w-3.5 h-3.5 mr-1" />
                      Rejeter
                    </Button>
                    <Button
                      size="sm"
                      onClick={() => { setReviewTarget({ request: r, action: "APPROVED" }); setAdminNote(""); }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white"
                    >
                      <Check className="w-3.5 h-3.5 mr-1" />
                      Approuver & activer
                    </Button>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </ScrollArea>
      )}

      {/* Dialog de confirmation */}
      <Dialog open={reviewTarget !== null} onOpenChange={(open) => { if (!open) setReviewTarget(null); }}>
        <DialogContent className="bg-[#111] border-white/10 text-neutral-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-white">
              {reviewTarget?.action === "APPROVED" ? "Approuver ce paiement ?" : "Rejeter cette demande ?"}
            </DialogTitle>
            <DialogDescription className="text-neutral-400">
              {reviewTarget?.action === "APPROVED" ? (
                <>
                  Le plan <strong>{reviewTarget?.request.plan}</strong> sera activé pour{" "}
                  <strong>{reviewTarget?.request.user.email}</strong> pendant{" "}
                  {reviewTarget?.request.interval === "yearly" ? "12 mois" : "1 mois"}. Un email de confirmation
                  sera envoyé si Resend est configuré.
                </>
              ) : (
                "L'utilisateur pourra soumettre une nouvelle demande plus tard."
              )}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input
              placeholder="Note interne (optionnel) — ex : vérifié dans le relevé M-Pesa"
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              className="bg-white/5 border-white/10 text-white"
            />
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setReviewTarget(null)} className="border-white/15 text-white bg-transparent">
                Annuler
              </Button>
              <Button
                onClick={submitReview}
                disabled={submitting}
                className={
                  reviewTarget?.action === "APPROVED"
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-red-600 hover:bg-red-500 text-white"
                }
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Confirmer"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
