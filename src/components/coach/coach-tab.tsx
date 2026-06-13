"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/app-store";
import { cn } from "@/lib/utils";
import { useTrades } from "@/lib/hooks";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Brain,
  Send,
  Loader2,
  Sparkles,
  Trash2,
  TrendingUp,
  AlertTriangle,
  Lightbulb,
  BarChart3,
  MessageSquare,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────
interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

// ─── Suggested Questions ──────────────────────────────────────
const SUGGESTED_FR = [
  { icon: BarChart3, text: "Analyse ma performance globale", short: "Performance" },
  { icon: TrendingUp, text: "Quels sont mes points forts ?", short: "Points forts" },
  { icon: AlertTriangle, text: "Quelles sont mes faiblesses ?", short: "Faiblesses" },
  { icon: Lightbulb, text: "Donne-moi 3 conseils concrets pour m'améliorer", short: "Conseils" },
];

const SUGGESTED_EN = [
  { icon: BarChart3, text: "Analyze my overall performance", short: "Performance" },
  { icon: TrendingUp, text: "What are my strengths?", short: "Strengths" },
  { icon: AlertTriangle, text: "What are my weaknesses?", short: "Weaknesses" },
  { icon: Lightbulb, text: "Give me 3 concrete tips to improve", short: "Tips" },
];

