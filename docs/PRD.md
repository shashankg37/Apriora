# Link-to-Notes Agent — backend MVP

Given a YouTube or article URL, produce source-grounded, interview-ready Markdown notes. The backend accepts authenticated jobs through a Supabase Edge Function, queues them with pgmq, and executes LangGraph in the FastAPI pipeline worker. Supabase remains the backend of record: Auth, owner-scoped Postgres tables with RLS, and direct client reads; FastAPI runs only transcript acquisition, chunking, retrieval, and agent orchestration.

## Transcript policy

YouTube sources use `youtube-transcript-api==1.2.4` to retrieve the full available caption transcript, including timestamps. A standalone LangChain resource pipeline returns one complete `TranscriptResource`. Audio downloading and Whisper are out of scope.

## Retrieval policy

Transcripts that already fit one prompt go to the agents whole. Long transcripts are split into ~1.2k-character chunk documents (with a short inherited tail for continuity), embedded with Chroma's default local MiniLM model, and held in a per-job in-memory ChromaDB collection. The Essential Notes and Interview Q&A agents each issue aspect-targeted retrieval queries (key concepts, formulas, examples, misconceptions, trade-offs, pitfalls), and their output is composed into one note. The job collection is dropped as soon as the pipeline finishes.

## Backend policy

- `create-note` Edge Function: user JWT verified, URL/depth validated, job row inserted, message sent to the `note-jobs` pgmq queue. Nothing else runs at the edge.
- Clients read their own `jobs`/`notes` rows directly through Supabase with the anon key; RLS keeps reads owner-scoped.
- FastAPI (`worker/app.py`) is the pipeline executor only: it polls pgmq and runs transcription, chunking, retrieval, and LangGraph orchestration. It exposes no authenticated endpoints.
- Postgres tables `jobs`, `sources`, `notes` carry the former Firestore documents; row-level security keeps every row owner-scoped, and the worker writes through the service role key only.
- Client-side rules from the Firestore era map to RLS: users read only their own rows, may create only their own jobs, and cannot update or delete anything directly; sources and notes are written by the worker alone.

## Current scope

- Supabase-authenticated job creation and owner-scoped Postgres records.
- YouTube and article extraction, Groq Qwen 3.8 27B orchestration, progress updates, and Markdown notes.
- No frontend, PDF export, Storage upload flow, or notes library UI.
- Open item: worker hosting (any Python host with egress to the Supabase REST endpoint).