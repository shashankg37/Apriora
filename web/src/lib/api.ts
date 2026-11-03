import { supabase } from "./supabase";
import { DepthMode, Job, Note } from "@/types";

/* ------------------------------------------------------------------ */
/* Auth                                                                */
/* ------------------------------------------------------------------ */

function friendlyAuthError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("invalid login")) return "Incorrect email or password.";
  if (m.includes("already registered")) return "That email already has an account. Try signing in instead.";
  if (m.includes("at least")) return message;
  return message;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  return error ? friendlyAuthError(error.message) : null;
}

export async function signUp(email: string, password: string): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) return { error: friendlyAuthError(error.message), needsConfirmation: false };
  // No session means the server requires the confirmation email first.
  return { error: null, needsConfirmation: !data.session };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/* ------------------------------------------------------------------ */
/* Notes                                                               */
/* ------------------------------------------------------------------ */

const NOTE_COLUMNS =
  "id, source_id, depth, markdown, essential_notes, interview_qa, model, flags, tags, created_at, sources(title, url, type)";

interface NoteRow {
  id: string;
  source_id: string;
  depth: string;
  markdown: string | null;
  essential_notes?: string | null;
  interview_qa?: unknown;
  model?: string | null;
  flags?: string[] | null;
  tags?: string[] | null;
  created_at: string;
  sources?:
    | {
        title?: string | null;
        url?: string | null;
        type?: string | null;
      }
    | Array<{
        title?: string | null;
        url?: string | null;
        type?: string | null;
      }>
    | null;
}

function mapNote(row: NoteRow): Note {
  const src = Array.isArray(row.sources) ? (row.sources[0] ?? {}) : (row.sources ?? {});
  const url = src.url ?? "";
  let host = "";
  try {
    host = new URL(url).hostname.replace(/^www\./, "");
  } catch {
    host = url;
  }
  return {
    id: row.id,
    source_id: row.source_id,
    title: src.title || host || "Untitled note",
    sourceUrl: url,
    sourceType: src.type === "article" ? "article" : "youtube",
    depth: (row.depth as DepthMode) ?? "detailed",
    markdown: row.markdown ?? "",
    essential_notes: typeof row.essential_notes === "string" ? row.essential_notes : undefined,
    interview_qa:
      typeof row.interview_qa === "string"
        ? row.interview_qa
        : row.interview_qa
          ? JSON.stringify(row.interview_qa, null, 2)
          : undefined,
    model: row.model ?? "",
    flags: row.flags ?? [],
    tags: row.tags ?? [],
    createdAt: row.created_at,
  };
}

export async function fetchNotes(): Promise<Note[]> {
  const { data, error } = await supabase
    .from("notes")
    .select(NOTE_COLUMNS)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []).map(mapNote);
}

/* ------------------------------------------------------------------ */
/* Jobs                                                                */
/* ------------------------------------------------------------------ */

const JOB_COLUMNS =
  "id, url, type, depth, status, stage, progress, note_id, error, created_at, updated_at";

/** Latest job of any status, so the UI can distinguish "done" from "nothing running". */
export async function fetchActiveJob(): Promise<Job | null> {
  const { data, error } = await supabase
    .from("jobs")
    .select(JOB_COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1);
  if (error) throw new Error(error.message);
  return ((data ?? [])[0] as Job) ?? null;
}

async function readFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: Response })?.context;
  if (ctx && typeof ctx.json === "function") {
    try {
      const body = await ctx.json();
      if (body?.error) return body.error;
    } catch {
      /* fall through */
    }
  }
  const message = (error as { message?: string })?.message;
  return message || "Could not create the job.";
}

export async function createNoteJob(url: string, depth: DepthMode): Promise<void> {
  const { error } = await supabase.functions.invoke("create-note", {
    body: { url, depth },
  });
  if (error) throw new Error(await readFunctionError(error));
}

/* ------------------------------------------------------------------ */
/* Formatting                                                          */
/* ------------------------------------------------------------------ */

export function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const diffMs = Date.now() - date.getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
  });
}

/** Locale-stable, prerender-safe date label (absolute, no dependency on Date.now()). */
export function stableDateLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";
  const thisYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    ...(thisYear ? {} : { year: "numeric" }),
  });
}
