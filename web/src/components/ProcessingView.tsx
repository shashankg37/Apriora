"use client";

import React from "react";
import {
  CheckCircle2,
  CircleDot,
  Clock,
  AlertTriangle,
  XOctagon,
  ExternalLink,
  Video,
  FileText,
  ArrowRight,
  Layers,
} from "lucide-react";
import { Job } from "@/types";
import { TimeAgo } from "@/components/TimeAgo";

interface ProcessingViewProps {
  job: Job | null;
  onBackHome: () => void;
}

/**
 * A step is "done" once the worker has progressed past the progress value the
 * pipeline checkpointer writes for it:
 *  30  transcript ready  →  45 agents started  →  90 composing  →  100 completed
 */
const PIPELINE_STEPS = [
  {
    label: "Fetch & transcribe source",
    description: "Acquire the transcript with youtube-transcript-api and normalize it.",
    doneAt: 30,
  },
  {
    label: "Index transcript chunks",
    description: "Chunk the transcript and build the per-job ChromaDB retrieval collection.",
    doneAt: 45,
  },
  {
    label: "Run analysis agents",
    description: "Essential Notes and Interview Q&A agents retrieve aspect-targeted chunks and draft content.",
    doneAt: 90,
  },
  {
    label: "Compose final note",
    description: "Merge the agent outputs into the compiled markdown note.",
    doneAt: 101,
  },
] as const;

type StepState = "done" | "active" | "queued" | "error";

