import asyncio
import re
from transcription.state import TranscriptResource
from services.llm import LLM
from services.vector_store import TranscriptVectorStore, MAX_CONTEXT_CHARS, TOP_K
from agents.context import NOTES_RETRIEVAL_QUERIES, format_retrieved_context, transcript_chunks

CONCURRENCY = 4
BATCH_SIZE = 4
MAX_PARTIAL_CHARS = 12_000

FIELDS = ("what it is, why it's used, how it's used, when it's used, formulae (with every symbol "
          "defined), and why it's necessary under those conditions / what happens if it is skipped")

SPEC = """interview-ready Markdown notes in exactly this structure:

# Summary
A 2-3 sentence description of what the source covers.

Then, for every distinct topic in the source, one section:

## <Topic name>
- **What it is:** one-line definition.
- **Why it's used:** the problem it solves or the benefit it gives.
- **How it's used:** the concrete steps or usage pattern, with a short example if the source gives one.
- **When it's used:** the situations, conditions, or signals that call for it.
- **Formulae:** every formula the source states, in LaTeX, with each symbol defined. Omit this line entirely if the topic is not mathematical.
- **Why it's necessary & what happens without it:** why it is needed under those conditions, and the concrete failure or consequence if it is not used.

Rules: add a timestamp (e.g. [12:34]) to a point wherever the source provides one. If the source does not address a field, write "Not covered in source" instead of guessing. Merge repeated mentions of a topic into one section."""

ENRICH_SPEC = """STEP 1: Classify the topic as one of: algorithm, concept, technique, metric, architecture, optimization, other. Write it as the first line: **Type:** <type>

STEP 2: Write only the fields below that genuinely apply to this topic. Skip a field entirely if it does not apply; never write "N/A".

FIELDS
- **30-second answer:** a first-person, speakable answer to "Explain <topic>" in 3-4 sentences.
- **Intuition:** one line, plain English or geometric.
- **Assumptions & limitations:** when it breaks or underperforms.
- **Trade-offs / vs alternatives:** the closest alternatives and when to pick which.
- **Hyperparameters:** (algorithms, techniques, optimization only) for each key one, the effect when too high and when too low.
- **Failure modes:** symptom -> cause -> fix.
- **Interview Qs:** 3-5 numbered questions, each tagged [easy], [medium] or [hard], with a short model answer (max 4 lines) and one likely follow-up.
- **Common misconceptions:** what people get wrong, and the correct view.

RULES
1. Every bullet and every numbered question item ends with the tag (general knowledge).
2. Do not repeat or rewrite the source notes; only add what they lack.
3. No invented numbers, benchmarks, dataset results, or paper claims. If unsure, omit.
4. If general knowledge contradicts the source notes, add a bullet: **Conflict:** source says ...; general knowledge says ... (general knowledge). Never alter the source notes.
5. Keep each field to 1-3 lines.
6. Output only the enrichment, in Markdown. No preamble."""

NOTE_SPEC = """From the notes below, write exactly these two sections in Markdown:

## Prerequisites & Related Topics
- Up to 8 bullets: concepts to know before these topics, and closely related topics worth studying next. Each bullet is a topic name plus a few words on the link, and ends with (general knowledge).

## Revision Card
1. 3-5 one-line takeaways drawn only from the notes.

Output only these two sections."""


async def _gather(llm: LLM, prompts: list[str], safe: bool = False) -> list[str]:
    sem = asyncio.Semaphore(CONCURRENCY)

    async def run(p: str) -> str:
        async with sem:
            if not safe:
                return await llm.text(p)
            try:
                return await llm.text(p)
            except Exception:
                return ""

    return await asyncio.gather(*(run(p) for p in prompts))


async def _from_retrieval(transcript: TranscriptResource, store: TranscriptVectorStore, depth: str, llm: LLM) -> str | None:
    try:
        retrieved = await store.retrieve(NOTES_RETRIEVAL_QUERIES, top_k=TOP_K, max_chars=MAX_CONTEXT_CHARS)
    except Exception:
        return None
    if not retrieved:
        return None
    context = format_retrieved_context(retrieved, max_chars=MAX_CONTEXT_CHARS)
    return await llm.text(
        f"You are the Essential Notes agent. The blocks below are relevant transcript segments retrieved "
        f"from the complete source, in chronological order. Produce {depth} {SPEC}\n\n"
        f"Use only what the blocks contain; do not invent facts.\n\nSource: {transcript.title}\n\n{context}"
    )


