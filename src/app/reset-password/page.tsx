"use client";

import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token") || "";

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("Les mots de passe ne correspondent pas");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Mot de passe mis à jour !");
        setTimeout(() => router.push("/login"), 1200);
      } else {
        toast.error(data.error || "Erreur lors de la réinitialisation");
      }
    } catch {
      toast.error("Erreur de connexion");
    }
    setLoading(false);
  };

  if (!token) {
    return (
      <CardContent className="text-center space-y-4">
        <p className="text-muted-foreground text-sm">Lien invalide : token manquant.</p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/forgot-password">Demander un nouveau lien</Link>
        </Button>
      </CardContent>
    );
  }

  return (
    <CardContent>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="password">Nouveau mot de passe</Label>
          <Input
            id="password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirmer le mot de passe</Label>
          <Input
            id="confirm"
            type="password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            placeholder="••••••••"
            required
            minLength={6}
          />
        </div>
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? (
            <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
          ) : (
            "Réinitialiser mon mot de passe"
          )}
        </Button>
      </form>
      <p className="mt-4 text-center">
        <Link href="/login" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
          Retour à la connexion
        </Link>
      </p>
    </CardContent>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            <ShieldCheck className="w-7 h-7 text-primary" />
          </div>
          <CardTitle className="text-2xl">Nouveau mot de passe</CardTitle>
          <CardDescription>Choisis un mot de passe solide pour sécuriser ton compte.</CardDescription>
        </CardHeader>
        <Suspense fallback={<CardContent className="text-center text-muted-foreground text-sm">Chargement…</CardContent>}>
          <ResetPasswordForm />
        </Suspense>
      </Card>
    </div>
  );
}
