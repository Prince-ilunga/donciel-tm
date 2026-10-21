"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { AuthScreen } from "@/components/auth/auth-screen";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export default function LoginPage() {
  const { isAuthenticated, setUser, authLoading, setAuthLoading } = useAppStore();
  const router = useRouter();

  // Already signed in → straight to the app
  useEffect(() => {
    if (isAuthenticated) {
      router.replace("/app");
      return;
    }
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user && data.user.status === "approved") {
            setUser(data.user);
            router.replace("/app");
            return;
          }
        }
      } catch {
        // not logged in — stay here
      }
      setAuthLoading(false);
    }
    checkAuth();
  }, [isAuthenticated, setUser, setAuthLoading, router]);

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-background">
        <AuthScreen defaultMode="login" />
      </div>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
