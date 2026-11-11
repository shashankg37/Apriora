"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Terminal, BookOpen } from "lucide-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";
import { HeroIngestion } from "@/components/HeroIngestion";
import { NotesTable } from "@/components/NotesTable";
import { ProcessingView } from "@/components/ProcessingView";
import { NoteDetail } from "@/components/NoteDetail";
import { AuthView } from "@/components/AuthView";
import { createNoteJob, fetchActiveJob, fetchNotes, signOut } from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import { buildPreviewData, UI_PREVIEW } from "@/lib/uiPreview";
import { SourceInput } from "@/components/HeroIngestion";
import { Job, Note } from "@/types";

type MainTab = "home" | "processing" | "note-view" | "library";

/** A failed job stays highlighted briefly so the run still shows its error. */
const RECENT_JOB_MS = 30 * 60 * 1000;

export default function Home() {
  /* ------------------------------- state ------------------------------ */
  const [authReady, setAuthReady] = useState(UI_PREVIEW);
  const [signedIn, setSignedIn] = useState(false);
  const [userEmail, setUserEmail] = useState<string | undefined>(undefined);

  const [notes, setNotes] = useState<Note[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const justFinishedRef = useRef(false);

  const [activeJob, setActiveJob] = useState<Job | null>(null);
  const jobId = activeJob?.id ?? null;
  const jobStatus = activeJob?.status ?? null;

  const [activeTab, setActiveTab] = useState<MainTab>("home");
  const [selectedNote, setSelectedNote] = useState<Note | null>(null);

  const [isGenerating, setIsGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [forceAuth, setForceAuth] = useState(false); // UI-preview only
  const [previewData, setPreviewData] = useState<{ notes: Note[]; job: Job } | null>(null);

  /* -------------------- materialize preview sample data ----------------- */
  useEffect(() => {
    if (!UI_PREVIEW) return;
    const id = requestAnimationFrame(() => {
      setPreviewData(buildPreviewData());
    });
    return () => cancelAnimationFrame(id);
  }, []);

  /* ------------------------------- auth ------------------------------- */
  useEffect(() => {
    if (UI_PREVIEW) return; // signed-in walkthrough is forced below
    if (!isSupabaseConfigured) return;

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        setSignedIn(Boolean(session));
        setUserEmail(session?.user.email ?? undefined);
        setAuthReady(true);
      })
      .catch(() => setAuthReady(true));

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedIn(Boolean(session));
      setUserEmail(session?.user.email ?? undefined);
      setAuthReady(true);
    });
    return () => subscription.unsubscribe();
  }, []);

  /* --------------------------- data loading --------------------------- */
  useEffect(() => {
    if (!signedIn || UI_PREVIEW) return;
    let alive = true;

    const load = async () => {
      setNotesLoading(true);
      setNotesError(null);
      try {
        const [fetchedNotes, latest] = await Promise.all([fetchNotes(), fetchActiveJob()]);

        if (latest) {
          if (latest.status === "completed") {
            setActiveJob(null);
            if (justFinishedRef.current) {
              justFinishedRef.current = false;
              const finished = latest.note_id
                ? fetchedNotes.find((n) => n.id === latest.note_id)
                : undefined;
              if (finished) {
                setSelectedNote(finished);
                setActiveTab("note-view");
              }
            }
          } else {
            const recent =
              Date.now() - new Date(latest.updated_at).getTime() < RECENT_JOB_MS;
            if (
              latest.status === "queued" ||
              latest.status === "processing" ||
              (latest.status === "failed" && recent)
            ) {
              setActiveJob(latest);
            } else {
              setActiveJob(null);
            }
          }
        } else {
          setActiveJob(null);
        }

        setNotes(fetchedNotes);
      } catch (e) {
        if (alive) setNotesError(e instanceof Error ? e.message : "Could not load your notes.");
      } finally {
        if (alive) setNotesLoading(false);
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, [signedIn, refreshKey]);

  /* -------------------- poll the running pipeline job ------------------ */
  useEffect(() => {
    if (!signedIn || UI_PREVIEW) return;

    const timer = setInterval(() => {
      void (async () => {
        try {
          const job = await fetchActiveJob();
          if (!job) {
            justFinishedRef.current = false;
            setActiveJob(null);
            return;
          }
          if (job.status === "completed") {
            justFinishedRef.current = true;
            setActiveJob(null);
            setRefreshKey((k) => k + 1); // load() picks up the finished note
          } else {
            setActiveJob(job);
          }
        } catch {
          /* transient errors: keep polling */
        }
      })();
    }, 4000);
    return () => clearInterval(timer);
  }, [signedIn, jobId, jobStatus]);

  /* ------------------------------ actions ------------------------------ */
  const handleGenerate = useCallback(async (input: SourceInput) => {
    if (UI_PREVIEW) {
      if (previewData) setActiveJob(previewData.job);
      setActiveTab("processing");
      return;
    }
    setIsGenerating(true);
    setGenerateError(null);
    try {
      await createNoteJob(input);
      const job = await fetchActiveJob();
      if (job) setActiveJob(job);
      setRefreshKey((k) => k + 1);
      setActiveTab("processing");
    } catch (e) {
      setGenerateError(e instanceof Error ? e.message : "Could not create the job. Try again.");
    } finally {
      setIsGenerating(false);
    }
  }, [previewData]);

  const handleSelectNote = useCallback((note: Note) => {
    setSelectedNote(note);
    setActiveTab("note-view");
  }, []);

  const handleSignOut = useCallback(async () => {
    if (UI_PREVIEW) {
      setForceAuth(true);
      return;
    }
    await signOut();
    setNotes([]);
    setActiveJob(null);
    setSelectedNote(null);
    setActiveTab("home");
  }, []);

  /* --------------------------- gated renders --------------------------- */
  if (!isSupabaseConfigured && !UI_PREVIEW) {
    return <SetupNotice />;
  }

  if (!authReady) {
    return (
      <div className="min-h-dvh flex items-center justify-center bg-[#fbfcfd]">
        <Loader2 className="w-5 h-5 text-blue-600 animate-spin" />
      </div>
    );
  }

  if (!signedIn && !UI_PREVIEW) {
    return <AuthView />;
  }

  if (UI_PREVIEW && forceAuth) {
    return <AuthView previewExit={() => setForceAuth(false)} />;
  }

  /* render note view only if a note is selected; else fall back home */
  const displayTab: MainTab =
    activeTab === "note-view" && !selectedNote ? "home" : activeTab;

  const displayNotes = UI_PREVIEW ? (previewData?.notes ?? []) : notes;
  const displayJob = UI_PREVIEW ? (previewData?.job ?? activeJob) : activeJob;

  return (
    <div className="min-h-dvh flex flex-col bg-[#fbfcfd] text-slate-900 selection:bg-blue-100 selection:text-blue-900">
      {UI_PREVIEW && (
        <div className="w-full bg-amber-50 border-b border-amber-200 text-amber-900 text-[11px] font-mono px-4 sm:px-6 lg:px-8 py-1.5 flex flex-col sm:flex-row sm:items-center justify-between gap-1 sm:gap-3">
          <span className="min-w-0">
            UI WALKTHROUGH — sample data, not connected to the backend
          </span>
          <button
            type="button"
            onClick={() => setForceAuth(true)}
            className="text-amber-700 hover:text-amber-900 hover:underline shrink-0 cursor-pointer text-left"
          >
            sign-in screen →
          </button>
        </div>
      )}
      <Navbar
        activeTab={displayTab}
        setActiveTab={setActiveTab}
        hasActiveJob={Boolean(displayJob)}
        userEmail={UI_PREVIEW ? "you@example.com" : userEmail}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8">
        {/* TAB: HOME */}
        {displayTab === "home" && (
          <div className="space-y-6">
            <HeroIngestion
              onGenerate={handleGenerate}
              isGenerating={isGenerating}
              error={generateError}
            />
            <NotesTable
              notes={displayNotes}
              onSelectNote={handleSelectNote}
              isLoading={notesLoading}
              error={notesError}
            />
          </div>
        )}

        {/* TAB: PROCESSING */}
        {displayTab === "processing" && (
          <ProcessingView job={displayJob} onBackHome={() => setActiveTab("home")} />
        )}

        {/* TAB: NOTE VIEW */}
        {displayTab === "note-view" && selectedNote && (
          <div className="py-4 sm:py-6">
            <NoteDetail note={selectedNote} onClose={() => setActiveTab("home")} />
          </div>
        )}

        {/* TAB: LIBRARY */}
        {displayTab === "library" && (
          <div className="py-6 sm:py-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
              <div className="min-w-0">
                <span className="font-mono text-[10px] text-blue-600 font-semibold tracking-wider uppercase">
                  YOUR VAULT
                </span>
                <h1 className="font-serif text-2xl sm:text-3xl font-normal text-slate-900 tracking-tight">
                  All compiled notes
                </h1>
              </div>

              <div className="flex items-center gap-2 font-mono text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs w-fit">
                <BookOpen className="w-3.5 h-3.5 text-blue-600" />
                <span>
                  {displayNotes.length} {displayNotes.length === 1 ? "note" : "notes"} indexed
                </span>
              </div>
            </div>

            <NotesTable
              notes={displayNotes}
              onSelectNote={handleSelectNote}
              isLoading={notesLoading}
              error={notesError}
            />
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}

/** Shown before the Supabase keys are configured in web/.env.local. */
function SetupNotice() {
  return (
    <div className="min-h-dvh flex flex-col bg-[#fbfcfd] text-slate-900">
      <div className="flex-1 flex items-center justify-center px-4 py-10 sm:py-16">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-6 sm:p-8 max-w-md w-full text-center">
          <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center mx-auto mb-3">
            <Terminal className="w-5 h-5 text-blue-400" />
          </div>
          <h1 className="font-serif text-xl text-slate-900 mb-2">Setup required</h1>
          <p className="text-xs text-slate-500 leading-relaxed mb-4">
            Set your project keys in <span className="font-mono text-slate-700">web/.env.local</span>{" "}
            and restart the dev server:
          </p>
          <pre className="text-left bg-slate-950 text-slate-100 rounded-xl p-4 font-mono text-[11px] leading-relaxed overflow-x-auto whitespace-pre-wrap">
            {"NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key"}
          </pre>
        </div>
      </div>
    </div>
  );
}
