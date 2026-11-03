"""Per-job transcript chunk index in ChromaDB for on-demand agent retrieval."""
import asyncio
from typing import Any

import chromadb
from chromadb.config import Settings as ChromaSettings

from transcription.state import TranscriptResource

DOC_CHARS = 1_200            # retrieval-document size; well below the agents' 8k map chunks
OVERLAP_CHARS = 150          # tail carried into the next chunk so splits keep local context
MAX_CONTEXT_CHARS = 16_000   # retrieval union cap; keeps prompts inside the Groq TPM budget
TOP_K = 4

_client: chromadb.ClientAPI | None = None


def _timestamp(seconds: float) -> str:
    minutes, seconds = divmod(int(seconds), 60)
    return f"[{minutes:02d}:{seconds:02d}]"


def collection_name(job_id: str) -> str:
    return f"intervnotes-{job_id}"


def _wrap_line(text: str, limit: int) -> list[str]:
    """Wrap oversized text at word boundaries; articles arrive as one huge segment."""
    if len(text) <= limit: return [text]
    pieces: list[str] = []
    while len(text) > limit:
        cut = text.rfind(" ", 0, limit)
        if cut <= 0: cut = limit
        pieces.append(text[:cut].strip())
        text = text[cut:].strip()
    pieces.append(text.strip())
    return [piece for piece in pieces if piece]


def _split_documents(transcript: TranscriptResource, doc_chars: int, overlap: int) -> list[tuple[str, float]]:
    """Pack transcript lines into retrieval documents; returns (text, start_seconds) pairs.

    Article sources carry no timestamps and land as consecutive wrapped paragraphs.
    Documents stay at ``≈doc_chars + overlap`` so the union cap stays predictable.
    """
    documents: list[tuple[str, float]] = []
    current: list[str] = []
    current_start = 0.0
    for segment in transcript.segments:
        text = segment.text.strip()
        if not text: continue
        stamp = f"{_timestamp(segment.start)} " if transcript.source_type == "youtube" else ""
        for piece in _wrap_line(f"{stamp}{text}", doc_chars):
            line = piece + "\n"
            if current and len("".join(current)) + len(line) > doc_chars:
                tail = "".join(current).strip()[-overlap:]
                documents.append(("".join(current).strip(), current_start))
                current, current_start = ([f"{tail}\n"] if tail else []), segment.start
            current.append(line)
    if current and "".join(current).strip(): documents.append(("".join(current).strip(), current_start))
    return documents


class TranscriptVectorStore:
    """Retrieval-only vector index over one acquired transcript.

    Collections live in a process-wide ephemeral Chroma client and are named per
    job, so concurrent jobs never share vectors; callers must ``drop()`` the job
    collection when the pipeline finishes. Uses Chroma's default local MiniLM
    embedding; the model downloads once per host on first use.
    """

    def __init__(self, collection: chromadb.Collection, total_docs: int, job_id: str) -> None:
        self._collection: chromadb.Collection | None = collection
        self._job_id = job_id
        self._lock = asyncio.Lock()  # never hold this across a raw thread wait; the loop must stay free
        self.total_docs = total_docs

    @classmethod
    def from_transcript(cls, transcript: TranscriptResource, job_id: str) -> "TranscriptVectorStore":
        global _client
        if _client is None: _client = chromadb.EphemeralClient(settings=ChromaSettings(anonymized_telemetry=False))
        documents = _split_documents(transcript, DOC_CHARS, OVERLAP_CHARS)
        if not documents: raise ValueError("The transcript produced no retrievable chunks to index")
        try: _client.delete_collection(collection_name(job_id))  # idempotent; guards re-runs of the same job id
        except Exception: pass
        collection = _client.get_or_create_collection(collection_name(job_id))
        collection.add(
            ids=[f"{job_id}:{index}" for index in range(len(documents))],
            documents=[text for text, _ in documents],
            metadatas=[{"start": start, "start_ts": _timestamp(start)} for _, start in documents],
        )
        return cls(collection, len(documents), job_id)

    @staticmethod
    def drop(job_id: str) -> None:
        """Delete a job collection by name; absent collections are tolerated."""
        if _client is None: return
        try: _client.delete_collection(collection_name(job_id))
        except Exception: pass

    def dispose(self) -> None: self.drop(self._job_id)

    async def retrieve(self, queries: list[str], top_k: int = TOP_K, max_chars: int = MAX_CONTEXT_CHARS) -> list[dict[str, Any]]:
        """Similarity search per query, merged by best distance, capped by the char budget, in reading order."""
        if not queries or self._collection is None: return []
        n_results = min(top_k, self.total_docs)
        collection = self._collection
        async with self._lock:  # serialize chroma queries around the shared embedding model
            hits = await asyncio.to_thread(collection.query, query_texts=queries, n_results=n_results)
        best: dict[str, dict[str, Any]] = {}
        for query_index, ids in enumerate(hits["ids"]):
            for slot, id_ in enumerate(ids):
                hit = {
                    "doc": hits["documents"][query_index][slot],
                    "distance": hits["distances"][query_index][slot],
                    "start": hits["metadatas"][query_index][slot].get("start", 0.0),
                }
                if id_ not in best or hit["distance"] < best[id_]["distance"]: best[id_] = hit
        selected: list[dict[str, Any]] = []
        budget_left = max_chars
        for id_ in sorted(best, key=lambda key: (best[key]["distance"], key)):
            if len(best[id_]["doc"]) <= budget_left:
                selected.append({**best[id_], "id": id_}); budget_left -= len(best[id_]["doc"])
        return sorted(selected, key=lambda hit: hit["start"])
