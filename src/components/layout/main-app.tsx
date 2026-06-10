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
  PanelLeftClose,
  PanelLeft,
  Target,
  FolderOpen,
  Download,
  Trash2,
} from "lucide-react";
import { useTheme } from "next-themes";
import React, { useState, useCallback } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { ExecutionTab } from "@/components/execution/execution-tab";
import { SetupTab } from "@/components/setup/setup-tab";
import { DashboardTab } from "@/components/dashboard/dashboard-tab";
import { JournalTab } from "@/components/journal/journal-tab";
import { DistributionTab } from "@/components/distribution/distribution-tab";
import { TimingTab } from "@/components/timing/timing-tab";
import { VideosTab } from "@/components/videos/videos-tab";
import { NotesTab } from "@/components/notes/notes-tab";
import { AdminTab } from "@/components/admin/admin-tab";
import { RoleManagementTab } from "@/components/admin/role-management-tab";
import { DoncielLogo } from "@/components/shared/donciel-logo";

const navItems: { id: TabId; icon: typeof LayoutDashboard; key: string; adminOnly?: boolean }[] = [
  { id: "execution", icon: Target, key: "executionDonciel" },
  { id: "setup", icon: FolderOpen, key: "setupTab" },
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
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const mountedRef = React.useRef(false);

  React.useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      requestAnimationFrame(() => {
        setMounted(true);
      });
    }
  }, []);
  const isAdmin = user?.role === "admin";

  // ─── Export PDF ────────────────────────────────────────────
  const handleExportPDF = useCallback(async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const res = await fetch(`/api/export?lang=${language}`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Export failed");
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `DONCIEL-Trade-Journal-${new Date().toISOString().slice(0, 10)}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success(language === "fr" ? "PDF exporté avec succès !" : "PDF exported successfully!");
    } catch (error: any) {
      toast.error(error.message || (language === "fr" ? "Erreur lors de l'export" : "Export failed"));
    } finally {
      setIsExporting(false);
    }
  }, [language, isExporting]);

  // ─── Clear All Trades ──────────────────────────────────────
  const handleClearTrades = useCallback(async () => {
    if (isClearing) return;
    setIsClearing(true);
    try {
      const res = await fetch("/api/trades/clear", { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Clear failed");
      }
      const data = await res.json();
      toast.success(
        language === "fr"
          ? `${data.deletedTrades} trades supprimés !`
          : `${data.deletedTrades} trades deleted!`
      );
      setShowClearDialog(false);
    } catch (error: any) {
      toast.error(error.message || (language === "fr" ? "Erreur lors de la suppression" : "Clear failed"));
    } finally {
      setIsClearing(false);
    }
  }, [language, isClearing]);

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    storeLogout();
    toast.success(t(language, "logout"));
  };

  const toggleLanguage = () => {
    const newLang = language === "fr" ? "en" : "fr";
    setLanguage(newLang);
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
      case "execution": return <ExecutionTab />;
      case "setup": return <SetupTab />;
      case "dashboard": return <DashboardTab />;
      case "journal": return <JournalTab />;
      case "distribution": return <DistributionTab />;
      case "timing": return <TimingTab />;
      case "videos": return <VideosTab />;
      case "notes": return <NotesTab />;
      case "admin": return <AdminTab />;
      case "roles": return <RoleManagementTab />;
      default: return <ExecutionTab />;
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
          "fixed lg:static inset-y-0 left-0 z-50 bg-sidebar border-r border-sidebar-border flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0 overflow-hidden",
          sidebarOpen ? "translate-x-0 w-64" : "-translate-x-full",
          sidebarCollapsed && "lg:w-14",
          !sidebarCollapsed && "lg:w-64",
          sidebarOpen && !sidebarCollapsed && "w-64"
        )}
      >
        {/* Logo */}
        <div className={cn("flex items-center shrink-0", sidebarCollapsed ? "p-2 justify-center" : "p-4 gap-3")}>
          <DoncielLogo size={36} />
          {!sidebarCollapsed && (
            <div>
              <h1 className="text-lg font-bold tracking-tight text-sidebar-foreground">
                DONCIEL<sup className="text-[10px] text-primary ml-0.5">TM</sup>
              </h1>
            </div>
          )}
          {!sidebarCollapsed && (
            <div className="ml-auto flex items-center gap-1">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="hidden lg:flex text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1.5 transition-colors"
                title={language === "fr" ? "Réduire" : "Collapse"}
              >
                <PanelLeftClose className="w-4 h-4" />
              </button>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden text-sidebar-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          )}
          {sidebarCollapsed && (
            <button
              onClick={() => setSidebarCollapsed(false)}
              className="hidden lg:flex absolute top-2.5 right-1 text-sidebar-foreground hover:bg-sidebar-accent rounded-md p-1 transition-colors"
              title={language === "fr" ? "Développer" : "Expand"}
            >
              <PanelLeft className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <Separator className="bg-sidebar-border" />

        {/* Navigation */}
        <ScrollArea className="flex-1 py-4">
          <nav className={cn("space-y-1", sidebarCollapsed ? "px-1.5" : "px-3")}>
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
                    "w-full flex items-center rounded-lg text-sm font-medium transition-all duration-200",
                    sidebarCollapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-md shadow-primary/20"
                      : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                  )}
                  title={sidebarCollapsed ? t(language, item.key as Parameters<typeof t>[1]) : undefined}
                >
                  <Icon className="w-4.5 h-4.5 shrink-0" />
                  {!sidebarCollapsed && (
                    <span className="truncate">{t(language, item.key as Parameters<typeof t>[1])}</span>
                  )}
                  {!sidebarCollapsed && item.adminOnly && (
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
        <div className={cn("shrink-0", sidebarCollapsed ? "p-1.5 space-y-1" : "p-3 space-y-2")}>
          <div className={cn("flex items-center", sidebarCollapsed ? "justify-center gap-0" : "gap-2")}>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="h-9 w-9 text-sidebar-foreground"
              title={theme === "dark" ? (language === "fr" ? "Mode clair" : "Light mode") : (language === "fr" ? "Mode sombre" : "Dark mode")}
            >
              {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleLanguage}
              className="h-9 w-9 text-sidebar-foreground"
              title={language === "fr" ? "English" : "Français"}
            >
              <Globe className="w-4 h-4" />
            </Button>
            {!sidebarCollapsed && (
              <div className="ml-auto">
                <Badge variant="outline" className="text-[10px] font-mono">
                  {language.toUpperCase()}
                </Badge>
              </div>
            )}
          </div>
          {!sidebarCollapsed ? (
            <Button
              variant="ghost"
              onClick={handleLogout}
              className="w-full justify-start text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <LogOut className="w-4 h-4 mr-3" />
              {t(language, "logout")}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="w-full text-sidebar-foreground hover:bg-sidebar-accent"
              title={t(language, "logout")}
            >
              <LogOut className="w-4 h-4" />
            </Button>
          )}
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
            {t(language, navItems.find(n => n.id === activeTab)?.key as Parameters<typeof t>[1] || "executionDonciel")}
          </h2>
          <div className="ml-auto flex items-center gap-2">
            {/* Export PDF */}
            <Button
              variant="ghost"
              size="sm"
              className="gap-1.5 h-8 text-xs"
              onClick={handleExportPDF}
              title={language === "fr" ? "Exporter en PDF" : "Export PDF"}
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            {/* Clear All Trades (Admin only) */}
            {isAdmin && (
              <Button
                variant="ghost"
                size="sm"
                className="gap-1.5 h-8 text-xs text-destructive hover:text-destructive"
                onClick={() => setShowClearDialog(true)}
                title={language === "fr" ? "Supprimer tous les trades" : "Clear all trades"}
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{language === "fr" ? "Effacer" : "Clear"}</span>
              </Button>
            )}
            {isAdmin && (
              <Badge className="text-xs bg-primary">
                <Crown className="w-3 h-3 mr-1" />
                Admin
              </Badge>
            )}
          </div>

        {/* Clear Trades Confirmation Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Trash2 className="w-5 h-5 text-destructive" />
                {language === "fr" ? "Supprimer tous les trades ?" : "Delete all trades?"}
              </DialogTitle>
              <DialogDescription>
                {language === "fr"
                  ? "Cette action supprimera définitivement tous vos trades et leurs captures d'écran. Cette action est irréversible."
                  : "This will permanently delete all your trades and their screenshots. This action cannot be undone."
                }
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                {language === "fr" ? "Annuler" : "Cancel"}
              </Button>
              <Button variant="destructive" onClick={handleClearTrades} disabled={isClearing}>
                {isClearing
                  ? (language === "fr" ? "Suppression..." : "Deleting...")
                  : (language === "fr" ? "Supprimer tout" : "Delete all")
                }
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {renderTab()}
        </div>
      </main>
    </div>
  );
}
