"""Token-safe transcript context preparation shared by every downstream agent."""
from typing import Any

from transcription.state import TranscriptResource

# Retrieval aspects restated per agent; every key information class is probed so
# retrieval unions approximate full-source coverage without sending it whole.
NOTES_RETRIEVAL_QUERIES = [
    "key concepts and their definitions",
    "main critical points and arguments",
    "mathematical formulas and derivations",
    "concrete examples and demonstrations",
    "common misconceptions and pitfalls",
    "overall summary of the material",
]

QA_RETRIEVAL_QUERIES = [
    "technical questions and answers",
    "important definitions and explanations",
    "design trade-offs and comparisons",
    "edge cases and tricky details",
    "practical examples and applications",
]

def _timestamp(seconds: float) -> str:
    minutes, seconds = divmod(int(seconds), 60)
    return f"[{minutes:02d}:{seconds:02d}]"

def format_retrieved_context(retrieved: list[dict[str, Any]], max_chars: int = 16_000) -> str:
    """Join retrieved documents in reading order; timestamp each block when known."""
    blocks = [f"{_timestamp(entry['start'])} {entry['doc'].strip()}" if entry.get("start") else entry["doc"].strip() for entry in retrieved]
    joined, output = [], ""
    for block in blocks:
        piece = f"{block}\n\n"
        if output and len(output) + len(piece) > max_chars: break
        output += piece
        joined.append(block)
    return "".join(f"{block}\n\n" for block in joined).strip()

def transcript_chunks(transcript: TranscriptResource, max_chars: int = 8_000) -> list[str]:
    """Split only at transcript-segment boundaries; every agent receives every chunk."""
    chunks, current = [], ""
    for segment in transcript.segments:
        line = f"{_timestamp(segment.start)} {segment.text.strip()}\n"
        if current and len(current) + len(line) > max_chars:
            chunks.append(current.strip())
            current = ""
        current += line
    if current.strip(): chunks.append(current.strip())
    return chunks
