"use client";

import React, { useState } from "react";
import { Note } from "@/types";
import { TimeAgo } from "@/components/TimeAgo";
import {
  X,
  Copy,
  Check,
  ExternalLink,
  FileText,
  BookOpen,
  HelpCircle,
  Download,
} from "lucide-react";

interface NoteDetailProps {
  note: Note;
  onClose?: () => void;
}

type NoteTab = "all" | "essential" | "qa";

export function NoteDetail({ note, onClose }: NoteDetailProps) {
  const [activeTab, setActiveTab] = useState<NoteTab>("all");
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(note.markdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (content: string, name: string) => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name.replace(/[^a-z0-9]/gi, "_").toLowerCase()}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const tabs: { key: NoteTab; label: string; icon: React.ReactNode; content?: string }[] = [
    { key: "all", label: "Full Note", icon: <FileText className="w-3.5 h-3.5" />, content: note.markdown },
    { key: "essential", label: "Essential Notes", icon: <BookOpen className="w-3.5 h-3.5" />, content: note.essential_notes },
    { key: "qa", label: "Interview Q&A", icon: <HelpCircle className="w-3.5 h-3.5" />, content: note.interview_qa },
  ];
  const activeTabDef = tabs.find((t) => t.key === activeTab)!;

  let host = note.sourceUrl;
  try {
    host = note.sourceUrl ? new URL(note.sourceUrl).hostname.replace(/^www\./, "") : "";
  } catch {
    /* keep raw url */
  }

  const hasContent = Boolean(activeTabDef.content?.trim());

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden my-4">
      {/* Top Banner / Actions */}
      <div className="p-6 border-b border-slate-100 bg-slate-50/50 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            <span className="font-mono text-[10px] uppercase font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
              {note.depth === "interview" ? "INTERVIEW Q&A" : `${note.depth} NOTE`}
            </span>
            <span className="font-mono text-[10px] uppercase text-slate-500">
              <TimeAgo iso={note.createdAt} />
            </span>
            <span className="text-slate-300">·</span>
            <span className="font-mono text-[10px] text-slate-500 capitalize">
              {note.sourceType === "youtube" ? "YouTube" : "Article"}
            </span>
          </div>

          <h2 className="font-serif text-2xl sm:text-3xl font-normal text-slate-900 tracking-tight">
            {note.title}
          </h2>

          {note.sourceUrl && (
            <div className="flex items-center gap-2 mt-2 text-xs text-slate-500">
              <span>Source:</span>
              <a
                href={note.sourceUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-1 font-mono text-[11px]"
              >
                {host} <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleCopy}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? "Copied" : "Copy"}</span>
          </button>

          <button
            onClick={() => handleDownload(activeTabDef.content ?? "", note.title || "note")}
            disabled={!hasContent}
            className="px-3 py-1.5 text-xs font-medium rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 flex items-center gap-1.5 transition-colors shadow-2xs disabled:opacity-60"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export .md</span>
          </button>

          {onClose && (
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 border-b border-slate-200 bg-white flex items-center gap-4 text-xs font-medium overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`py-3 border-b-2 transition-all flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Note Body */}
      <div className="p-6 sm:p-8 space-y-6">
        {hasContent ? (
          <div className="rounded-xl overflow-x-auto">
            <pre className="p-4 bg-slate-950 text-slate-100 !rounded-xl font-mono text-xs leading-relaxed whitespace-pre-wrap">
              {activeTabDef.content}
            </pre>
          </div>
        ) : (
          <div className="py-14 text-center">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
              {activeTabDef.icon}
            </div>
            <h3 className="font-serif text-lg text-slate-900">Nothing here yet</h3>
            <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto leading-relaxed">
              {activeTab === "essential"
                ? "The Essential Notes agent didn't produce content for this note."
                : activeTab === "qa"
                  ? "The Interview Q&A agent didn't produce content for this note."
                  : "This note is empty."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