export function ProcessingView({ job, onBackHome }: ProcessingViewProps) {
  /* ---------------------------------------------------------------- */
  /* Empty state: nothing running                                      */
  /* ---------------------------------------------------------------- */
  if (!job) {
    return (
      <div className="pt-10 pb-20 flex items-center justify-center">
        <div className="bg-white rounded-2xl border border-slate-200 shadow-xs p-8 sm:p-12 text-center max-w-md w-full">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center mx-auto mb-3">
            <Layers className="w-5 h-5 text-slate-400" />
          </div>
          <h3 className="font-serif text-lg text-slate-900">No job running</h3>
          <p className="text-xs text-slate-500 mt-1 mb-5">
            Paste a link on the home page and the pipeline run will show up here.
          </p>
          <button
            type="button"
            onClick={onBackHome}
            className="px-3 py-1.5 text-xs bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-1.5 mx-auto transition-colors shadow-xs font-medium cursor-pointer"
          >
            <span>Generate a note</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-200" />
          </button>
        </div>
      </div>
    );
  }

  const progress = job.progress ?? 0;
  const isActive = job.status === "queued" || job.status === "processing";
  const failed = job.status === "failed";

  const stepStates: StepState[] = PIPELINE_STEPS.map(
    ({ doneAt }, index): StepState => {
      if (progress >= doneAt && !(doneAt === 101 && job.status !== "completed")) {
        return "done";
      }
      const previous = index === 0 || PIPELINE_STEPS[index - 1].doneAt <= progress;
      if (failed && previous) return "error";
      if (previous && isActive) return "active";
      return "queued";
    }
  );

  const headerBadge =
    job.status === "completed"
      ? "COMPLETED"
      : failed
        ? "FAILED"
        : job.status === "queued"
          ? "QUEUED"
          : `PROCESSING`;

  return (
    <div className="pt-4 pb-14 space-y-6">
      {/* Top Status & Meta Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-200">
        <div className="flex flex-wrap items-center gap-2.5 min-w-0">
          <span
            className={`font-mono text-[11px] font-semibold px-2 py-0.5 rounded ${
              failed
                ? "text-red-700 bg-red-50 border border-red-200"
                : "text-slate-500 bg-slate-100 border border-slate-200"
            }`}
          >
            {headerBadge}
          </span>
          <h1 className="font-serif text-xl sm:text-2xl font-normal text-slate-900 tracking-tight ml-1 break-words">
            {job.type === "transcript" ? "Pasted transcript" : job.type === "youtube" ? "YouTube" : "Article"} · {job.depth === "interview" ? "Interview Q&A" : job.depth === "detailed" ? "Detailed" : "Summary"}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 font-mono text-xs text-slate-500 bg-white border border-slate-200 px-3 py-1.5 rounded-lg shadow-2xs">
            <Clock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>
              Started <TimeAgo iso={job.created_at} />
            </span>
          </div>
        </div>
      </div>

      {/* Source Card */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-4 sm:gap-5">
        <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full">
          {/* Type badge */}
          <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-slate-900 border border-slate-800 shadow-xs flex items-center justify-center shrink-0">
            {job.type === "youtube" ? (
              <Video className="w-5 h-5 text-blue-400" />
            ) : (
              <FileText className="w-5 h-5 text-blue-400" />
            )}
          </div>

          <div className="min-w-0">
            <div className="font-mono text-[10px] text-slate-400 uppercase tracking-wider mb-1 flex items-center gap-2">
              <span>SOURCE RESOURCE</span>
              {job.url && (
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="text-blue-600 hover:underline flex items-center gap-0.5"
                >
                  Open link <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
            <h3 className="font-semibold text-sm sm:text-base text-slate-900 line-clamp-1 break-all">
              {job.title || job.url || "Pasted transcript"}
            </h3>
          </div>
        </div>
      </div>

      {/* Failure alert */}
      {failed && job.error && (
        <div className="bg-red-50/80 border border-red-200 rounded-2xl p-5 shadow-xs">
          <div className="flex items-center gap-2 text-red-800 font-semibold text-xs mb-2">
            <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
            <span>The pipeline run failed</span>
          </div>
          <p className="text-xs text-red-900/80 leading-relaxed break-words">{job.error}</p>
          <button
            type="button"
            onClick={onBackHome}
            className="mt-4 px-3 py-1.5 text-xs font-medium rounded-lg bg-blue-600 hover:bg-blue-700 text-white transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
          >
            <span>Back to home</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-200" />
          </button>
        </div>
      )}

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left: pipeline steps */}
        <div className="lg:col-span-7">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 shadow-xs">
            <div className="flex items-center justify-between mb-6 pb-3 border-b border-slate-100">
              <div>
                <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider">
                  PIPELINE RUN
                </span>
                <h3 className="font-serif text-lg font-normal text-slate-900">
                  What&apos;s happening now
                </h3>
              </div>
              <span className="font-mono text-xs font-medium text-blue-600 bg-blue-50 border border-blue-200 px-2.5 py-1 rounded-md">
                {progress}%
              </span>
            </div>

            {/* Progress bar */}
            <div className="flex items-center gap-3 mb-8">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 rounded-full transition-all duration-700"
                  style={{ width: `${Math.min(100, progress)}%` }}
                />
              </div>
              <span className="font-mono text-[11px] text-slate-500 shrink-0">
                {Math.min(100, progress)}%
              </span>
            </div>

            {/* Steps Vertical List */}
            <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-3 before:bottom-3 before:w-0.5 before:bg-slate-200">
              {PIPELINE_STEPS.map((step, index) => {
                const state = stepStates[index];
                const isDone = state === "done";
                const isActiveStep = state === "active";
                const hasError = state === "error";

                return (
                  <div key={step.label} className="relative group">
                    {/* Circle Node */}
                    <div
                      className={`absolute -left-6 top-0.5 w-5 h-5 rounded-full flex items-center justify-center transition-all ${
                        isDone
                          ? "bg-blue-600 text-white shadow-2xs"
                          : isActiveStep
                            ? "bg-white border-2 border-blue-600 text-blue-600 shadow-xs ring-4 ring-blue-100"
                            : hasError
                              ? "bg-white border-2 border-red-500 text-red-500"
                              : "bg-white border border-slate-300 text-slate-300"
                      }`}
                    >
                      {isDone ? (
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      ) : isActiveStep && job.status === "processing" ? (
                        <CircleDot className="w-3 h-3 animate-pulse" />
                      ) : hasError ? (
                        <XOctagon className="w-3 h-3" />
                      ) : (
                        <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                      )}
                    </div>

                    {/* Step Header */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="font-mono text-xs font-bold text-slate-900">
                          {String(index + 1).padStart(2, "0")}. {step.label}
                        </span>
                        {isActiveStep && job.status === "processing" && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-600 text-white font-mono text-[9px] font-bold uppercase tracking-wider animate-pulse">
                            IN PROGRESS
                          </span>
                        )}
                        {isDone && (
                          <span className="px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200/80 font-mono text-[9px] font-bold uppercase tracking-wider">
                            DONE
                          </span>
                        )}
                      </div>
                    </div>

                    <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                      {index === 0 && job.type === "transcript"
                        ? "Use the user-pasted transcript supplied with the job row."
                        : step.description}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Current worker stage (raw, from the jobs table) */}
            {isActive && job.stage && (
              <div className="mt-8 pt-4 border-t border-slate-100 flex items-center justify-between font-mono text-[11px] text-slate-500">
                <span>Current stage</span>
                <span className="text-blue-700 font-semibold">{job.stage}</span>
              </div>
            )}
          </div>
        </div>

        {/* Right: job details */}
        <div className="lg:col-span-5">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-xs">
            <div className="mb-4 pb-2 border-b border-slate-100">
              <span className="font-mono text-[10px] text-slate-400 uppercase tracking-wider font-bold">
                JOB DETAILS
              </span>
            </div>

            <div className="space-y-4 text-xs">
              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-mono text-[10px] uppercase">Type</span>
                <span className="font-semibold text-slate-800 capitalize">{job.type}</span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-mono text-[10px] uppercase">Depth</span>
                <span className={`font-semibold text-slate-800 ${job.depth === "interview" ? "" : "capitalize"}`}>
                  {job.depth === "interview" ? "Interview Q&A" : job.depth}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-mono text-[10px] uppercase">Status</span>
                <span className={`font-mono text-[11px] font-medium ${failed ? "text-red-600" : "text-blue-700"}`}>
                  {headerBadge}
                </span>
              </div>

              <div className="flex items-center justify-between gap-3">
                <span className="text-slate-400 font-mono text-[10px] uppercase">Started</span>
                <span className="font-mono text-[11px] text-slate-700">
                  <TimeAgo iso={job.created_at} />
                </span>
              </div>

              <div className="flex items-start justify-between gap-3">
                <span className="text-slate-400 font-mono text-[10px] uppercase shrink-0">Source</span>
                <a
                  href={job.url}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-[11px] text-blue-600 hover:underline break-all text-right line-clamp-2"
                >
                  {job.url}
                </a>
              </div>
            </div>

            <p className="mt-6 pt-4 border-t border-slate-100 text-[11px] text-slate-400 leading-relaxed">
              The run executes in the background. When it finishes, the note appears in your library automatically.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
