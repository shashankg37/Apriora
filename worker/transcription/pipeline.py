"""Standalone LangChain pipeline: resource URL -> complete transcript resource.

YouTube transcript language waterfall:
  1. English captions exist -> fetch them directly (unchanged common path).
  2. Captions YouTube can translate -> request the "en" translation server-side; YouTube
     returns English text directly, costing no LLM tokens.
  3. Captions only in another language (e.g. Hindi) -> fetch the native transcript and
     translate it segment-by-segment with the shared Groq model (transcription/translate.py).
No audio download: caption-less videos fail fast with a clear message instead.
"""
import asyncio
from urllib.parse import parse_qs, urlparse

import trafilatura
from langchain_core.runnables import RunnableLambda
from youtube_transcript_api import YouTubeTranscriptApi
from youtube_transcript_api._errors import NoTranscriptFound, TranscriptsDisabled, VideoUnavailable

from transcription.translate import translate_to_english
from transcription.state import TranscriptResource, TranscriptSegment

def _youtube_id(url: str) -> str:
    parsed = urlparse(url)
    video_id = parsed.path.strip("/") if parsed.hostname == "youtu.be" else parse_qs(parsed.query).get("v", [""])[0]
    if not video_id: raise ValueError("Could not identify a YouTube video ID")
    return video_id

def _segments(fetched) -> list[dict]:
    return [{"text": row.text, "start": row.start, "duration": row.duration} for row in fetched]

def _native_candidate(listing):
    """First usable non-English caption track, preferring Hindi and human-made captions."""
    candidates = [transcript for transcript in listing if transcript.language_code.split("-")[0] != "en"]
    if not candidates: return None
    return sorted(candidates, key=lambda t: (t.language_code.split("-")[0] != "hi", t.is_generated))[0]

async def _fetch_youtube(url: str, video_id: str) -> list[dict]:
    try:
        listing = await asyncio.to_thread(YouTubeTranscriptApi().list, video_id)
    except TranscriptsDisabled as exc:
        raise ValueError("This video has no captions at all, so there is nothing to transcribe") from exc
    except VideoUnavailable as exc:
        raise ValueError("That YouTube video is unavailable") from exc

    try:  # tier 1: English captions, the common path — manual wording beats generated wording
        return _segments(await asyncio.to_thread(listing.find_manually_created_transcript(["en"]).fetch))
    except NoTranscriptFound:
        pass
    try:
        return _segments(await asyncio.to_thread(listing.find_transcript(["en"]).fetch))
    except NoTranscriptFound:
        pass

    for transcript in listing:  # tier 2: free server-side translation of any translatable track
        if transcript.is_translatable and transcript.language_code.split("-")[0] != "en":
            try:
                return _segments(await asyncio.to_thread(transcript.translate("en").fetch))
            except Exception:  # listing flags can oversell translation (seen live: TranslationLanguageNotAvailable); fall to tier 3
                pass

    transcript = _native_candidate(listing)  # tier 3: translate the native text with the shared LLM
    if transcript is None:
        raise ValueError("This video has no English captions and no caption track we could translate")
    segments = _segments(await asyncio.to_thread(transcript.fetch))
    english = await translate_to_english([segment["text"] for segment in segments], transcript.language)
    return [{**segment, "text": text} for segment, text in zip(segments, english)]

async def _fetch_resource(input: dict) -> dict:
    url, source_type = input["url"], input["source_type"]
    if source_type == "youtube":
        video_id = _youtube_id(url)
        segments = await _fetch_youtube(url, video_id)
        return {"url": url, "source_type": source_type, "title": f"YouTube video {video_id}", "segments": segments}
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
