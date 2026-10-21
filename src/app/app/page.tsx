"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app-store";
import { MainApp } from "@/components/layout/main-app";
import { TradeDetailDialog } from "@/components/shared/trade-detail-dialog";
import { ScreenshotViewer } from "@/components/shared/screenshot-viewer";
import { ThemeProvider } from "next-themes";
import { Toaster } from "@/components/ui/sonner";

export default function AppPage() {
  const { isAuthenticated, authLoading, setUser, setAuthLoading, setAuthStatus, logout } = useAppStore();
  const router = useRouter();

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
              router.replace("/login");
            } else if (data.user.status === "rejected") {
              setAuthStatus("rejected");
              setAuthLoading(false);
              router.replace("/login");
            }
          } else {
            setUser(null);
            router.replace("/login");
          }
        } else {
          setUser(null);
          router.replace("/login");
        }
      } catch {
        setUser(null);
        router.replace("/login");
      }
    }
    checkAuth();
  }, [setUser, setAuthLoading, setAuthStatus, logout, router]);

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

  // Not authenticated → the login page is rendering, avoid a flash of the app
  if (!isAuthenticated && !authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-background">
        <MainApp />
      </div>
      <TradeDetailDialog />
      <ScreenshotViewer />
      <Toaster richColors position="top-right" />
    </ThemeProvider>
  );
}
