# IntervNotes — In-Depth Project Guide

This is the "read me before touching the code" document. It explains what the project does, the order in which to read the files, what every file actually does, the data model, and the design rules the code must keep obeying.

---

## 1. What this project is

IntervNotes is a **backend-only MVP** that turns a URL (YouTube or article) into **source-grounded interview preparation notes**: Essential Notes (concepts, formulas, examples, misconceptions) and an Interview Q&A section (10–15 technical questions with answers). The output is stored in Postgres and surfaced through Supabase.

The whole system in one line:

```
Browser → Supabase Edge Function (create-job) → pgmq queue → FastAPI worker
       → transcript acquisition → chunking/indexing → LangGraph agents → note rows in Postgres → Browser reads note
```

The deliberate split:

- **Supabase** = everything backend-plumbing: authentication, the Postgres tables with row-level security, job creation (a thin Deno Edge Function), the pgmq queue, and direct client reads.
- **FastAPI** = an AI pipeline executor only. It exposes no user-facing endpoints; it polls the queue, then runs the transcription → retrieval → agents chain in-process.
- **No frontend yet** (`web/` is intentionally deferred). The `demo/` Streamlit app is the visual harness used while building the pipeline.

---

## 2. Where to start — recommended reading order

### Pass 1 — Understand the product (15 minutes)

| # | File | Why |
|---|------|-----|
| 1 | `README.md` | One-screen summary: architecture line, layout, run instructions |
| 2 | `docs/PRD.md` | Scope decisions: transcript policy, retrieval policy, backend policy |
| 3 | `AGENTS.md` | The engineering ground rules every future change must respect |

### Pass 2 — Understand the backend plumbing (~30 minutes)

| # | File | Why |
|---|------|-----|
| 4 | `supabase/migrations/0001_init.sql` | Tables, RLS, pgmq queue — the whole data layer in 70 lines |
| 5 | `supabase/functions/create-note/index.ts` | Entry point of every job; the only Deno code in the repo |

### Pass 3 — Understand the pipeline core (~1 hour)

Read in this exact order; each file builds on the previous:

| # | File | Why |
|---|------|-----|
| 6 | `worker/app.py` | The conductor: poller, lifecycle, error policy |
| 7 | `worker/transcription/state.py` | The vocabulary: `TranscriptSegment`, `TranscriptResource` |
| 8 | `worker/transcription/pipeline.py` | URL → transcript (YouTube captions via `youtube-transcript-api`, articles via `trafilatura`) |
| 9 | `worker/services/vector_store.py` | The chunking/indexing engine (~1.2k-char docs, per-job ephemeral ChromaDB) |
| 10 | `worker/agents/context.py` | The retrieval aspect queries and context formatting both agents share |
| 11 | `worker/services/llm.py` | Groq client with rate limiting and retry — manifold of every model call |
| 12 | `worker/pipeline/state.py` | `GraphState`, the state tracked across the graph |
| 13 | `worker/pipeline/graph.py` | The LangGraph DAG: fan-out/fan-in of the two agents |
| 14 | `worker/pipeline/nodes/*.py` | The four graph nodes in practice |
| 15 | `worker/agents/essential_notes.py` + `worker/agents/interview_qa.py` | Single-chunk / retrieval / map-reduce strategies of both agents |

### Pass 4 — Support files, as needed

| File | Read it when |
|------|-------------|
| `worker/services/supabase_client.py` | you touch persistence, the queue, or RLS-related writes |
| `worker/services/checkpointer.py` | you wonder where the job `stage`/`progress` values come from |
| `worker/cli.py` | you want to run one job end-to-end without Supabase auth/queue |
| `demo/streamlit_app.py` | you want to watch the agents run live with UI |
| `worker/tests/` | you change state, context, or the vector store |
| `docs/PROJECT_GUIDE.md` | you are reading it right now |

Engineers who want the shortest possible path: **`app.py` → `graph.py` → `vector_store.py` → the two agent files → `0001_init.sql`**. That is the entire system's substance.

---

## 3. File-by-file reference

### `supabase/migrations/0001_init.sql` — the data layer

