"""Standalone LangChain pipeline: resource URL -> complete transcript resource."""
import asyncio
from urllib.parse import parse_qs, urlparse

import trafilatura
from langchain_core.runnables import RunnableLambda
from youtube_transcript_api import YouTubeTranscriptApi

from transcription.state import TranscriptResource, TranscriptSegment

def _youtube_id(url: str) -> str:
    parsed = urlparse(url)
    video_id = parsed.path.strip("/") if parsed.hostname == "youtu.be" else parse_qs(parsed.query).get("v", [""])[0]
    if not video_id: raise ValueError("Could not identify a YouTube video ID")
    return video_id

async def _fetch_resource(input: dict) -> dict:
    url, source_type = input["url"], input["source_type"]
    if source_type == "youtube":
        video_id = _youtube_id(url)
        fetched = await asyncio.to_thread(YouTubeTranscriptApi().fetch, video_id)
        return {"url": url, "source_type": source_type, "title": f"YouTube video {video_id}", "segments": [{"text": row.text, "start": row.start, "duration": row.duration} for row in fetched]}
    page = await asyncio.to_thread(trafilatura.fetch_url, url)
    text = trafilatura.extract(page or "", include_comments=False, include_tables=True)
    if not text: raise ValueError("We could not extract readable article text from that page")
    return {"url": url, "source_type": source_type, "title": urlparse(url).netloc, "segments": [{"text": text, "start": 0.0, "duration": 0.0}]}

def _assemble_context(raw: dict) -> TranscriptResource:
    segments = [TranscriptSegment.model_validate(value) for value in raw["segments"]]
    full_text = "\n".join(segment.text.strip() for segment in segments if segment.text.strip())
    if not full_text: raise ValueError("The resource did not provide a usable transcript")
    return TranscriptResource(url=raw["url"], source_type=raw["source_type"], title=raw["title"], segments=segments, full_text=full_text)

# Kept independent of LangGraph so it can be called/tested as the resource pipeline.
resource_to_transcript = RunnableLambda(_fetch_resource) | RunnableLambda(_assemble_context)

async def transcribe_resource(url: str, source_type: str) -> TranscriptResource:
    return await resource_to_transcript.ainvoke({"url": url, "source_type": source_type})
