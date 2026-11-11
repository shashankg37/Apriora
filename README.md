# IntervNotes

`Supabase Edge Function → pgmq queue → FastAPI pipeline worker → LangChain transcription → LangGraph agents → Supabase Postgres`

The backend generates source-grounded interview notes from YouTube and article URLs. Supabase handles all backend duties: Auth, the Postgres tables with RLS, job creation via a thin Edge Function, and direct client reads of `jobs`/`notes` under owner-scoped RLS. FastAPI exists only to run the AI pipeline: it polls the `note-jobs` pgmq queue and executes transcription, chunking, retrieval, and LangGraph agent orchestration. A standalone LangChain chain first turns the complete resource into one `TranscriptResource`. That transcript is then chunked and indexed in a per-job ChromaDB collection; the Essential Notes and Interview Q&A agents each retrieve the most relevant chunks by information aspect instead of consuming the full source. It uses Groq `qwen/qwen3.8-27b`; YouTube captions are retrieved with `youtube-transcript-api==1.2.4`. Audio downloading and Whisper are not part of this project.

## Layout

- `supabase/`: SQL migrations (schema, RLS, pgmq queue) and the thin Deno Edge Function. `create-note` authenticates, validates, inserts the job row, and enqueues; nothing else. Clients read `jobs`/`notes` directly with the anon key under RLS.
- `worker/app.py`: FastAPI pipeline executor — polls pgmq, runs the pipeline; no user-facing endpoints.
- `worker/transcription/`: standalone LangChain resource-to-transcript pipeline.
- `worker/services/vector_store.py`: per-job chunk index in ChromaDB (ephemeral, in-memory).
- `worker/agents/`: Essential Notes and Interview Q&A agents.
- `worker/pipeline/`: LangGraph fan-out/fan-in orchestration for the two agents.
- `web/`: Next.js app — Supabase auth, note ingestion (URL or pasted transcript), live job status, and notes display.

## Configure and run

1. Create a Supabase project; run the migrations in `supabase/migrations/` in order (pgmq, tables, RLS policies, the `note-jobs` queue, per-job agent selection).
2. Deploy the Edge Function from `supabase/functions/` with `supabase functions deploy create-note`; set its secrets with `supabase secrets set`.
3. Create `worker/.env` with `GROQ_API_KEY`, `SUPABASE_URL`, and the service role `SUPABASE_SERVICE_ROLE_KEY`.

```powershell
python -m pip install -r worker/requirements.txt
cd worker; uvicorn app:app --reload
```

Clients create notes through the `create-note` Edge Function (answers `{jobId}`) and follow `jobs.status`/`notes` rows directly via Supabase reads.

The worker polls the queue on startup; `POST /process` is a manual one-shot trigger for local testing.

## Deployment

- `web/` → Vercel: connect the repo, set the root directory to `web/`, and provide the public Supabase env vars.
- `worker/` → Railway: root directory `worker/`, start command `uvicorn app:app --host 0.0.0.0 --port $PORT`, health check `/healthz`; the queue poller starts with the app lifespan, so a single always-on service suffices.
- `supabase/functions/` → Supabase CLI (`supabase functions deploy create-note`), separate from the GitHub push.