Run once when creating the Supabase project, ideally via `supabase db push` or the SQL editor.

- Enables the **`pgmq`** extension and creates the `note-jobs` queue.
- Creates three tables:

| Table | Purpose | Notable columns |
|-------|---------|-----------------|
| `jobs` | One request from one user | `owner_id`, `url`, `type` (`youtube`/`article`), `depth` (`summary`/`detailed`/`interview`), `status`, `stage`, `progress`, `checkpoint jsonb`, `error`, `source_id`, `note_id` |
| `sources` | Written once by the worker after a successful transcript fetch | `url`, `type`, `title`, `fetched_at` |
| `notes` | The final product | `source_id`, `depth`, `markdown`, `essential_notes`, `interview_qa jsonb`, `model`, `flags`, `tags` |

- Enables **RLS** on all three with four policies: users may read only their own rows, and may insert only their own `jobs`. Nobody can update/delete client-side — writes to `sources`/`notes` are the worker's job, done with the service role key (which bypasses RLS).
- Defines `public.enqueue_note_job(payload jsonb)`, a security-definer wrapper around `pgmq.send`, granted **only to `service_role`** for the Edge Function and the worker.

### `supabase/functions/create-note/index.ts` — the front door

Thin Deno function (~48 lines), the only code a user's request actually hits:

1. **Auth** — builds an anon-key Supabase client carrying the caller's `Authorization` header and calls `auth.getUser()`. Anonymous/unauthenticated requests get a 401.
2. **Validate** — URL must be http(s); depth must be one of the three enum values.
3. **Classify** — YouTube domains (`youtube.com`, `youtu.be`) get `type: "youtube"`, everything else is an `article`.
4. **Persist** — inserts the `jobs` row with the **service role client**, then calls `enqueue_note_job({ jobId })`.
5. **Respond** — `{ jobId }` so the client can poll the `jobs` row (which RLS already allows it to read).

Nothing else runs at the edge. No LLM calls, no transcript fetching, no queue reads.

### `worker/app.py` — the pipeline executor

A FastAPI app whose only job in life is to poll pgmq and feed the graph:

- `run_job(job_id, job)` — builds `GraphState`, then: mark stage `transcribing resource` (15) → fetch the transcript → mark `transcript ready` (30) → `pipeline.ainvoke(state)` → `save_result(result)`; on any failure, `fail(job_id, exc)`; and **always** `TranscriptVectorStore.drop(job_id)` in `finally`.
- `poll_queue()` — infinite loop (started in `lifespan`, canceled on shutdown): `pgmq.read` → parse `jobId` from the payload → fetch the `jobs` row → run → `pgmq.archive` the message (ack). Skips already-completed jobs, missing job rows, and unsigned payloads.
- **Failure policy**: if a message has been delivered `MAX_ATTEMPTS = 5` times (`read_ct`), it is archived instead of redelivered and the job row is marked `failed` — so a poisoned message cannot loop forever.
- Endpoints: `GET /healthz` and `POST /process` (manual one-shot trigger for local testing; not part of production flow). That's all — there are no authenticated endpoints by design.

### `worker/transcription/state.py` — the vocabulary

Two Pydantic models all downstream code shares:

- `TranscriptSegment` — `text`, optional `start`/`duration` seconds.
- `TranscriptResource` — `url`, `source_type`, `title`, a list of segments, and **`full_text`** (segments concatenated). This "one pod" carries everything the rest of the system needs; no downstream code ever re-fetches the resource.

### `worker/transcription/pipeline.py` — resource acquisition

A standalone LangChain chain (`RunnableLambda`s composed with `|`, explicitly *not* LangGraph) so it can be reused and tested independently:

- `_youtube_id()` extracts the video id from both `watch?v=` and `youtu.be/` forms; YouTube fetch runs `YouTubeTranscriptApi().fetch` in a worker thread.
- Articles go through `trafilatura.fetch_url` + `extract` (comments off, tables on) and arrive as **one segment** — which is why the chunker must wrap oversized lines.
- `_assemble_context()` builds the final `TranscriptResource`; an empty transcript raises.

### `worker/services/vector_store.py` — chunking and indexing (the heart of retrieval)

