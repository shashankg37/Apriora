"use client";

import React, { useState } from "react";
import { Link2, Sparkles, X, FileText, HelpCircle, Info, Loader2 } from "lucide-react";
import { DepthMode } from "@/types";

interface HeroIngestionProps {
  onGenerate: (url: string, depth: DepthMode) => void;
  isGenerating?: boolean;
  error?: string | null;
}

export function HeroIngestion({ onGenerate, isGenerating = false, error }: HeroIngestionProps) {
  const [url, setUrl] = useState("");
  const [depth, setDepth] = useState<DepthMode>("detailed");

  const depthDescriptions: Record<DepthMode, string> = {
    summary:
      "Summary: a high-yield distillation covering the core thesis and essential takeaways.",
    detailed:
      "Detailed: full breakdown with math formulations, code blocks, and key algorithmic takeaways.",
    interview:
      "Interview Q&A: 10–15 deep technical questions with answers, grounded strictly in the source."
  };

  const handleClear = () => {
    setUrl("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!url.trim() || isGenerating) return;
    onGenerate(url.trim(), depth);
  };

  const depthControls = [
    { mode: "summary" as DepthMode, label: "Summary", icon: null },
    { mode: "detailed" as DepthMode, label: "Detailed", icon: null },
    { mode: "interview" as DepthMode, label: "Interview Q&A", icon: null }
  ];

  return (
    <section className="pt-8 pb-10">
      {/* Top Meta Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-blue-50/80 border border-blue-200/60 text-blue-700 font-mono text-[11px] font-medium tracking-wide w-fit">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          AUTOMATED NOTE GENERATION
        </div>

        <div className="flex items-center gap-2 font-mono text-[11px] text-slate-500">
          <span className="w-2 h-2 rounded-xs bg-slate-400" />
          <span>YOUTUBE · ARTICLES &amp; PAPERS</span>
        </div>
      </div>

      {/* Main Headline */}
      <div className="max-w-4xl mb-8">
        <h1 className="font-serif text-3xl sm:text-4xl lg:text-[42px] font-normal tracking-tight text-slate-900 leading-[1.15] mb-4">
          Compile interview-ready notes from any resource.
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
          Paste a YouTube lecture or an article / paper link below to compile a clean technical dossier.
        </p>
      </div>

      {/* Ingestion Input Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-5 transition-shadow hover:shadow-md">
        <form onSubmit={handleSubmit}>
          {/* Main Input Row */}
          <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
            <div className="relative flex-1 flex items-center">
              <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
              <input
                type="text"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Paste a YouTube, article, or paper URL here..."
                className="w-full pl-10 pr-10 py-3 text-sm bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-900 font-mono text-xs placeholder:font-sans placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              {url && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="absolute right-3 p-1 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isGenerating || !url.trim()}
              className="bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-xs sm:text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] select-none cursor-pointer"
            >
              {isGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Sending...</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4 text-blue-200" />
                  <span>Generate notes</span>
                </>
              )}
            </button>
          </div>

          {/* Depth Mode Selectors */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-2 border-t border-slate-100">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider mr-1">
                DEPTH MODE:
              </span>
              {depthControls.map((control) => (
                <button
                  key={control.mode}
                  type="button"
                  onClick={() => setDepth(control.mode)}
                  className={`px-3 py-1 text-xs rounded-md transition-all font-medium ${
                    depth === control.mode
                      ? "bg-blue-50 text-blue-700 border border-blue-200/80 font-semibold"
                      : "text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-transparent"
                  }`}
                >
                  {control.label}
                </button>
              ))}
            </div>

            <FileText className="hidden sm:block w-3.5 h-3.5 text-slate-300" />
          </div>
        </form>

        {/* Depth Description Callout */}
        <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed">
            {depthDescriptions[depth]}
          </p>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50/80 rounded-xl border border-red-200/80 flex items-start gap-2.5 text-xs text-red-700">
            <HelpCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}
