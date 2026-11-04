"use client";

import React, { useState } from "react";
import { Loader2, Sparkles, Terminal, ArrowRight } from "lucide-react";
import { signIn, signUp } from "@/lib/api";

interface AuthViewProps {
  /** UI-preview mode only: optional link to leave the signed-in-screen preview. */
  previewExit?: () => void;
}

export function AuthView({ previewExit }: AuthViewProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !password.trim() || busy) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const result =
      mode === "signin"
        ? { error: await signIn(email.trim(), password) }
        : await signUp(email.trim(), password);
    if (result.error) {
      setError(result.error);
    } else if ("needsConfirmation" in result && result.needsConfirmation) {
      setInfo("Account created. Check your inbox to confirm your email, then sign in.");
      setMode("signin");
    }
    setBusy(false);
  };

  const switchMode = () => {
    setMode(mode === "signin" ? "signup" : "signin");
    setError(null);
    setInfo(null);
  };

  return (
    <div className="min-h-dvh flex flex-col bg-[#fbfcfd] text-slate-900">
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-sm">
          {/* Brand */}
          <div className="flex flex-col items-center text-center mb-6 sm:mb-8 select-none">
            <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center shadow-sm mb-3">
              <Terminal className="w-5 h-5 text-blue-400" />
            </div>
            <span className="font-serif text-xl font-semibold tracking-tight text-slate-900">
              Apriora
            </span>
            <span className="font-mono text-[10px] uppercase tracking-widest text-slate-400 font-medium mt-1">
              {mode === "signin" ? "Sign in to your vault" : "Create your vault"}
            </span>
          </div>

          {/* Card */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-5 sm:p-6">
            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  autoComplete="email"
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              <div>
                <label className="block font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoComplete={mode === "signin" ? "current-password" : "new-password"}
                  className="w-full px-3.5 py-2.5 text-base sm:text-sm bg-slate-50 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
              </div>

              {error && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-200/80 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              {info && (
                <p className="text-xs text-blue-700 bg-blue-50 border border-blue-200/80 rounded-lg px-3 py-2">
                  {info}
                </p>
              )}

              <button
                type="submit"
                disabled={busy || !email.trim() || !password.trim()}
                className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] select-none cursor-pointer mt-1"
              >
                {busy ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-blue-200" />
                    <span>{mode === "signin" ? "Sign in" : "Create account"}</span>
                    <ArrowRight className="w-3.5 h-3.5 text-blue-200" />
                  </>
                )}
              </button>
            </form>
          </div>

          <p className="text-center text-xs text-slate-500 mt-4">
            {mode === "signin" ? "New here? " : "Already have an account? "}
            <button
              type="button"
              onClick={switchMode}
              className="text-blue-600 font-medium hover:underline cursor-pointer"
            >
              {mode === "signin" ? "Create an account" : "Sign in"}
            </button>
          </p>

          {previewExit && (
            <p className="text-center text-[11px] font-mono text-amber-600 mt-3">
              <button type="button" onClick={previewExit} className="hover:underline cursor-pointer">
                ← back to the UI walkthrough
              </button>
            </p>
          )}
        </div>
      </div>

      <footer className="border-t border-slate-200 bg-white/60 py-5 text-center text-xs text-slate-500">
        <span className="font-semibold text-slate-800">Apriora</span>
        <span className="text-slate-300 mx-2">·</span>
        Compile interview-ready notes from any resource.
      </footer>
    </div>
  );
}