This is where "the model never sees the full transcript" is implemented:

- Constants: `DOC_CHARS = 1_200` (retrieval-document size), `OVERLAP_CHARS = 150` (tail carried into the next chunk), `MAX_CONTEXT_CHARS = 16_000` (retrieval union cap), `TOP_K = 4`.
- `_split_documents()` packs transcript lines into ~1.2k-char documents in reading order. YouTube lines are stamped `[MM:SS]`; articles are wrapped at word boundaries via `_wrap_line()` because they arrive as one huge segment. Overlap keeps sentence boundaries from splitting context.
- `TranscriptVectorStore`:
  - One process-wide **ephemeral** `chromadb.EphemeralClient` (in-memory; dies with the process).
  - Collections are named `intervnotes-<job_id>` so concurrent jobs never share vectors; `from_transcript()` deletes any stale collection with the same name first (idempotent re-runs).
  - Uses Chroma's default local MiniLM embeddings (downloads once per host).
  - `retrieve(queries)` runs one similarity search per query through a single embedding model serially (`asyncio.Lock` + threads), merges hits keeping the best distance, then greedily packs results into the char budget **and re-sorts them in reading order by timestamp** before returning.
  - `drop(job_id)` deletes the collection — invoked in `app.run_job`'s `finally` so finished jobs never leak embeddings.

### `worker/agents/context.py` — the retrieval questions

Shared context preparation:

- `NOTES_RETRIEVAL_QUERIES` (6 aspects: key concepts, critical points, formulas, examples, misconceptions, summary) and `QA_RETRIEVAL_QUERIES` (5 aspects: Q&A, definitions, trade-offs, edge cases, applications). The multi-aspect question set exists so the retrieval *union* approximates whole-source coverage without sending it whole.
- `format_retrieved_context()` joins retrieved docs with timestamps, capped at 16k chars.
- `transcript_chunks()` — the **fallback path**: splits the transcript into ~8k-char chunks at segment boundaries, used when retrieval yields nothing or the store is absent.

### `worker/services/llm.py` — every model call goes through this

An `AsyncGroq` wrapper (`qwen/qwen3.8-27b` via Groq) with four responsibilities:

1. **Rate limiting** — a sliding-window token bucket, shared by both agents (6,000 input TPM / 1,000 output TPM on the on-demand tier). Input tokens are estimated at `len(prompt)//4`; output is reserved up-front and later reconciled with the real `completion_tokens`.
2. **`max_tokens` pinning** — Groq's default completion size would trip the OTPM limit, so it is explicitly `output_tpm - 50`.
3. **Retry with backoff** — up to 6 attempts on transient faults (429/5xx, connection errors), fully honoring `retry-after` headers and Groq's "try again in Xs" messages.
4. **Two call styles** — `json()` (temperature 0.15, `response_format: json_object`, parses to dict) and `text()` (temperature 0.2, Markdown). Both share the system rule: *never invent facts absent from the source*.

