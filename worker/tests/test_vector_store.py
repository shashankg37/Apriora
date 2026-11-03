from services.vector_store import _split_documents, _wrap_line
from transcription.state import TranscriptResource, TranscriptSegment

def _youtube_transcript(texts: list[str]) -> TranscriptResource:
    segments = [TranscriptSegment(text=text, start=index * 30.0) for index, text in enumerate(texts)]
    return TranscriptResource(url="https://example.com", source_type="youtube", title="Example", segments=segments, full_text="\n".join(texts))

def test_wrap_respects_limit_at_word_boundaries():
    pieces = _wrap_line("alpha beta gamma delta epsilon zeta eta theta", 12)
    assert all(len(piece) <= 12 for piece in pieces)
    assert " ".join(pieces).split() == "alpha beta gamma delta epsilon zeta eta theta".split()

def test_youtube_splits_keep_overlap_reading_order_and_start_metadata():
    transcript = _youtube_transcript([f"line {number} " + "x" * 14 for number in range(12)])
    documents = _split_documents(transcript, doc_chars=48, overlap=8)
    assert len(documents) > 1
    starts = [start for _, start in documents]
    assert starts == sorted(starts)
    assert documents[1][0][:8] == documents[0][0][-8:]  # the next document inherits the previous tail
    for text, _ in documents:
        assert len(text) <= 48 + 8
    joined = "\n".join(text for text, _ in documents)
    assert "[00:00]" in joined and "[01:00]" in joined  # timestamps survive across split documents

def test_articles_split_without_timestamps():
    transcript = TranscriptResource(url="https://example.com", source_type="article", title="Example", segments=[TranscriptSegment(text="word " * 120, start=0.0)], full_text="unused")
    documents = _split_documents(transcript, doc_chars=120, overlap=10)
    assert len(documents) > 1
    assert all("[00:00]" not in text and len(text) <= 130 for text, _ in documents)
