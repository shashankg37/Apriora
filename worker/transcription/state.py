from typing import Literal
from pydantic import BaseModel, Field

class TranscriptSegment(BaseModel):
    text: str
    start: float = 0.0
    duration: float = 0.0

class TranscriptResource(BaseModel):
    url: str
    source_type: Literal["youtube", "article"]
    title: str
    segments: list[TranscriptSegment] = Field(default_factory=list)
    full_text: str
