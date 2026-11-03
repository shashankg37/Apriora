"use client";

import React, { useState } from "react";
import { Note } from "@/types";
import { TimeAgo } from "@/components/TimeAgo";
import {
  FileText,
  Video,
  ExternalLink,
  Copy,
  Check,
  Eye,
  Loader2,
} from "lucide-react";

interface NotesTableProps {
  notes: Note[];
  onSelectNote: (note: Note) => void;
  isLoading?: boolean;
  error?: string | null;
}

export function NotesTable({ notes, onSelectNote, isLoading = false, error }: NotesTableProps) {
  const [filter, setFilter] = useState<"all" | "articles" | "lectures">("all");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filteredNotes = notes.filter((note) => {
    if (filter === "articles") return note.sourceType === "article";
    if (filter === "lectures") return note.sourceType === "youtube";
    return true;
  });

  const handleCopy = (e: React.MouseEvent, note: Note) => {
    e.stopPropagation();
    navigator.clipboard.writeText(note.markdown);
    setCopiedId(note.id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const getDepthBadge = (depth: string) => {
    switch (depth) {
      case "summary":
        return "bg-slate-100 text-slate-700 border-slate-200";
      case "detailed":
        return "bg-blue-50 text-blue-700 border-blue-200/80";
      case "interview":
        return "bg-amber-50 text-amber-700 border-amber-200/80";
      default:
        return "bg-slate-100 text-slate-700 border-slate-200";
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Table Section Header */}
      <div className="p-5 sm:p-6 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="font-mono text-[11px] text-blue-600 font-medium tracking-wider uppercase mb-1">
            LIBRARY / {notes.length} {notes.length === 1 ? "note" : "notes"}
          </div>
          <h2 className="font-serif text-xl sm:text-2xl font-normal text-slate-900 tracking-tight">
            Your compiled notes
          </h2>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1 bg-slate-100/70 p-1 rounded-lg border border-slate-200/50 self-start sm:self-center">
          {([
            { key: "all", label: "All Types" },
            { key: "articles", label: "Articles" },
            { key: "lectures", label: "Lectures" },
          ] as const).map((pill) => (
            <button
              key={pill.key}
              onClick={() => setFilter(pill.key)}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filter === pill.key
                  ? "bg-white text-slate-900 shadow-xs"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {pill.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <div className="p-10 text-center">
          <p className="text-sm text-red-600">{error}</p>
          <p className="text-xs text-slate-400 mt-1">Refresh the page to try again.</p>
        </div>
      ) : isLoading ? (
        <div className="p-10 flex items-center justify-center gap-2 text-xs text-slate-400 font-mono">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span>Loading your notes…</span>
        </div>
      ) : notes.length === 0 ? (
        <div className="p-12 text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <FileText className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="font-serif text-lg text-slate-900">No notes yet</h3>
          <p className="text-xs text-slate-500 mt-1">
            Paste a link above to generate your first note.
          </p>
        </div>
      ) : (
        <>
          {/* Responsive Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60 font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                  <th className="py-3 px-6 font-semibold">RESOURCE &amp; TITLE</th>
                  <th className="py-3 px-4 font-semibold">DEPTH MODE</th>
                  <th className="py-3 px-4 font-semibold">CREATED</th>
                  <th className="py-3 px-6 font-semibold text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
                {filteredNotes.map((note) => (
                  <tr
                    key={note.id}
                    onClick={() => onSelectNote(note)}
                    className="hover:bg-slate-50/80 cursor-pointer transition-colors group"
                  >
                    {/* Resource & Title */}
                    <td className="py-4 px-6 max-w-md">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-slate-100 group-hover:bg-blue-50 text-slate-600 group-hover:text-blue-600 transition-colors mt-0.5 shrink-0">
                          {note.sourceType === "youtube" ? (
                            <Video className="w-4 h-4" />
                          ) : (
                            <FileText className="w-4 h-4" />
                          )}
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors line-clamp-1 text-sm">
                            {note.title}
                          </div>
                          <div className="font-mono text-[11px] text-slate-400 mt-0.5 line-clamp-1">
                            {note.sourceUrl || note.model}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Depth Mode */}
                    <td className="py-4 px-4 whitespace-nowrap">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-mono border font-medium capitalize ${getDepthBadge(
                          note.depth
                        )}`}
                      >
                        {note.depth === "interview" ? "Interview Q&A" : note.depth}
                      </span>
                    </td>

                    {/* Created */}
                    <td className="py-4 px-4 whitespace-nowrap font-mono text-[11px] text-slate-500">
                      <TimeAgo iso={note.createdAt} />
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-6 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          type="button"
                          title="View note"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectNote(note);
                          }}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          title="Copy Markdown"
                          onClick={(e) => handleCopy(e, note)}
                          className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
                        >
                          {copiedId === note.id ? (
                            <Check className="w-4 h-4 text-emerald-600" />
                          ) : (
                            <Copy className="w-4 h-4" />
                          )}
                        </button>
                        {note.sourceUrl && (
                          <a
                            href={note.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            title="Open Source Link"
                            onClick={(e) => e.stopPropagation()}
                            className="p-1.5 text-slate-400 hover:text-slate-800 hover:bg-slate-200/60 rounded-md transition-colors"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Table Footer */}
          <div className="p-4 bg-slate-50/50 border-t border-slate-100 text-xs text-slate-400 font-mono">
            Showing {filteredNotes.length} of {notes.length} {notes.length === 1 ? "note" : "notes"}
          </div>
        </>
      )}
    </div>
  );
}
