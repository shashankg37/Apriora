import { Job, Note } from "@/types";

/**
 * Opt-in UI walkthrough mode (no backend required): set NEXT_PUBLIC_UI_PREVIEW=1
 * in web/.env.local. Every screen renders the exact production components with a
 * tiny sample payload, and a labelled banner makes the mode obvious. Remove the
 * flag (or leave it out when adding real project keys) to use the real backend.
 */
export const UI_PREVIEW = process.env.NEXT_PUBLIC_UI_PREVIEW === "1";

/**
 * Fresh sample payload per mount. Never call this while rendering — it runs
 * `new Date()` and Next.js Cache Components forbids unstable values there.
 */
export function buildPreviewData(): { notes: Note[]; job: Job } {
  const now = Date.now();

  const notes: Note[] = [
    {
      id: "preview-note-1",
      source_id: "preview-source-1",
      title: "Sample lecture note — transformer attention (preview)",
      sourceUrl: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
      sourceType: "youtube",
      depth: "detailed",
      markdown: [
        "# Sample lecture note (preview)",
        "",
        "## Core idea",
        "",
        "- Attention weights are computed from query/key similarity and applied to values.",
        "- Multi-head attention runs several projections in parallel and concatenates the results.",
        "",
        "## Key takeaways",
        "",
        "1. Complexity per layer is quadratic in sequence length.",
        "2. Codes and derivations from the source are quoted here verbatim.",
        "",
        "This content exists only so the UI walkthrough looks realistic.",
      ].join("\n"),
      essential_notes: [
        "## Essential notes (preview)",
        "",
        "- Scaled dot-product attention normalizes scores by sqrt(d_k).",
        "- Pre-LN improves training stability at depth.",
      ].join("\n"),
      interview_qa: [
        "## Interview Q&A (preview)",
        "",
        "**Q: Why divide by sqrt(d_k)?**",
        "",
        "Dot products grow with dimension, saturating the softmax; dividing keeps unit variance.",
      ].join("\n"),
      model: "qwen/qwen3.8-27b",
      flags: [],
      tags: ["sample"],
      createdAt: new Date(now - 1000 * 60 * 42).toISOString(),
    },
    {
      id: "preview-note-2",
      source_id: "preview-source-2",
      title: "Sample paper note — retrieval-augmented generation (preview)",
      sourceUrl: "https://arxiv.org/abs/2005.11401",
      sourceType: "article",
      depth: "summary",
      markdown: [
        "# Sample paper note (preview)",
        "",
        "A short summary note. This one intentionally has no Essential Notes or",
        "Interview Q&A sections so the empty states can be seen in the walkthrough.",
      ].join("\n"),
      model: "qwen/qwen3.8-27b",
      flags: [],
      tags: ["sample"],
      createdAt: new Date(now - 1000 * 60 * 60 * 26).toISOString(),
    },
  ];

  const job: Job = {
    id: "preview-job",
    url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    type: "youtube",
    depth: "detailed",
    status: "processing",
    stage: "interview Q&A",
    progress: 55,
    created_at: new Date(now - 1000 * 60 * 6).toISOString(),
    updated_at: new Date(now - 1000 * 60).toISOString(),
  };

  return { notes, job };
}
