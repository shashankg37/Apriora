from transcription.state import TranscriptResource
from services.llm import LLM
from services.vector_store import TranscriptVectorStore, MAX_CONTEXT_CHARS, TOP_K
from agents.context import QA_RETRIEVAL_QUERIES, format_retrieved_context, transcript_chunks

async def _from_retrieval(transcript: TranscriptResource, store: TranscriptVectorStore, llm: LLM) -> str | None:
    retrieved = await store.retrieve(QA_RETRIEVAL_QUERIES, top_k=TOP_K, max_chars=MAX_CONTEXT_CHARS)
    if not retrieved: return None
    context = format_retrieved_context(retrieved, max_chars=MAX_CONTEXT_CHARS)
    return await llm.text(f"""You are the Interview Q&A agent. The blocks below are the relevant transcript segments retrieved from the complete source, in chronological order. Write 10–15 concise technical interview questions and answers on definitions, reasoning, trade-offs, mathematical concepts, examples, and pitfalls, keeping timestamps where useful. Use only what the blocks contain; do not introduce outside knowledge.\n\nSource: {transcript.title}\n\n{context}""")

async def interview_qa(transcript: TranscriptResource, llm: LLM, store: TranscriptVectorStore) -> str:
    chunks = transcript_chunks(transcript)
    if len(chunks) == 1:
        return await llm.text(f"""You are the Interview Q&A agent. Use only this complete source transcript. Write 10–15 concise technical interview questions and answers on definitions, reasoning, trade-offs, mathematical concepts, examples, and pitfalls. Include timestamps where useful. Do not introduce outside knowledge.\n\nSource: {transcript.title}\n{chunks[0]}""")
    if store is not None:
        qa = await _from_retrieval(transcript, store, llm)
        if qa is not None: return qa
    partials = []
    for index, chunk in enumerate(chunks, 1):
        partials.append(await llm.text(f"""You are the Interview Q&A agent. This is part {index}/{len(chunks)} of one complete transcript. Draft the best source-grounded interview Q&A candidates from this part only, with timestamps. Keep this partial analysis under 300 words.\n\n{chunk}"""))
    
    current = partials
    while len(current) > 4 or sum(len(p) for p in current) > 12_000:
        next_level = []
        batch_size = 4
        for i in range(0, len(current), batch_size):
            batch = current[i : i + batch_size]
            if len(batch) == 1 and len(current) > batch_size:
                next_level.append(batch[0])
                continue
            batch_text = "\n\n".join(batch)
            reduced = await llm.text(
                f"""You are the Interview Q&A agent. Merge and select the strongest technical interview questions and answers from these consecutive parts under 500 words. Keep timestamps where useful.\n\n{batch_text}"""
            )
            next_level.append(reduced)
        current = next_level

    combined_partials = "\n\n".join(current)
    return await llm.text(f"""You are the Interview Q&A agent. Combine these partial Q&A candidates, which together cover the complete transcript, into 10–15 concise, deduplicated, source-grounded interview questions and answers. Keep useful timestamps. Do not add outside knowledge.\n\n{combined_partials}""")

