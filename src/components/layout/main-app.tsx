"use client";

import { useAppStore, TabId } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  LayoutDashboard,
  Calendar,
  BarChart3,
  Clock,
  Video,
  StickyNote,
  ShieldCheck,
  Crown,
  Sun,
  Moon,
  LogOut,
  Globe,
  Menu,
  X,
  TrendingUp,
  FileDown,
} from "lucide-react";
import { useTheme } from "next-themes";
import React, { useState } from "react";
import { toast } from "sonner";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";
import { JournalTab } from "@/components/journal/journal-tab";
import { DistributionTab } from "@/components/distribution/distribution-tab";
import { TimingTab } from "@/components/timing/timing-tab";
import { VideosTab } from "@/components/videos/videos-tab";
import { NotesTab } from "@/components/notes/notes-tab";
import { AdminTab } from "@/components/admin/admin-tab";
import { RoleManagementTab } from "@/components/admin/role-management-tab";

const navItems: { id: TabId; icon: typeof LayoutDashboard; key: string; adminOnly?: boolean }[] = [
  { id: "dashboard", icon: LayoutDashboard, key: "dashboard" },
  { id: "journal", icon: Calendar, key: "journal" },
  { id: "distribution", icon: BarChart3, key: "distributionRR" },
  { id: "timing", icon: Clock, key: "timingAnalysis" },
  { id: "videos", icon: Video, key: "setupVideos" },
  { id: "notes", icon: StickyNote, key: "prepNotes" },
  { id: "admin", icon: ShieldCheck, key: "adminVerification", adminOnly: true },
  { id: "roles", icon: Crown, key: "roleManagement" },
];

export function MainApp() {
  const { user, activeTab, setActiveTab, language, setLanguage, logout: storeLogout } = useAppStore();
  const { theme, setTheme } = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const mountedRef = React.useRef(false);

  // Using requestAnimationFrame to avoid synchronous setState in effect
  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      requestAnimationFrame(() => {
        setMounted(true);
      });
    }
  }, []);
  const isAdmin = user?.role === "admin";

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    storeLogout();
    toast.success(t(language, "logout"));
  };

  const toggleLanguage = () => {
    const newLang = language === "fr" ? "en" : "fr";
    setLanguage(newLang);
    // Save language preference
    if (user) {
      fetch("/api/auth/me", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ language: newLang }),
      });
    }
  };

  const filteredNavItems = navItems.filter((item) => !item.adminOnly || isAdmin);

  const renderTab = () => {
    switch (activeTab) {
      case "dashboard": return <DashboardTab />;
      case "journal": return <JournalTab />;
      case "distribution": return <DistributionTab />;
      case "timing": return <TimingTab />;
      case "videos": return <VideosTab />;
      case "notes": return <NotesTab />;
      case "admin": return <AdminTab />;
      case "roles": return <RoleManagementTab />;
      default: return <DashboardTab />;
    }
  };

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar border-r border-sidebar-border flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        {/* Logo */}
        <div className="p-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">
              DONCIEL<sup className="text-[10px] text-primary ml-0.5">TM</sup>
            </h1>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-sidebar-foreground"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <ScrollArea className="flex-1 px-3 py-4">
          <nav className="space-y-1">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveTab(item.id);
                    setSidebarOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  <span className="truncate">{t(language, item.key as Parameters<typeof t>[1])}</span>
                  {item.adminOnly && (
                    <Badge variant="secondary" className="ml-auto text-[10px] px-1.5 py-0 h-4">
                      Admin
                    </Badge>
                  )}
                </button>
              );
            })}
          </nav>
        </ScrollArea>

        <Separator className="bg-sidebar-border" />

        {/* Bottom actions */}
        <div className="p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9 text-sidebar-foreground"
            >
              {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              className="h-9 w-9 text-sidebar-foreground"
            >
              <Globe className="w-4 h-4" />
            </Button>
            <div className="ml-auto">
              <Badge variant="outline" className="text-[10px] font-mono">
                {language.toUpperCase()}
              </Badge>
            </div>
          </div>
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
          >
            <LogOut className="w-4 h-4 mr-3" />
            {t(language, "logout")}
          </Button>
        </div>

        {/* Copyright */}
        <div className="p-3 pt-0">
          <p className="text-[10px] text-muted-foreground text-center">
            DONCIEL™ © {new Date().getFullYear()}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Top header */}
        <header className="h-14 border-b border-border flex items-center px-4 gap-3 bg-background/80 backdrop-blur-sm sticky top-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="lg:hidden text-foreground"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h2 className="text-lg font-semibold truncate">
            {t(language, navItems.find(n => n.id === activeTab)?.key as Parameters<typeof t>[1] || "dashboard")}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            <Badge variant="secondary" className="hidden sm:flex text-xs">
              {user?.email}
            </Badge>
            {isAdmin && (
              <Badge className="text-xs bg-primary">
                <Crown className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {renderTab()}
        </div>
      </main>
    </div>
  );
}
