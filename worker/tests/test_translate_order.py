import asyncio

from transcription.translate import translate_to_english


class FakeLLM:
    """Prompts return shuffled keys on purpose; ordering must come from reassembly."""

    def __init__(self, mapping: dict[str, str]):
        self.mapping = mapping

    async def json(self, prompt: str):
        keys = [line for line in prompt.splitlines() if "|||" in line]
        return {"items": [{"i": i, "en": self.mapping.get(line.split("|||", 1)[1], line)} for i, line in enumerate(keys)]}


def test_translation_preserves_order_and_count():
    llm = FakeLLM({"namaste": "hello", "dhanyavaad": "thank you"})
    result = asyncio.run(translate_to_english(["namaste", "dhanyavaad", "namaste"], "Hindi", llm=llm))
    assert result == ["hello", "thank you", "hello"]

def test_translation_rejects_partial_coverage():
    class EmptyLLM:
        async def json(self, prompt): return {}

    import pytest
    with pytest.raises(ValueError):
        asyncio.run(translate_to_english(["kuch", "nahi"], "Hindi", llm=EmptyLLM()))
