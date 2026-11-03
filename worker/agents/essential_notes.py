import asyncio
from transcription.state import TranscriptResource
from services.llm import LLM
from services.vector_store import TranscriptVectorStore, MAX_CONTEXT_CHARS, TOP_K
from agents.context import NOTES_RETRIEVAL_QUERIES, format_retrieved_context, transcript_chunks

CONCURRENCY = 4
BATCH_SIZE = 4
MAX_PARTIAL_CHARS = 12_000

SPEC = ("interview-ready Markdown with TL;DR, key concepts (term, definition, why it matters), "
        "critical points with timestamps, mathematical formulas, examples, and misconceptions")


async def _gather(llm: LLM, prompts: list[str]) -> list[str]:
    sem = asyncio.Semaphore(CONCURRENCY)

    async def run(p: str) -> str:
        async with sem:
            return await llm.text(p)

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
        f"from the complete source, in chronological order. Produce {depth} {SPEC}. "
        f"Use only what the blocks contain; do not invent facts.\n\nSource: {transcript.title}\n\n{context}"
    )


async def essential_notes(transcript: TranscriptResource, depth: str, llm: LLM,
                          store: TranscriptVectorStore | None = None) -> str:
    chunks = transcript_chunks(transcript)
    if not chunks:
        raise ValueError("Transcript is empty")

    if len(chunks) == 1:
        return await llm.text(
            f"You are the Essential Notes agent. Use only this complete source transcript. "
            f"Produce {depth} {SPEC}. Do not invent facts.\n\nSource: {transcript.title}\n{chunks[0]}"
        )

    if store is not None:
        notes = await _from_retrieval(transcript, store, depth, llm)
        if notes is not None:
            return notes

    n = len(chunks)
    current = await _gather(llm, [
        f"You are the Essential Notes agent. This is part {i}/{n} of one complete transcript. "
        f"Extract only source-grounded critical concepts, formulas, examples, misconceptions, and "
        f"timestamps. Keep this partial analysis under 300 words.\n\n{c}"
        for i, c in enumerate(chunks, 1)
    ])

    while len(current) > BATCH_SIZE or sum(map(len, current)) > MAX_PARTIAL_CHARS:
        batches = [current[i:i + BATCH_SIZE] for i in range(0, len(current), BATCH_SIZE)]
        to_reduce = [b for b in batches if len(b) > 1 or len(current) <= BATCH_SIZE]
        passthrough = [b[0] for b in batches if len(b) == 1 and len(current) > BATCH_SIZE]
        reduced = await _gather(llm, [
            "You are the Essential Notes agent. Condense and merge these partial analyses covering "
            "consecutive sections of a transcript into a coherent intermediate summary under 500 words. "
            "Preserve key technical concepts, formulas, examples, and timestamps.\n\n" + "\n\n".join(b)
            for b in to_reduce
        ])
        current = reduced + passthrough  # NOTE: order caveat below

    return await llm.text(
        f"You are the Essential Notes agent. Combine these partial analyses, which together cover the "
        f"complete transcript, into {depth} {SPEC}. Deduplicate; do not add outside facts.\n\n"
        + "\n\n".join(current)
    )