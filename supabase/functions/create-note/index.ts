// createNote: authenticate, validate, create the job row, enqueue to pgmq only.
// Two acquisition paths: a fetchable URL (youtube/article) or a user-pasted transcript.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const noteDepth = (depth: string) => ["summary", "detailed", "interview"].includes(depth) ? depth : null;
const AGENT_NAMES = ["essential_notes", "interview_qa"];
// agents: array of agent names to run; absent → derived from depth (legacy "interview" depth means Q&A only).
const resolveAgents = (raw: unknown, depth: string): string[] =>
  Array.isArray(raw) ? [...new Set(raw.filter((a): a is string => typeof a === "string" && AGENT_NAMES.includes(a)))]
    .sort((a, b) => AGENT_NAMES.indexOf(a) - AGENT_NAMES.indexOf(b))
    : depth === "interview" ? ["interview_qa"] : AGENT_NAMES;
const isUrl = (url: string) => { try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };
const MAX_TRANSCRIPT_CHARS = 500_000; // matches the jobs.transcript check constraint

// Browsers need ACAO on every response; supabase.functions.invoke surfaces
// "Failed to send a request to the Edge Function" instead of our error server-side otherwise.
const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (data: unknown, status: number) => Response.json(data, { status, headers: cors });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }
  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return json({ error: "Sign in before creating notes." }, 401);
    }

    const { url, depth = "detailed", transcript, title, agents } = await req.json();
    if (!noteDepth(depth)) return json({ error: "Invalid note depth." }, 400);
    const jobAgents = resolveAgents(agents, depth);
    if (!jobAgents.length) return json({ error: "Select at least one agent to run." }, 400);

    // A pasted transcript stands on its own; a URL path keeps the youtube/article detection.
    const pasted = typeof transcript === "string" ? transcript.trim() : "";
    if (pasted) {
      if (pasted.length < 100) return json({ error: "The transcript looks too short to build notes from (at least 100 characters)." }, 400);
      if (pasted.length > MAX_TRANSCRIPT_CHARS) return json({ error: `The transcript is too long (${MAX_TRANSCRIPT_CHARS.toLocaleString()} characters max).` }, 400);
    } else {
      if (!isUrl(url)) return json({ error: "Enter a valid http(s) link, or paste a transcript." }, 400);
    }

    const job = pasted
      ? { owner_id: user.id, url: "", type: "transcript", depth, agents: jobAgents, transcript: pasted, title: typeof title === "string" && title.trim() ? title.trim().slice(0, 200) : "Pasted transcript" }
      : { owner_id: user.id, url, type: new URL(url).hostname.endsWith("youtube.com") || new URL(url).hostname === "youtu.be" ? "youtube" : "article", depth, agents: jobAgents };

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: row, error: insertError } = await admin
      .from("jobs")
      .insert(job)
      .select("id")
      .single();
    if (insertError) throw insertError;

    await admin.rpc("enqueue_note_job", { payload: { jobId: row.id } });
    return json({ jobId: row.id }, 200);
  } catch (error) {
    console.error(error);
    return json({ error: "Could not create the job." }, 500);
  }
});
