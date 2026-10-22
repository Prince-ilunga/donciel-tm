"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { PlayCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

/**
 * Bouton "Essayer la démo" — connecte le visiteur au compte
 * démo public (lecture seule) puis redirige vers /app.
 */
export function DemoButton({
  variant = "ghost",
  className = "",
  children,
}: {
  variant?: "ghost" | "outline" | "default" | "secondary";
  className?: string;
  children?: React.ReactNode;
}) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function startDemo() {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch("/api/demo/login", { method: "POST" });
      if (res.ok) {
        router.push("/app");
        router.refresh();
      } else {
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Impossible de lancer la démo");
        setLoading(false);
      }
    } catch {
      toast.error("Connexion impossible. Vérifie ta connexion internet.");
      setLoading(false);
    }
  }

  return (
    <Button
      onClick={startDemo}
      disabled={loading}
      size="lg"
      variant={variant}
      className={className}
      aria-label="Essayer la démo sans créer de compte"
    >
      {loading ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" aria-hidden />
      ) : (
        <PlayCircle className="w-4 h-4 mr-2" aria-hidden />
      )}
      {children || "Essayer la démo"}
    </Button>
  );
}
