import asyncio

from pipeline.state import GraphState
from services.checkpointer import JobCheckpointer
from services.vector_store import TranscriptVectorStore

async def prepare_retrieval(state: GraphState, checkpoint: JobCheckpointer) -> dict:
    """Embed transcript chunks once before agent fan-out; agents retrieve instead of consuming the whole source."""
    checkpoint.mark(state["job_id"], "indexing transcript chunks", 35)
    store = await asyncio.to_thread(TranscriptVectorStore.from_transcript, state["transcript"], state["job_id"])
    return {"store": store}
