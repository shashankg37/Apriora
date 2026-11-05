from transcription.pipeline import _native_candidate


class Track:
    def __init__(self, code, generated=False):
        self.language_code = code
        self.is_generated = generated


def test_prefers_hindi_then_manual_then_generated():
    listing = [Track("de"), Track("hi", generated=True), Track("ja")]
    assert _native_candidate(listing).language_code == "hi"

def test_manual_caption_wins_over_generated_within_a_language():
    listing = [Track("hi", generated=True), Track("hi")]
    assert _native_candidate(listing).is_generated is False

def test_non_english_codes_are_excluded():
    assert _native_candidate([Track("en-US"), Track("en")]) is None
