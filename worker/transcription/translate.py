"""Tier-3 language fallback: translate a native-language transcript to English with the shared Groq model."""
from services.llm import LLM

_BATCH_CHARS = 3_000  # keeps each English reply inside the shared LLM instance's completion budget
_MAX_ITEMS = 40       # generated caption lines are tiny; JSON overhead per item would otherwise balloon


def _batches(texts: list[str]) -> list[list[tuple[int, str]]]:
    """Group segments into contiguous numbered batches for translation."""
    batches: list[list[tuple[int, str]]] = []
    batch: list[tuple[int, str]] = []
    chars = 0
    for index, text in enumerate(texts):
        batch.append((index, text))
        chars += len(text) + 1
        if chars >= _BATCH_CHARS or len(batch) >= _MAX_ITEMS:
            batches.append(batch)
            batch, chars = [], 0
    if batch:
        batches.append(batch)
    return batches


async def _translate_batch(llm: LLM, language: str, items: list[tuple[int, str]], depth: int = 0) -> dict[int, str]:
    """Translate one numbered batch; on a short or malformed reply, split and retry."""
    numbered = "\n".join(f"{i}|||{text}" for i, (index, text) in enumerate(items))
    prompt = (
        f"Translate every numbered line below from {language} to natural spoken English.\n"
        f"{numbered}\n"
        "Lines are given as 'N|||text'. "
        'Reply with JSON {"items": [{"i": <line number>, "en": "<translation>"}]} '
        "using the same line numbers, one entry per line, no omissions, no commentary."
    )
    found: dict[int, str] = {}
    try:
        payload = await llm.json(prompt)
        rows = payload if isinstance(payload, list) else payload.get("items", [])
        for row in rows:
            if isinstance(row, dict) and str(row.get("i", "")).isdigit() and int(row["i"]) < len(items):
                found[items[int(row["i"])][0]] = str(row.get("en", "")).strip()
        if len(found) == len(items):
            return found
    except Exception:
        pass
    if len(items) == 1 or depth > 6:
        return found  # accept partial coverage rather than stalling the pipeline
    mid = len(items) // 2
    merged = await _translate_batch(llm, language, items[:mid], depth + 1)
    merged.update(await _translate_batch(llm, language, items[mid:], depth + 1))
    return merged


async def translate_to_english(texts: list[str], language: str, llm: LLM | None = None) -> list[str]:
    """Translate transcript segments to English, preserving order and count exactly."""
    if not texts:
        return []
    llm = llm or LLM()
    translated: list[str] = [""] * len(texts)
    for batch in _batches(texts):
        covered = await _translate_batch(llm, language, batch)  # sequential: one rate-limited LLM
        for index, english in covered.items():
            translated[index] = english
    if any(not text for text in translated):
        raise ValueError("We could not translate the full transcript into English")
    return translated
