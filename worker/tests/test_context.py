from agents.context import transcript_chunks
from transcription.state import TranscriptResource, TranscriptSegment

def test_chunks_preserve_all_segments_and_timestamps():
    transcript = TranscriptResource(url="https://example.com", source_type="youtube", title="Example", full_text="unused", segments=[TranscriptSegment(text="first", start=0), TranscriptSegment(text="second", start=65)])
    chunks = transcript_chunks(transcript, max_chars=20)
    combined = "\n".join(chunks)
    assert "[00:00] first" in combined
    assert "[01:05] second" in combined
