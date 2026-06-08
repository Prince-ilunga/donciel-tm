"use client";

import { useEffect } from "react";
import { useAppStore } from "@/stores/app-store";
import { AuthScreen } from "@/components/auth/auth-screen";
import { MainApp } from "@/components/layout/main-app";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export default function Home() {
  const { isAuthenticated, authLoading, setUser, setAuthLoading, setAuthStatus, logout } = useAppStore();

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch("/api/auth/me");
        if (res.ok) {
          const data = await res.json();
          if (data.user) {
            if (data.user.status === "approved") {
              setUser(data.user);
            } else if (data.user.status === "pending") {
              setAuthStatus("pending");
              setAuthLoading(false);
            } else if (data.user.status === "rejected") {
              setAuthStatus("rejected");
              setAuthLoading(false);
            }
          } else {
            setUser(null);
          }
        } else {
          setUser(null);
        }
      } catch {
        setUser(null);
      }
    }
    checkAuth();
  }, [setUser, setAuthLoading, setAuthStatus, logout]);

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <p className="text-muted-foreground text-sm">DONCIEL™</p>
        </div>
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-background">
        {isAuthenticated ? <MainApp /> : <AuthScreen />}
      </div>
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