// ─── Main Component ───────────────────────────────────────────
export function CoachTab() {
  const { user, language } = useAppStore();
  const { trades } = useTrades();

  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Restore chat history from localStorage
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem('donciel-coach-messages');
        if (saved) return JSON.parse(saved);
      } catch {}
    }
    return [];
  });
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const hasTrades = trades.length > 0;
  const suggested = language === "fr" ? SUGGESTED_FR : SUGGESTED_EN;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  // Persist chat history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem('donciel-coach-messages', JSON.stringify(messages));
    } catch {}
  }, [messages]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      role: "user",
      content: text.trim(),
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setIsLoading(true);

    try {
      // Build history for context (exclude current message, keep last 10)
      const history = messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/coach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          message: text.trim(),
          history,
          language,
        }),
      });

      let data;
      try {
        data = await res.json();
      } catch {
        throw new Error(
          language === "fr"
            ? "Le serveur ne répond pas correctement"
            : "Server is not responding correctly"
        );
      }

      if (!res.ok) {
        throw new Error(data.error || (language === "fr" ? "Erreur serveur" : "Server error"));
      }

      if (!data.response) {
        throw new Error(
          language === "fr"
            ? "Le coach n'a pas pu générer une réponse"
            : "Coach could not generate a response"
        );
      }

      const assistantMessage: ChatMessage = {
        role: "assistant",
        content: data.response,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMessage]);
    } catch (error: any) {
      // Remove the failed user message from history so the user can retry
      setMessages((prev) => prev.filter(m => m !== userMessage));
      toast.error(
        error.message ||
          (language === "fr"
            ? "Erreur de communication avec le coach"
            : "Error communicating with coach")
      );
    } finally {
      setIsLoading(false);
    }
  }, [isLoading, messages, language]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    setMessages([]);
    try { localStorage.removeItem('donciel-coach-messages'); } catch {}
  };

  // Simple markdown-like rendering
  const renderContent = (content: string) => {
    // Split into paragraphs and handle basic formatting
    return content.split("\n").map((line, i) => {
      // Headings
      if (line.startsWith("### ")) {
        return (
          <h4 key={i} className="font-bold text-sm mt-3 mb-1 text-foreground">
            {line.replace("### ", "")}
          </h4>
        );
      }
      if (line.startsWith("## ")) {
        return (
          <h3 key={i} className="font-bold text-base mt-4 mb-1 text-primary">
            {line.replace("## ", "")}
          </h3>
        );
      }
      // Bold text with **
      const boldFormatted = line.replace(
        /\*\*(.*?)\*\*/g,
        '<strong class="font-semibold text-foreground">$1</strong>'
      );
      // List items
      if (line.startsWith("- ") || line.startsWith("• ")) {
        return (
          <div key={i} className="flex gap-2 ml-2">
            <span className="text-primary shrink-0">•</span>
            <span
              dangerouslySetInnerHTML={{
                __html: boldFormatted.replace(/^[-•]\s*/, ""),
              }}
            />
          </div>
        );
      }
      // Numbered lists
      if (/^\d+\.\s/.test(line)) {
        return (
          <div key={i} className="flex gap-2 ml-2">
            <span className="text-primary shrink-0 font-mono text-xs">
              {line.match(/^\d+/)?.[0]}.
            </span>
            <span
              dangerouslySetInnerHTML={{
                __html: boldFormatted.replace(/^\d+\.\s*/, ""),
              }}
            />
          </div>
        );
      }
      // Empty line = paragraph break
      if (line.trim() === "") {
        return <div key={i} className="h-2" />;
      }
      // Regular text
      return (
        <span
          key={i}
          className="block"
          dangerouslySetInnerHTML={{ __html: boldFormatted }}
        />
      );
    });
  };

  return (
    <div className="flex flex-col h-full max-h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="p-4 md:p-6 border-b border-border bg-muted/30 shrink-0">
        <div className="max-w-[800px] mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="text-xl font-bold tracking-tight">
                {language === "fr" ? "Coach IA Professionnel" : "Professional AI Coach"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {language === "fr"
                  ? "Analyse intelligente de vos données de trading"
                  : "Intelligent analysis of your trading data"}
              </p>
            </div>
          </div>
          {messages.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearChat}
              className="gap-1.5 text-muted-foreground hover:text-foreground"
            >
              <Trash2 className="w-3.5 h-3.5" />
              {language === "fr" ? "Effacer" : "Clear"}
            </Button>
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 min-h-0 overflow-y-auto" ref={scrollRef}>
        <div className="max-w-[800px] mx-auto p-4 md:p-6 space-y-4">
          {/* Welcome + Suggested questions — shown when no messages */}
          {messages.length === 0 && (
            <div className="space-y-4">
              {/* Welcome card */}
              <Card className="p-6 border-primary/20 bg-primary/5">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <Sparkles className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-sm">
                      {language === "fr"
                        ? "Bienvenue dans votre Coach IA ! 🎯"
                        : "Welcome to your AI Coach! 🎯"}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1">
                      {hasTrades
                        ? (language === "fr"
                            ? "Je connais toutes vos données de trading. Posez-moi des questions ou choisissez un sujet ci-dessous pour commencer."
                            : "I know all your trading data. Ask me questions or pick a topic below to get started.")
                        : (language === "fr"
                            ? "Ajoutez des trades pour que le coach puisse analyser vos données. Vous pouvez déjà lui poser des questions sur le trading."
                            : "Add trades so the coach can analyze your data. You can already ask questions about trading.")
                      }
                    </p>
                  </div>
                </div>
              </Card>

              {/* Suggested questions — always visible when no messages */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {suggested.map((s, i) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={i}
                      onClick={() => sendMessage(s.text)}
                      className="flex items-center gap-3 p-3 rounded-xl border border-border hover:border-primary/30 hover:bg-primary/5 transition-all duration-200 text-left group"
                    >
                      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-primary/10 transition-colors shrink-0">
                        <Icon className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <span className="text-xs font-medium">{s.text}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((msg, i) => (
            <div
              key={i}
              className={cn(
                "flex gap-3",
                msg.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              {msg.role === "assistant" && (
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
                  <Brain className="w-4 h-4 text-primary" />
                </div>
              )}
              <div
                className={cn(
                  "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed",
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground rounded-br-md"
                    : "bg-muted/50 border border-border rounded-bl-md"
                )}
              >
                {msg.role === "assistant" ? (
                  <div className="prose-xs">{renderContent(msg.content)}</div>
                ) : (
                  msg.content
                )}
              </div>
              {msg.role === "user" && (
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-1">
                  <MessageSquare className="w-4 h-4 text-muted-foreground" />
                </div>
              )}
            </div>
          ))}

          {/* Loading indicator */}
          {isLoading && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Brain className="w-4 h-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted/50 border border-border rounded-2xl rounded-bl-md px-4 py-3">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {language === "fr"
                    ? "Le coach analyse vos données..."
                    : "Coach is analyzing your data..."}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-border bg-background/80 backdrop-blur-sm shrink-0">
        <div className="max-w-[800px] mx-auto">
          <div className="flex gap-2">
            <div className="flex-1 relative">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  language === "fr"
                    ? "Posez une question à votre coach IA..."
                    : "Ask your AI coach a question..."
                }
                className="w-full resize-none rounded-xl border border-border bg-muted/30 px-4 py-3 pr-12 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/50 placeholder:text-muted-foreground/50 min-h-[44px] max-h-[120px]"
                rows={1}
                disabled={isLoading}
              />
            </div>
            <Button
              onClick={() => sendMessage(input)}
              disabled={!input.trim() || isLoading}
              size="icon"
              className="h-11 w-11 rounded-xl shrink-0"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
          </div>
          <p className="text-[10px] text-muted-foreground/50 mt-1.5 text-center">
            {language === "fr"
              ? "Le coach IA analyse vos données de trading réelles pour vous donner des conseils personnalisés"
              : "The AI coach analyzes your real trading data to give you personalized advice"}
          </p>
        </div>
      </div>
    </div>
  );
}
