"use client";

import { useState } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Eye, EyeOff, BarChart3, Shield, Globe } from "lucide-react";
import { toast } from "sonner";
import { DoncielLogo } from "@/components/shared/donciel-logo";

export function AuthScreen() {
  const { setUser, authStatus, setAuthStatus } = useAppStore();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const language = "fr";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data.user);
        toast.success(t(language, "login") + " ✓");
      } else {
        toast.error(data.error || t(language, "invalidCredentials"));
      }
    } catch {
      toast.error(t(language, "error"));
    }
    setLoading(false);
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, name }),
      });
      const data = await res.json();
      if (res.ok) {
        if (data.user.status === "approved") {
          setUser(data.user);
          toast.success(t(language, "success"));
        } else {
          setAuthStatus("pending");
          toast.success(t(language, "pendingApproval"));
        }
      } else {
        toast.error(data.error || t(language, "error"));
      }
    } catch {
      toast.error(t(language, "error"));
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    setAuthStatus("idle");
  };

  // Pending approval screen
  if (authStatus === "pending") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-primary/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-primary" />
            </div>
            <CardTitle className="text-2xl">En Attente de Validation</CardTitle>
            <CardDescription className="text-base">
              {t(language, "pendingApproval")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground text-sm mb-4">
              Votre demande d&apos;inscription a été envoyée à un administrateur. Vous recevrez un accès une fois votre candidature approuvée.
            </p>
            <Button variant="outline" onClick={handleLogout} className="w-full">
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Rejected screen
  if (authStatus === "rejected") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/20">
          <CardHeader className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <Shield className="w-8 h-8 text-destructive" />
            </div>
            <CardTitle className="text-2xl">Candidature Rejetée</CardTitle>
            <CardDescription className="text-base">
              {t(language, "rejected")}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button variant="outline" onClick={handleLogout} className="w-full">
              Retour
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-primary/5 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5" />
        <div className="relative z-10 flex flex-col justify-center p-12">
          <div className="mb-8">
            <h1 className="text-5xl font-bold tracking-tight">
              DONCIEL<sup className="text-lg text-primary ml-1">TM</sup>
            </h1>
            <p className="text-xl text-muted-foreground mt-3">
              Journal de Trading Ultra Professionnel
            </p>
          </div>
          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <DoncielLogo size={20} />
              </div>
              <div>
                <h3 className="font-semibold">Analyse en Temps Réel</h3>
                <p className="text-sm text-muted-foreground">Statistiques avancées et graphiques intuitifs</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Distribution RR Complète</h3>
                <p className="text-sm text-muted-foreground">Analyse détaillée des Risk-Reward</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Shield className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Sécurité & Rôles</h3>
                <p className="text-sm text-muted-foreground">Validation admin et gestion des accès</p>
              </div>
            </div>
            <div className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Globe className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="font-semibold">Bilingue FR/EN</h3>
                <p className="text-sm text-muted-foreground">Interface disponible en français et anglais</p>
              </div>
            </div>
          </div>
          <div className="mt-12">
            <Badge variant="secondary" className="text-xs">
              Powered by AI
            </Badge>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute -bottom-20 -right-20 w-64 h-64 rounded-full bg-primary/5" />
        <div className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/5" />
      </div>

      {/* Right side - Auth Form */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-8">
        <Card className="w-full max-w-md border-0 shadow-none lg:border lg:shadow-sm">
          <CardHeader className="text-center pb-2">
            <div className="lg:hidden mb-4">
              <h1 className="text-3xl font-bold tracking-tight">
                DONCIEL<sup className="text-sm text-primary ml-1">TM</sup>
              </h1>
            </div>
            <CardTitle className="text-2xl">
              {isLogin ? t(language, "login") : t(language, "register")}
            </CardTitle>
            <CardDescription>
              {isLogin
                ? "Accédez à votre journal de trading"
                : "Créez votre compte DONCIEL"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={isLogin ? handleLogin : handleRegister} className="space-y-4">
              {!isLogin && (
                <div className="space-y-2">
                  <Label htmlFor="name">{t(language, "name")}</Label>
                  <Input
                    id="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Votre nom"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">{t(language, "email")}</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="votre@email.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{t(language, "password")}</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    required
                    minLength={6}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                ) : isLogin ? (
                  t(language, "loginButton")
                ) : (
                  t(language, "registerButton")
                )}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm">
              {isLogin ? (
                <p className="text-muted-foreground">
                  {t(language, "noAccount")}{" "}
                  <button
                    onClick={() => setIsLogin(false)}
                    className="text-primary hover:underline font-medium"
                  >
                    {t(language, "register")}
                  </button>
                </p>
              ) : (
                <p className="text-muted-foreground">
                  {t(language, "hasAccount")}{" "}
                  <button
                    onClick={() => setIsLogin(true)}
                    className="text-primary hover:underline font-medium"
                  >
                    {t(language, "login")}
                  </button>
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
