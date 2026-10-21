"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { KeyRound, MailCheck } from "lucide-react";
import { toast } from "sonner";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [devResetUrl, setDevResetUrl] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (res.ok) {
        setSent(true);
        setDevResetUrl(data.devResetUrl || null);
      } else {
        toast.error(data.error || "Erreur lors de la demande");
      }
    } catch {
      toast.error("Erreur de connexion");
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-primary/10 flex items-center justify-center mb-2">
            {sent ? (
              <MailCheck className="w-7 h-7 text-primary" />
            ) : (
              <KeyRound className="w-7 h-7 text-primary" />
            )}
          </div>
          <CardTitle className="text-2xl">
            {sent ? "Vérifie ta boîte mail" : "Mot de passe oublié"}
          </CardTitle>
          <CardDescription>
            {sent
              ? "Si un compte existe avec cet email, tu recevras un lien de réinitialisation valide 1 heure."
              : "Entre ton email pour recevoir un lien de réinitialisation."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!sent ? (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : (
                  "Envoyer le lien de réinitialisation"
                )}
              </Button>
            </form>
          ) : (
            <div className="space-y-4">
              {devResetUrl && (
                <div className="rounded-lg border border-dashed border-border p-3 text-xs break-all">
                  <p className="font-semibold mb-1 text-muted-foreground">Mode développement (email non configuré) :</p>
                  <a href={devResetUrl} className="text-primary hover:underline">
                    {devResetUrl}
                  </a>
                </div>
              )}
              <Button variant="outline" className="w-full" asChild>
                <Link href="/login">Retour à la connexion</Link>
              </Button>
            </div>
          )}
          <p className="mt-4 text-center">
            <Link href="/" className="text-xs text-muted-foreground hover:text-foreground hover:underline">
              ← Retour à l&apos;accueil
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
