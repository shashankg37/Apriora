# IntervNotes — UI generation prompts (Google Stitch)

Use these prompts to generate the frontend design. Stitch renders 1–3 screens per prompt, so:
1. Run **Prompt 0 (Master style)** first — it sets the visual language.
2. Then run one **screen prompt** at a time, in the order listed.
3. Reuse the same style paragraph in every follow-up so screens stay consistent.

---

## Prompt 0 — Master style (run first)

> Design a modern web application called **IntervNotes** — a study tool that turns YouTube videos and articles into interview-ready notes. The product should feel like a calm, focused study companion: professional, trustworthy, editorial, never gamified or playful.
>
> Visual language:
> - Warm off-white background (#FAFAF9), white surfaces (#FFFFFF), near-black text (#18181B), muted gray secondary text (#71717A), thin borders (#E4E4E7).
> - One primary accent: indigo (#4F46E5) used sparingly for primary actions and active states. Green (#16A34A) for success/completed, amber (#D97706) for processing, red (#DC2626) for errors.
> - Typography: **Inter** for UI labels and navigation; **Source Serif 4** for long-form note reading (body copy in the reader view). Clear hierarchy: 13–14px UI labels, 16–17px body, 28–36px page titles.
> - 8pt spacing grid, generous whitespace, 12–16px corner radius on cards, subtle 1px borders instead of heavy shadows, soft shadow only on hover/elevated elements.
> - Desktop-first layout (max content width 1200px), fully responsive down to 375px mobile.
> - Clean, airy, editorial; icons should be thin-line style; no illustrations except one simple abstract line-art motif on the sign-in screen.
>
> App structure: authentication → dashboard/library of notes → create-note dialog → live job progress → note reader.

---

## Prompt 1 — Sign in screen

> Following the IntervNotes visual language (warm white background, indigo accent, Inter + Source Serif 4), design a **sign-in page** for a web app that turns YouTube videos and articles into interview-ready study notes.
>
> Layout: two-column split on desktop.
> - Left half: brand block on a soft indigo-tinted background (#EEF2FF). Small IntervNotes wordmark at top. Large headline in Source Serif 4: "Turn any talk into interview-ready notes." Sub-line: "Paste a YouTube link or article. Get structured notes and practice questions, grounded in the source." Below, three small feature rows with thin-line icons: "YouTube & article sources", "AI-grounded notes", "Timestamps you can jump to."
> - Right half: centered white card (400px) with "Sign in" heading, two buttons — "Continue with Google" and "Continue with email" (email shows a magic-link note), a subtle divider, small legal text, and a link "Learn more".
>
> States to show: default, loading button state, and a small inline error "That link is invalid or expired." Nothing else — no sign-up form with passwords (magic link / OAuth only).

---

## Prompt 2 — Dashboard / notes library

> Design the **dashboard** of IntervNotes (warm white background, white cards with thin borders, indigo accent).
>
> Top navigation bar: IntervNotes wordmark left; centered search input with placeholder "Search your notes…"; right side an avatar menu.
>
> Main content:
> - Page header: "Your notes" in Source Serif 4, a muted count ("12 notes"), and a primary indigo button "+ New note".
> - A filter row: segmented control All / YouTube / Articles, plus a depth filter (All depths / Summary / Detailed / Interview) and a "Newest first" sort dropdown.
> - **In-progress section** (only when jobs exist): compact horizontal cards, each showing the source title, a type badge (YouTube red dot or Article icon), an animated slim progress bar with percentage, and the current stage label in amber, e.g. "Generating interview Q&A…". Include one failed card in red: "Transcription failed — Retry".
> - **Notes grid**: 3-column responsive cards. Each card: type badge, depth badge (Summary/Detailed/Interview), source title in semibold, 2-line muted preview snippet, footer with created date and a chevron. Hover state lifts the card subtly.
> - **Empty state** (show as a variant): centered line-art icon, "No notes yet", copy "Paste your first link and get interview-ready notes in minutes.", indigo CTA button.
>
> Include a skeleton-loading variant of the grid. Keep everything airy — no dense data tables.

---

## Prompt 3 — Create note dialog

> Design a **"New note" modal** over a dimmed dashboard background, IntervNotes style (white card, 16px radius, indigo primary).
>
> Contents:
> - Title: "New note" (Source Serif 4), subtitle "Paste a YouTube link or article URL."
> - A large URL input with an icon, placeholder "https://www.youtube.com/watch?v=…", and smart helper behavior: once a valid URL is typed, a detected-source chip appears below — either "YouTube video" with a red play glyph or "Article" with a document glyph — plus a small "Change type" link.
> - Depth selector as three selectable cards in a row (radio-card style), each with a thin-line icon, title, and one-line description: **Summary** — "The key ideas, fast" · **Detailed** — "Comprehensive, structured notes" · **Interview** — "Extra focus on practice questions". The selected card has an indigo border and tint.
> - Inline validation under the input in red: "Enter a valid http(s) link."
> - Footer: ghost "Cancel" button and primary "Generate notes" button (disabled until the URL is valid), with helper microcopy: "Usually takes 2–4 minutes. You can close this and come back."
>
> Keep the modal ~560px wide and calm; no extra fields.

---

## Prompt 4 — Job progress view

> Design a **job progress screen** for IntervNotes — shown after the user submits a link and while the backend processes it (white card centered on warm white page, max 720px).
>
> Elements:
> - Source title and type badge at top; small muted line: "Requested 2 minutes ago".
> - A horizontal (or vertical on mobile) **stepper** with these real pipeline stages: "Fetching transcript" → "Preparing source index" → "Writing essential notes" → "Drafting interview Q&A" → "Composing your note". Completed steps show a green check; the active step shows a spinner and amber label; future steps are muted gray.
> - A large progress percentage (e.g. "62%") with a slim indigo progress bar beneath the stepper.
> - Muted microcopy: "This usually takes 2–4 minutes. This page updates automatically."
> - Secondary action: "Back to library" text link.
> - **Error variant**: replace the stepper's active state with a red alert box: "We couldn't process this link." plus the reason in small text ("We could not extract readable article text from that page.") and two buttons: primary "Retry" and ghost "Back to library".
> - **Skeleton variant** for the first moments before status arrives.

---

## Prompt 5 — Note reader

> Design the **note reader** page of IntervNotes — a long-form reading experience, editorial and calm (warm white, Source Serif 4 body text, 760px reading column).
>
> Layout: three zones.
> - **Left rail (sticky, 220px)**: compact "On this page" outline — Essential Notes sub-headings and Interview Q&A; below it a small metadata card: source type, depth badge, model, created date, and a "View original source" link.
> - **Center column**:
>   - Breadcrumb "Your notes / <title>".
>   - H1 page title (Source Serif 4), then a row of chips: YouTube (red dot) or Article, depth badge, created date, and "Copy markdown" ghost button.
>   - **Segmented tabs**: "Essential Notes" | "Interview Q&A" | "Raw markdown".
>   - Essential Notes tab: rich markdown rendering — TL;DR blockquote card at top, H2/H3 sections, bullet lists with term–definition pairs, code blocks and tables supported, and **timestamp chips** like `[12:34]` styled as small pill links in the accent color that open the YouTube video at that second.
>   - Interview Q&A tab: numbered question cards; each question in semibold with a small chevron to expand/collapse the answer; answers in slightly muted text; timestamp chips inline where present.
>   - Raw markdown tab: monospace block with copy button.
>   - Bottom actions row: "Export" (secondary, disabled with tooltip "Coming soon"), "Delete note" (destructive ghost).
> - **Right rail (optional on wide screens, 200px)**: empty or subtle ad-free whitespace — no widgets.
>
> States: reading progress bar pinned under the top nav; skeleton for the note body; error variant "Note not found."
>
> Typography must make 2,000+ words comfortable: 17px body, 1.65 line-height, generous paragraph spacing, max 72 characters per line.

---

## Prompt 6 — Settings (small)

> Design a minimal **settings page** for IntervNotes: sidebar with sections Account / Appearance / About. Account shows avatar, name, email, "Sign out" destructive ghost button. Appearance shows a light/dark theme toggle (light default) and note text size (Comfortable / Compact). About shows the app version and a one-line description. Keep it understated — one card per section, no filler.

---

## Backend → UI mapping (for implementation, not for the prompt)

| UI element | Data source |
|---|---|
| In-progress stage label | `jobs.stage` (values: `transcribing resource`, `transcript ready`, `indexing transcript chunks`, `essential notes`, `interview Q&A`, `composing notes`, `completed`, `failed`) |
| Progress bar | `jobs.progress` (0, 15, 30, 35, 45, 90, 100) |
| Failure card / retry | `jobs.status = 'failed'` + `jobs.error` |
| Note title / source chip | `sources.title`, `sources.url`, `jobs.type` |
| Depth badge | `jobs.depth` / `notes.depth` |
| Essential Notes tab | `notes.essential_notes` (markdown) |
| Q&A tab | `notes.interview_qa` (markdown) |
| Raw markdown | `notes.markdown` |
| Model label | `notes.model` |
| Created date | `notes.created_at` |
| Timestamp chip → video | `[MM:SS]` tokens in markdown → `source.url + ?t=<seconds>` |
| Note list | `notes` rows read directly via Supabase RLS |

## Copy tone

Short, calm, specific. Examples:
- Button: "Generate notes" (not "Submit" or "Generate!")
- Progress: "Writing essential notes…" — present continuous, no exclamation marks
- Empty: "No notes yet. Paste your first link and get interview-ready notes in minutes."
- Error: "We couldn't process this link." + the actual backend reason in muted text.

## Things to explicitly exclude

- No chat/AI-assistant panel, no comments, no social feeds, no gamification (streaks, points, badges).
- No subscription, pricing, or upsell surfaces in this MVP.
- No note editing UI — notes are generated artifacts (only copy/export/delete).
- No password-based sign-up forms — OAuth + magic link only.
