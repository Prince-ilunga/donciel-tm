"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  const [authed, setAuthed] = useState<boolean | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setAuthed(Boolean(data?.user?.status === "approved")))
      .catch(() => setAuthed(false));
  }, []);

  return (
    <header className="fixed top-0 inset-x-0 z-50 border-b border-white/10 bg-[#0a0a0a]/80 backdrop-blur-md">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white">
            DONCIEL<span className="text-amber-400">™</span>
          </span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-neutral-300">
          <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
          <a href="#pricing" className="hover:text-white transition-colors">Tarifs</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
          <Link href="/legal" className="hover:text-white transition-colors">Légal</Link>
        </nav>
        <div className="flex items-center gap-2">
          {authed === null ? (
            <div className="h-9 w-24 rounded-md bg-white/5 animate-pulse" />
          ) : authed ? (
            <Button asChild className="bg-amber-400 text-black hover:bg-amber-300 font-semibold h-9">
              <Link href="/app">Ouvrir l&apos;application</Link>
            </Button>
          ) : (
            <>
              <Button asChild variant="ghost" className="text-neutral-300 hover:text-white hover:bg-white/5 h-9">
                <Link href="/login">Se connecter</Link>
              </Button>
              <Button asChild className="bg-amber-400 text-black hover:bg-amber-300 font-semibold h-9">
                <Link href="/register">Commencer gratuitement</Link>
              </Button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
