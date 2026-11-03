// createNote: authenticate, validate, create the job row, enqueue to pgmq only.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const noteDepth = (depth: string) => ["summary", "detailed", "interview"].includes(depth) ? depth : null;
const isUrl = (url: string) => { try { const u = new URL(url); return u.protocol === "http:" || u.protocol === "https:"; } catch { return false; } };

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", {
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
        "Access-Control-Allow-Methods": "POST",
      },
    });
  }
  try {
    const authClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: req.headers.get("Authorization") ?? "" } } },
    );
    const { data: { user }, error: authError } = await authClient.auth.getUser();
    if (authError || !user) {
      return Response.json({ error: "Sign in before creating notes." }, { status: 401 });
    }

    const { url, depth = "detailed" } = await req.json();
    if (!isUrl(url)) return Response.json({ error: "Enter a valid http(s) link." }, { status: 400 });
    if (!noteDepth(depth)) return Response.json({ error: "Invalid note depth." }, { status: 400 });

    const type = new URL(url).hostname.endsWith("youtube.com") || new URL(url).hostname === "youtu.be" ? "youtube" : "article";

    const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const { data: job, error: insertError } = await admin
      .from("jobs")
      .insert({ owner_id: user.id, url, type, depth })
      .select("id")
      .single();
    if (insertError) throw insertError;

    await admin.rpc("enqueue_note_job", { payload: { jobId: job.id } });
    return Response.json({ jobId: job.id });
  } catch (error) {
    console.error(error);
    return Response.json({ error: "Could not create the job." }, { status: 500 });
  }
});
