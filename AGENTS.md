# IntervNotes engineering guide

- Keep Supabase Edge Functions thin: authenticate, validate, create job rows, and enqueue to pgmq only. FastAPI is the pipeline executor (transcription, chunking, retrieval, agent orchestration) and exposes no user-facing endpoints.
- Two acquisition paths feed the same chunking and vector-store flow: a fetchable URL (`youtube` / `article` via `worker/transcription`) or a user-pasted transcript stored on the job row (`jobs.transcript`, job `type` "transcript", optional `jobs.title`), normalized by the same pipeline.
- Keep resource-to-transcript work in the standalone LangChain pipeline at `worker/transcription`.
- Long transcripts are indexed as ~1.2k-char chunk documents in a per-job ephemeral ChromaDB collection (`worker/services/vector_store.py`); agents retrieve aspect-targeted chunks and never send the full transcript to the model.
- LangGraph starts only after transcript acquisition and runs the Essential Notes and Interview Q&A agents over the same `TranscriptResource`.
- Use `qwen/qwen3.8-27b` through Groq for all LLM work.
- YouTube transcript acquisition uses `youtube-transcript-api==1.2.4` with a language waterfall: English captions directly → YouTube server-side `translate("en")` (free, treats failures as fall-through) → native captions (prefer Hindi, manual over generated) translated to English with the shared Groq LLM (`worker/transcription/translate.py`). Do not introduce an audio-download or Whisper fallback.
- Never expose credentials in source, logs, Postgres records, or Supabase Storage; client code only ever checks auth with the anon key — writes go through the worker's service role key.
- The frontend is intentionally deferred. Do not add `web/` until requested.