async def _source_notes(transcript: TranscriptResource, depth: str, llm: LLM,
                        store: TranscriptVectorStore | None = None) -> str:
    """Pass 1: source-grounded notes."""
    chunks = transcript_chunks(transcript)
    if not chunks:
        raise ValueError("Transcript is empty")

    if len(chunks) == 1:
        return await llm.text(
            f"You are the Essential Notes agent. Use only this complete source transcript. "
            f"Produce {depth} {SPEC}\n\nDo not invent facts.\n\nSource: {transcript.title}\n{chunks[0]}"
        )

    if store is not None:
        notes = await _from_retrieval(transcript, store, depth, llm)
        if notes is not None:
            return notes

    n = len(chunks)
    current = await _gather(llm, [
        f"You are the Essential Notes agent. This is part {i}/{n} of one complete transcript. "
        f"For each topic discussed, extract only source-grounded: {FIELDS}. "
        f"Include timestamps. Keep this partial analysis under 300 words.\n\n{c}"
        for i, c in enumerate(chunks, 1)
    ])

    while len(current) > BATCH_SIZE or sum(map(len, current)) > MAX_PARTIAL_CHARS:
        batches = [current[i:i + BATCH_SIZE] for i in range(0, len(current), BATCH_SIZE)]
        to_reduce = [b for b in batches if len(b) > 1 or len(current) <= BATCH_SIZE]
        passthrough = [b[0] for b in batches if len(b) == 1 and len(current) > BATCH_SIZE]
        reduced = await _gather(llm, [
            "You are the Essential Notes agent. Condense and merge these partial analyses covering "
            "consecutive sections of a transcript into a coherent intermediate summary under 500 words. "
            f"Keep every topic and, per topic, preserve: {FIELDS}. Keep timestamps.\n\n" + "\n\n".join(b)
            for b in to_reduce
        ])
        current = reduced + passthrough

    return await llm.text(
        f"You are the Essential Notes agent. Combine these partial analyses, which together cover the "
        f"complete transcript, into {depth} {SPEC}\n\nDeduplicate; do not add outside facts.\n\n"
        + "\n\n".join(current)
    )


def _split_notes(notes: str) -> tuple[str, list[str]]:
    parts = re.split(r"(?m)^(?=## )", notes)
    head = parts[0] if parts and not parts[0].startswith("## ") else ""
    sections = [p for p in parts if p.startswith("## ")]
    return head, sections


def _topic_prompt(title: str, section: str) -> str:
    topic = section.splitlines()[0].lstrip("#").strip()
    return (
        f"You are the Interview Prep agent for machine learning interviews. Below are source-grounded "
        f"notes on ONE topic from a video. Add interview-prep enrichment from your general knowledge.\n\n"
        f"Source: {title}\nTopic: {topic}\n\n{ENRICH_SPEC}\n\nSOURCE NOTES\n{section.strip()}"
    )


def _note_prompt(title: str, notes: str) -> str:
    return (
        f"You are the Interview Prep agent for machine learning interviews.\n\n"
        f"Source: {title}\n\n{NOTE_SPEC}\n\nNOTES\n{notes}"
    )


async def _enrich(notes: str, title: str, llm: LLM) -> str:
    """Pass 2: per-topic interview enrichment (general knowledge, labeled) + note-level sections."""
    head, sections = _split_notes(notes)
    prompts = [_topic_prompt(title, s) for s in sections] + [_note_prompt(title, notes)]
    results = await _gather(llm, prompts, safe=True)
    extras, closing = results[:-1], results[-1]
    enriched = [
        f"{s.strip()}\n\n### Interview prep (general knowledge)\n{x.strip()}" if x.strip() else s.strip()
        for s, x in zip(sections, extras)
    ]
    return "\n\n".join(p for p in [head.strip(), *enriched, closing.strip()] if p)


async def essential_notes(transcript: TranscriptResource, depth: str, llm: LLM,
                          store: TranscriptVectorStore | None = None, enrich: bool = True) -> str:
    notes = await _source_notes(transcript, depth, llm, store)
    if not enrich:
        return notes
    return await _enrich(notes, transcript.title, llm)