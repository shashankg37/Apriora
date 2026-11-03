from typing import Literal, TypedDict
from services.vector_store import TranscriptVectorStore
from transcription.state import TranscriptResource

class GraphState(TypedDict, total=False):
    job_id: str; owner_id: str; url: str; source_type: Literal["youtube", "article"]; depth: str
    transcript: TranscriptResource
    store: TranscriptVectorStore
    essential_notes: str; interview_qa: str; markdown: str; flags: list[str]
