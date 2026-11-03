# IntervNotes backend MVP

`Supabase Edge Function → pgmq queue → FastAPI pipeline worker → LangChain transcription → LangGraph agents → Supabase Postgres`

The backend generates source-grounded interview notes from YouTube and article URLs. Supabase handles all backend duties: Auth, the Postgres tables with RLS, job creation via a thin Edge Function, and direct client reads of `jobs`/`notes` under owner-scoped RLS. FastAPI exists only to run the AI pipeline: it polls the `note-jobs` pgmq queue and executes transcription, chunking, retrieval, and LangGraph agent orchestration. A standalone LangChain chain first turns the complete resource into one `TranscriptResource`. That transcript is then chunked and indexed in a per-job ChromaDB collection; the Essential Notes and Interview Q&A agents each retrieve the most relevant chunks by information aspect instead of consuming the full source. It uses Groq `qwen/qwen3.8-27b`; YouTube captions are retrieved with `youtube-transcript-api==1.2.4`. Audio downloading and Whisper are not part of this project.

## Layout

- `supabase/`: SQL migrations (schema, RLS, pgmq queue) and the thin Deno Edge Function. `create-note` authenticates, validates, inserts the job row, and enqueues; nothing else. Clients read `jobs`/`notes` directly with the anon key under RLS.
- `worker/app.py`: FastAPI pipeline executor — polls pgmq, runs the pipeline; no user-facing endpoints.
- `worker/transcription/`: standalone LangChain resource-to-transcript pipeline.
- `worker/services/vector_store.py`: per-job chunk index in ChromaDB (ephemeral, in-memory).
- `worker/agents/`: Essential Notes and Interview Q&A agents.
- `worker/pipeline/`: LangGraph fan-out/fan-in orchestration for the two agents.
- `worker/cli.py`: runs a one-off job without the queue.
- `demo/`: local Streamlit harness for testing the actual transcript pipeline and agents without Supabase.
- `docs/`: `PRD.md` (product decisions) and `PROJECT_GUIDE.md` — **start here** if you're new; a detailed file-by-file walkthrough of the project with a recommended reading order.
- `web/`: intentionally deferred; no frontend is implemented.

## Configure and run

1. Create a Supabase project; run the migration in `supabase/migrations/0001_init.sql` (enables pgmq, creates tables, RLS policies, and the `note-jobs` queue).
2. Deploy the Edge Function from `supabase/functions/` with `supabase functions deploy` and `supabase secrets set` from `supabase/.env.example` values.
3. Copy `worker/.env.example` to `worker/.env`; set `GROQ_API_KEY`, `SUPABASE_URL`, and the service role `SUPABASE_SERVICE_ROLE_KEY`. Worker hosting is an open decision; any Python host able to reach the Supabase REST endpoint works.

```powershell
python -m pip install -r worker/requirements.txt
cd worker; uvicorn app:app --reload
```

Clients create notes through the `create-note` Edge Function (answers `{jobId}`) and follow `jobs.status`/`notes` rows directly via Supabase reads.

The worker polls the queue on startup; `worker/cli.py <url>` runs a one-off job without the queue, and `POST /process` is a manual one-shot trigger for local testing.