It also forces the OS certificate store over certifi (enterprise TLS inspection tolerated that would have broken certifi's bundle).

### `worker/pipeline/` — the LangGraph DAG

- **`state.py`** — `GraphState(TypedDict, total=False)`: job metadata + `transcript` + `store` + outputs (`essential_notes`, `interview_qa`, `markdown`, `flags`). The keys of the state *are* the channels; node names were deliberately made distinct (`*_agent`) from the state keys because LangGraph rejects a node named identically to a state channel.
- **`graph.py`** — builds and compiles the graph:
  ```
  START → prepare_retrieval → essential_notes_agent ─┐
                            → interview_qa_agent   ─┤ → compose → END
  ```
  `add_edge(["essential_notes_agent", "interview_qa_agent"], "compose")` is the fan-in: both agents run from the same prepared index, then merge.
- **`nodes/retrieval.py`** — embeds/indexes the transcript once (`stage = indexing transcript chunks`, progress 35) and puts the `store` into state. This is the one expensive step both agents reuse.
- **`nodes/essential_notes.py` / `nodes/interview_qa.py`** — two-line adapters that call the agent functions with state + checkpoint (progress 45) and return the state update.
- **`nodes/compose.py`** — pure assembly (progress 90): one Markdown document, `# Title`, source link, then the two sections. No model calls.

### `worker/agents/essential_notes.py` and `worker/agents/interview_qa.py` — the two agents

Structurally identical, with a three-tier strategy:

1. **Short transcripts fit one prompt** (`chunks == 1`, ≤8k chars): one `llm.text()` call with the whole source.
2. **Retrieval path** (long transcript, store present): per-agent aspect queries → 16k-char union → single call. Produces `{depth}` notes / 10–15 Q&A pairs from retrieved blocks only.
3. **Map-reduce fallback** (no store or no retrieved hits): per-chunk partial calls (<300 words each), then reduce rounds that **batch 4 partials at a time** and shrink (<500 words) until ≤4 partials *and* ≤12k chars total, then one final combine call. The essential-notes reduce merges; the Q&A reduce *selects the strongest* questions.

### `worker/services/supabase_client.py` — the write side

The single service-role client for everything Postgres. Key methods and expectations:

- `create_job`, `fetch_job` (no owner filter — the worker is trusted), `update_stage(status/stage/progress)`, `merge` (checkpoint), `fail` (truncates the error to 500 chars).
- `save_result` — inserts `sources` + `notes` rows and flips `jobs.status` to `completed` with `progress 100`, `source_id`, `note_id` in one go.
- `dequeue` — `pgmq.read` with `vt=60`, `qty=1`; returns messages with `msg_id`, `read_ct`, payload.
- `ack` — `pgmq.archive` (the message is kept for inspection, not deleted).
- `enqueue` — `pgmq.send` via the security-definer RPC.

### `worker/services/checkpointer.py` — progress bookkeeping

`JobCheckpointer.mark(job_id, stage, progress, metadata)` writes the current graph stage into the `jobs` row (`checkpoint jsonb` + the visible `stage`/`progress` columns). This is what a client watches while polling `jobs` — the stage names are, in order: `queued → transcribing resource (15) → transcript ready (30) → indexing transcript chunks (35) → essential notes (45) → interview Q&A (45) → composing notes (90) → completed (100)`.

### `worker/services/storage_client.py`

A placeholder module — the future integration point for Supabase Storage artifacts (exports). Part of the export milestone yet to come.

### `worker/cli.py` — one job, no queue

`python cli.py <url> [--depth d]`: synthesizes a stable local owner (`uuid5("local-cli")`), creates the job row (service key bypasses RLS so this works locally), acquires the transcript, runs the graph, saves the result, prints the Markdown, and always drops the Chroma collection. Ideal for a smoke test without deploying the Edge Function.

### `demo/streamlit_app.py` — visual harness

A Streamlit UI that bypasses Supabase entirely (only `GROQ_API_KEY` from `demo/.env`) and reruns the real transcript pipeline against any URL: fetch → index into a single `demo` collection → run both agents **in parallel** via `asyncio.gather` → display their outputs → `dispose()` the collection in `finally`. Use it when tuning prompts or retrieval behavior.

### `worker/tests/` — what's covered

- `test_context.py` — `transcript_chunks`/`format_retrieved_context` boundaries.
- `test_state.py` — `TranscriptResource`/`TranscriptSegment` validation.
- `test_vector_store.py` — splitting, wrapping, indexing, retention cap behavior.

Configuration lives in `worker/config.py`: a frozen dataclass reading `GROQ_API_KEY`, `GROQ_MODEL` (default `qwen/qwen3.8-27b`), `SUPABASE_URL`, and **`SUPABASE_SERVICE_ROLE_KEY`** from the environment — nothing else, ever; the worker never needs user JWTs.

### `worker/Dockerfile`

`python:3.11-slim`, installs pinned requirements, runs `uvicorn app:app --port ${PORT}` (8080 by default). This is how the worker is deployed to any container host; worker hosting remains an open decision per the PRD.

### `scripts/check_youtube_access.py`

Tiny ops tool: `python check_youtube_access.py <video_id>`, run from a deploy target to verify captions are fetchable from that machine's egress IP (YouTube blocks some cloud IP ranges).

---

## 4. The life of a note (end-to-end walk-through)

1. Authenticated client hits the `create-note` Edge Function with `{url, depth}` → gets `{jobId}`.
2. The function inserts a `jobs` row (`status queued`, `stage queued`, `progress 0`) and sends `{jobId}` into `note-jobs`.
3. The FastAPI worker's poller reads the message, fetches the job row, and starts `run_job`:
   - `transcribing resource` (15%) — captions or trafilatura → one `TranscriptResource`.
   - `transcript ready` (30%) — enters LangGraph.
   - `indexing transcript chunks` (35%) — ~1.2k-char docs into a job-scoped in-memory Chroma collection.
   - both agents run concurrently (45% each) against aspect-targeted retrieval of at most 16k chars.
   - `composing notes` (90%) — markdown assembled.
4. `save_result` writes `sources`, `notes`, and completes the `jobs` row (100%).
5. The poller archives the queue message; `finally` drops the job's Chroma collection.
6. The client, reading `jobs` and `notes` directly through RLS, sees `completed` plus the note.

If anything throws in step 3, the job row is marked `failed` with the error string; the queue message is archived. If the worker dies instead, `vt=60` visibility timeout re-delivers the message — until `read_ct` hits 5, at which point the job is failed instead of retried forever.

---

## 5. Invariants — break these and the design breaks

- **The full transcript never goes to the model** for long sources. One-prompt is allowed only when it fits one ~8k chunk; otherwise retrieval or map-reduce.
- **Collections are ephemeral, job-scoped, and always dropped.** No vector store ever outlives its job.
- **The worker only writes with the service role key; clients only read their own rows via RLS.** No credentials ever reach source, logs, Postgres, or Storage.
- **Edge Functions stay thin** — auth/validate/insert/enqueue and nothing more.
- **Groq `qwen/qwen3.8-27b` for all model calls**, rate-limited through `services/llm.py` (never call the Groq client directly from an agent).
- **YouTube captions only** — no audio downloading, no Whisper fallback, by product decision.
- **`AGENTS.md` is policy**, not a suggestion: it is the contract new changes are reviewed against.

---

## 6. Getting your environment running

```powershell
# 1. Worker (backend + tests)
python -m pip install -r worker/requirements.txt
# copy worker/.env.example → worker/.env and fill in:
#   GROQ_API_KEY, GROQ_MODEL, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

# 2. Supabase project + schema
# open supabase/migrations/0001_init.sql in the SQL editor (or supabase db push)

# 3. Edge function
# supabase functions deploy create-note; supabase secrets set <vars from supabase/.env.example>

# 4. Run tests
cd worker; python -m pytest tests -q

# 5. Local end-to-end options (pick one)
cd worker
uvicorn app:app --reload          # the real worker, polling pgmq
python cli.py "https://youtu.be/..."              # single job, no queue
streamlit run ../demo/streamlit_app.py            # visual pipeline run (needs only demo/.env with GROQ_API_KEY)
```

Environment templates: `worker/.env.example`, `supabase/.env.example`, `demo/.env.example`.

---

## 7. Gotchas worth knowing upfront

- **Order matters in `supabase/migrations/0001_init.sql`** — the pgmq extension and queue must exist before tables/RPC are granted; the file is literally sequenced for that.
- **Don't rename a graph node to match its state key.** LangGraph raises `'x' is already being used as a state key`; naming lives in `graph.py` (`*_agent` suffixes) precisely so this cannot recur.
- **Two chunkers exist on purpose**: `vector_store.DOC_CHARS = 1200` is for *embedding/retrieval*, `context.transcript_chunks(max_chars = 8_000)` is for the *map-reduce fallback*. Don't unify them; they serve different token budgets.
- **`max_tokens` must stay pinned** in `llm.py` — removing it lets Groq's model default blow through the output-TPM budget.
- **A job that fails 5 redeliveries is failed permanently** (`app.MAX_ATTEMPTS`); the queue message is archived, not retried.
- **The demo's `demo` collection name is fine** because the demo runs one job at a time; production code must keep per-job naming.
