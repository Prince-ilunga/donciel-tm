"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAuthed(Boolean(data?.user?.status === "approved")))
      .catch(() => setAuthed(false));
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed top-0 inset-x-0 z-50 border-b bg-[#060505]/75 backdrop-blur-xl transition-colors duration-300 ${
        scrolled ? "border-white/[0.09]" : "border-white/[0.05]"
      }`}
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <span className="text-xl font-bold tracking-tight text-white">
            DONCIEL<span className="dct-text-gold">™</span>
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-7 text-sm text-neutral-400">
          <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <Link href="/legal" className="hover:text-white transition-colors">Légal</Link>
        </nav>

        <div className="flex items-center gap-2">
          {authed === null ? (
            <div className="h-9 w-24 rounded-md bg-white/5 animate-pulse" />
          ) : authed ? (
            <Button asChild className="dct-btn-glow bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 font-semibold h-9 border-0">
              <Link href="/app">Ouvrir l&apos;application</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-neutral-300 hover:text-white hover:bg-white/[0.06] h-9 px-2 sm:px-4">
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button asChild className="dct-btn-glow bg-gradient-to-b from-amber-300 to-amber-500 text-black hover:from-amber-200 hover:to-amber-400 font-semibold h-9 border-0">
                <Link href="/register">
                  <span className="hidden sm:inline">Commencer gratuitement</span>
                  <span className="sm:hidden">Commencer</span>
                </Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
