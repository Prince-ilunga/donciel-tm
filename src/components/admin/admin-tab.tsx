"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  ShieldCheck,
  Check,
  X,
  User,
  Mail,
  Calendar,
  Users,
  Clock,
  AlertCircle,
  UserCheck,
  UserX,
} from "lucide-react";
import { toast } from "sonner";

interface ManagedUser {
  id: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  createdAt: string;
}

export function AdminTab() {
  const { user, language } = useAppStore();
  const isAdmin = user?.role === "admin";
  const [activeTab, setActiveTab] = useState("pending");
  const [users, setUsers] = useState<ManagedUser[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUsers = useCallback(async (status?: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.append("status", status);
      const res = await fetch(`/api/users?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch {
      setUsers([]);
    }
    setLoading(false);
  }, []);

  // Load on mount - initial data fetch
  const [initialized, setInitialized] = useState(false);
  if (isAdmin && !initialized) {
    setInitialized(true);
    loadUsers("pending");
  }

  // Handle tab change
  const handleTabChange = useCallback((tab: string) => {
    setActiveTab(tab);
    const statusMap: Record<string, string> = { pending: "pending", approved: "approved", rejected: "rejected" };
    loadUsers(statusMap[tab]);
  }, [loadUsers]);

  const handleApprove = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      });
      if (res.ok) {
        toast.success(language === "fr" ? "Membre admis !" : "Member approved!");
        loadUsers(activeTab === "pending" ? "pending" : activeTab === "approved" ? "approved" : "rejected");
      } else {
        toast.error("Error");
      }
    } catch {
      toast.error("Error");
    }
  };

  const handleReject = async (userId: string) => {
    try {
      const res = await fetch(`/api/users/${userId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      });
      if (res.ok) {
        toast.success(language === "fr" ? "Membre rejeté" : "Member rejected");
        loadUsers("pending");
      } else {
        toast.error("Error");
      }
    } catch {
      toast.error("Error");
    }
  };

  const handleDelete = async (userId: string) => {
    if (!confirm(language === "fr" ? "Supprimer cet utilisateur ?" : "Delete this user?")) return;
    try {
      const res = await fetch(`/api/users/${userId}`, { method: "DELETE" });
      if (res.ok) {
        toast.success(language === "fr" ? "Utilisateur supprimé" : "User deleted");
        loadUsers();
      } else {
        toast.error("Error");
      }
    } catch {
      toast.error("Error");
    }
  };

  if (!isAdmin) {
    return (
      <div className="p-4 md:p-6 flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 text-center max-w-sm">
          <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground/30 mb-4" />
          <p className="text-muted-foreground">{language === "fr" ? "Accès réservé aux administrateurs" : "Admin access only"}</p>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-[1600px] mx-auto overflow-x-hidden">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-emerald bg-clip-text text-transparent">
          {t(language, "adminVerification")}
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {language === "fr" ? "Gérer les candidatures et les membres" : "Manage applications and members"}
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-3 gap-2 md:gap-3">
        <Card className="p-3 md:p-4 text-center">
          <Clock className="w-4 h-4 md:w-5 md:h-5 mx-auto text-gold mb-1.5" />
          <div className="text-xl md:text-2xl font-bold">{users.filter(u => u.status === "pending").length || "—"}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground truncate">{t(language, "pendingMembers")}</div>
        </Card>
        <Card className="p-3 md:p-4 text-center">
          <UserCheck className="w-4 h-4 md:w-5 md:h-5 mx-auto text-profit mb-1.5" />
          <div className="text-xl md:text-2xl font-bold">{users.filter(u => u.status === "approved").length || "—"}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground truncate">{t(language, "approvedMembers")}</div>
        </Card>
        <Card className="p-3 md:p-4 text-center">
          <UserX className="w-4 h-4 md:w-5 md:h-5 mx-auto text-loss mb-1.5" />
          <div className="text-xl md:text-2xl font-bold">{users.filter(u => u.status === "rejected").length || "—"}</div>
          <div className="text-[10px] md:text-xs text-muted-foreground truncate">{t(language, "rejectedMembers")}</div>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList className="grid grid-cols-3 w-full">
          <TabsTrigger value="pending" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-3">
            <Clock className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:block" />
            <span className="truncate">{t(language, "pendingMembers")}</span>
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-3">
            <UserCheck className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:block" />
            <span className="truncate">{t(language, "approvedMembers")}</span>
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-1 text-[10px] sm:text-xs px-1 sm:px-3">
            <UserX className="w-3 h-3 sm:w-3.5 sm:h-3.5 hidden sm:block" />
            <span className="truncate">{t(language, "rejectedMembers")}</span>
          </TabsTrigger>
        </TabsList>

        {["pending", "approved", "rejected"].map((tab) => (
          <TabsContent key={tab} value={tab}>
            {loading ? (
              <div className="space-y-3 mt-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i} className="p-4"><Skeleton className="h-16 w-full" /></Card>
                ))}
              </div>
            ) : users.length === 0 ? (
              <Card className="p-8 text-center mt-3">
                <Users className="w-10 h-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground">
                  {language === "fr" ? "Aucun membre dans cette catégorie" : "No members in this category"}
                </p>
              </Card>
            ) : (
              <div className="space-y-3 mt-3">
                {users.map((u) => (
                  <Card key={u.id} className="p-3 md:p-4">
                    <div className="flex items-center justify-between gap-2 md:gap-3">
                      <div className="flex items-center gap-2 md:gap-3 min-w-0">
                        <div className={cn(
                          "w-9 h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center shrink-0 text-sm font-bold",
                          u.status === "approved" && "bg-profit/10 text-profit",
                          u.status === "pending" && "bg-gold/10 text-gold",
                          u.status === "rejected" && "bg-loss/10 text-loss"
                        )}>
                          {(u.name || u.email)[0].toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-sm truncate">{u.name || "—"}</div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Mail className="w-3 h-3 shrink-0" />
                            <span className="truncate">{u.email}</span>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                            <Calendar className="w-3 h-3 shrink-0" />
                            {new Date(u.createdAt).toLocaleDateString(language === "fr" ? "fr-FR" : "en-US")}
                          </div>
                        </div>
                      </div>
                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-1.5 sm:gap-2 shrink-0">
                        {tab === "pending" && (
                          <>
                            <Button size="sm" onClick={() => handleApprove(u.id)} className="gap-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3">
                              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {t(language, "approve")}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={() => handleReject(u.id)} className="gap-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3">
                              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {t(language, "reject")}
                            </Button>
                          </>
                        )}
                        {tab === "approved" && (
                          <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)} className="gap-1 h-7 sm:h-8 text-[10px] sm:text-xs text-loss px-2 sm:px-3">
                            <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            {t(language, "delete")}
                          </Button>
                        )}
                        {tab === "rejected" && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => handleApprove(u.id)} className="gap-1 h-7 sm:h-8 text-[10px] sm:text-xs px-2 sm:px-3">
                              <Check className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                              {t(language, "approve")}
                            </Button>
                            <Button size="sm" variant="ghost" onClick={() => handleDelete(u.id)} className="gap-1 h-7 sm:h-8 text-[10px] sm:text-xs text-loss px-2 sm:px-3">
                              <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
