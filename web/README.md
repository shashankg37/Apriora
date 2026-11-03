# Apriora web

Frontend for IntervNotes (product name: **Apriora**): paste a YouTube link or
article URL, the worker pipeline compiles it into interview-ready notes. Users
sign in with email, submit jobs through the `create-note` Edge Function, watch
the run's live progress, and read the finished notes.

## Stack

- Next.js (App Router) + Tailwind CSS 4, all state client-side in `src/app/page.tsx`
- `@supabase/supabase-js` for auth, `notes`/`sources`/`jobs` reads (RLS applies)
- No mock data — every value on screen comes from the backend

## Run

```bash
npm install
cp .env.example .env.local   # fill in your Supabase URL + anon key
npm run dev
```

## How it flows

1. `HeroIngestion` submits `url` + `depth` to the `create-note` Edge Function
   (auth → job row → pgmq `note-jobs` queue).
2. `page.tsx` polls the latest `jobs` row every 4s while it is queued/processing;
   `ProcessingView` maps the worker's `stage`/`progress` values onto its steps.
3. When the job completes, the note (`markdown` + `essential_notes` +
   `interview_qa` markdown texts) is loaded joined with its `source` and opened
   in `NoteDetail` (copy / export .md per tab).

Keep credentials out of source and logs; the client only ever uses the anon key,
and all writes go through the Edge Function or the worker's service role key.
