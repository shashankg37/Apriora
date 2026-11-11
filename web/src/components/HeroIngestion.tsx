"use client";

import React, { useState } from "react";
import { Link2, Sparkles, X, HelpCircle, Info, Loader2 } from "lucide-react";
import { AgentMode, DepthMode } from "@/types";

export interface SourceInput {
  url: string;
  depth: DepthMode;
  agents: AgentMode[];
  transcript?: string;
  title?: string;
}

interface HeroIngestionProps {
  onGenerate: (input: SourceInput) => void;
  isGenerating?: boolean;
  error?: string | null;
}

export function HeroIngestion({ onGenerate, isGenerating = false, error }: HeroIngestionProps) {
  const [mode, setMode] = useState<"link" | "paste">("link");
  const [url, setUrl] = useState("");
  const [transcript, setTranscript] = useState("");
  const [title, setTitle] = useState("");
  const [agents, setAgents] = useState<AgentMode[]>(["essential_notes"]);
  const [depth, setDepth] = useState<DepthMode>("detailed");

  const hasNotesAgent = agents.includes("essential_notes");
  const hasQAAgent = agents.includes("interview_qa");
  // Interview Q&A only runs → depth is irrelevant; recorded as "interview" for the notes badge.
  const effectiveDepth: DepthMode = hasNotesAgent ? depth : "interview";

  const agentDescriptions: Record<AgentMode, string> = {
    essential_notes: "Essential notes: source-grounded breakdown of every topic — what/why/how/when and formulae — plus per-topic interview-prep pointers (30-second answer, trade-offs, failure modes, sample Qs) and a revision card.",
    interview_qa: "Interview Q&A: 10–15 deep technical questions with answers, grounded strictly in the source."
  };
  const description =
    hasNotesAgent && hasQAAgent
      ? `${agentDescriptions.essential_notes} ${agentDescriptions.interview_qa}`
      : hasNotesAgent
        ? agentDescriptions.essential_notes
        : agentDescriptions.interview_qa;

  const toggleAgent = (agent: AgentMode) => {
    setAgents((current) => {
      if (current.includes(agent)) {
        return current.length === 1 ? current : current.filter((a) => a !== agent); // at least one agent stays selected
      }
      return [...current, agent];
    });
  };

  const handleClear = () => {
    setUrl("");
    setTranscript("");
    setTitle("");
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isGenerating || !agents.length) return;
    if (mode === "paste") {
      const text = transcript.trim();
      if (text.length < 100) return; // mirrors the create-note validation
      onGenerate({ url: "", depth: effectiveDepth, agents, transcript: text, title: title.trim() || undefined });
      return;
    }
    if (!url.trim()) return;
    onGenerate({ url: url.trim(), depth: effectiveDepth, agents });
  };

  const agentControls: { mode: AgentMode; label: string }[] = [
    { mode: "essential_notes", label: "Essential notes" },
    { mode: "interview_qa", label: "Interview Q&A" }
  ];

  const depthControls = [
    { mode: "summary" as DepthMode, label: "Summary" },
    { mode: "detailed" as DepthMode, label: "Detailed" }
  ];

  return (
    <section className="pt-6 sm:pt-8 pb-8 sm:pb-10">
      {/* Top Meta Badges */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-5 sm:mb-6">
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
      <div className="max-w-4xl mb-6 sm:mb-8">
        <h1 className="font-serif text-[28px] sm:text-4xl lg:text-[42px] font-normal tracking-tight text-slate-900 leading-[1.15] mb-3 sm:mb-4">
          Compile interview-ready notes from any resource.
        </h1>
        <p className="text-sm sm:text-base text-slate-600 max-w-2xl leading-relaxed">
          Paste a YouTube lecture or an article / paper link below — or paste your own transcript — to compile a clean technical dossier.
        </p>
      </div>

      {/* Ingestion Input Container Card */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-3 sm:p-5 transition-shadow hover:shadow-md">
        <form onSubmit={handleSubmit}>
          {/* Source Mode Toggle */}
          <div className="flex items-center gap-1 mb-3 bg-slate-100/70 border border-slate-200/60 rounded-lg p-1 w-fit">
            {([["link", "Video / article link"], ["paste", "Paste transcript"]] as const).map(([value, label]) => (
              <button
                key={value}
                type="button"
                onClick={() => setMode(value)}
                className={`px-3 py-1.5 text-[11px] sm:text-xs rounded-md transition-all font-medium whitespace-nowrap ${
                  mode === value
                    ? "bg-white text-blue-700 border border-blue-200/80 shadow-xs font-semibold"
                    : "text-slate-600 hover:text-slate-900 border border-transparent"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Main Input Row */}
          {mode === "link" ? (
            <div className="relative flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-4">
              <div className="relative flex-1 flex items-center min-w-0">
                <Link2 className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
                <input
                  type="text"
                  inputMode="url"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Paste a YouTube, article, or paper URL here..."
                  className="w-full pl-10 pr-10 py-3 text-base sm:text-xs bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-900 font-mono placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                />
                {url && (
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear URL"
                    className="absolute right-2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              <button
                type="submit"
                disabled={isGenerating || !url.trim()}
                className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white font-medium text-xs sm:text-sm px-6 py-3 rounded-xl flex items-center justify-center gap-2 shadow-xs transition-all active:scale-[0.99] select-none cursor-pointer"
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
          ) : (
            <div className="flex flex-col gap-2 mb-4">
              <input
                type="text"
                autoCapitalize="none"
                autoCorrect="off"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Title (optional) — e.g. Lecture 4: Distributed consensus"
                className="w-full px-3.5 py-2.5 text-base sm:text-xs bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-900 font-mono placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
              />
              <div className="relative flex-1">
                <textarea
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  spellCheck={false}
                  rows={8}
                  placeholder="Paste the video / lecture transcript here (line breaks and paragraphs are kept)..."
                  className="w-full px-3.5 py-3 text-sm sm:text-xs bg-slate-50/80 hover:bg-slate-50 focus:bg-white border border-slate-200 rounded-xl text-slate-900 placeholder:font-sans placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all resize-y"
                />
                {transcript && (
                  <button
                    type="button"
                    onClick={handleClear}
                    aria-label="Clear transcript"
                    className="absolute right-2 top-2 p-1.5 text-slate-400 hover:text-slate-600 rounded-md transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <span className="font-mono text-[10px] text-slate-400">
                  {transcript.trim().length.toLocaleString()} characters · min 100
                </span>
                <button
                  type="submit"
                  disabled={isGenerating || transcript.trim().length < 100}
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
            </div>
          )}

          {/* Agent Selection */}
          <div className="flex flex-col gap-2.5 pt-3 sm:pt-2 border-t border-slate-100">
            <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
              <span className="font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider sm:mr-1">
                AGENTS TO RUN:
              </span>
              <div className="grid grid-cols-2 sm:flex items-center gap-1 sm:gap-2 bg-slate-100/70 sm:bg-transparent border border-slate-200/60 sm:border-0 rounded-lg p-1 sm:p-0">
                {agentControls.map((control) => {
                  const selected = agents.includes(control.mode);
                  return (
                    <button
                      key={control.mode}
                      type="button"
                      onClick={() => toggleAgent(control.mode)}
                      title="At least one agent must stay selected"
                      className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs rounded-md transition-all font-medium whitespace-nowrap ${
                        selected
                          ? "bg-blue-600 text-white shadow-xs"
                          : "text-slate-600 hover:text-slate-900 hover:bg-slate-200/70 border border-slate-200"
                      }`}
                    >
                      {control.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes style, only relevant when the Essential notes agent runs */}
            {hasNotesAgent && (
              <div className="flex flex-col sm:flex-row sm:items-center gap-1.5 sm:gap-2 w-full sm:w-auto">
                <span className="font-mono text-[10px] uppercase font-bold text-slate-400 tracking-wider sm:mr-1">
                  NOTES STYLE:
                </span>
                <div className="flex items-center gap-1 sm:gap-2">
                  {depthControls.map((control) => (
                    <button
                      key={control.mode}
                      type="button"
                      onClick={() => setDepth(control.mode)}
                      className={`px-2 sm:px-3 py-1.5 text-[11px] sm:text-xs rounded-md transition-all font-medium whitespace-nowrap ${
                        depth === control.mode
                          ? "bg-white sm:bg-blue-50 text-blue-700 border border-blue-200/80 shadow-xs sm:shadow-none font-semibold"
                          : "text-slate-600 hover:text-slate-900 hover:bg-white/70 sm:hover:bg-slate-100 border border-transparent"
                      }`}
                    >
                      {control.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </form>

        {/* Selection Description Callout */}
        <div className="mt-4 p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-blue-900">
          <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
          <p className="leading-relaxed min-w-0">
            {description}
          </p>
        </div>

        {error && (
          <div className="mt-3 p-3 bg-red-50/80 rounded-xl border border-red-200/80 flex items-start gap-2.5 text-xs text-red-700">
            <HelpCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
            <p className="leading-relaxed min-w-0 break-words">{error}</p>
          </div>
        )}
      </div>
    </section>
  );
}
