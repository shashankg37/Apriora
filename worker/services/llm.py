import json
import os
import asyncio
import time
import ssl
from collections import deque
from typing import Any

import httpx
from groq import AsyncGroq

from config import settings


import re


class LLM:
    def __init__(self, input_tokens_per_minute: int = 6_000, output_tokens_per_minute: int = 1_000) -> None:
        self.model = os.environ.get("GROQ_MODEL", settings.groq_model)
        # Trust the OS certificate store, not certifi: enterprise HTTPS inspection
        # (Kaspersky-class) re-signs api.groq.com with a local root absent from certifi.
        self.client = AsyncGroq(
            api_key=os.environ.get("GROQ_API_KEY", settings.groq_api_key),
            http_client=httpx.AsyncClient(verify=ssl.create_default_context()),
        )
        # Stay below Groq's TPM/OTPM limit on the on-demand tier. This instance is shared by both agents.
        self.input_tokens_per_minute = input_tokens_per_minute
        self.output_tokens_per_minute = output_tokens_per_minute
        # Without an explicit max_tokens Groq assumes the model default (1816 for qwen/qwen3.8-27b),
        # which exceeds the tier's OTPM and gets rejected before generation starts.
        self.max_completion_tokens = max(1, output_tokens_per_minute - 50)
        self._usage: deque[tuple[float, int]] = deque()
        self._usage_out: deque[tuple[float, int]] = deque()
        self._usage_lock = asyncio.Lock()

    async def _wait_slot(self, bucket: deque[tuple[float, int]], limit: int, tokens: int) -> None:
        while True:
            async with self._usage_lock:
                now = time.monotonic()
                while bucket and now - bucket[0][0] >= 60:
                    bucket.popleft()
                used = sum(count for _, count in bucket)
                if used + tokens <= limit:
                    bucket.append((now, tokens))
                    return
                delay = 60.0 - (now - bucket[0][0]) if bucket else 1.0
            await asyncio.sleep(max(delay, 0.5))

    async def _reserve_input(self, prompt: str) -> None:
        estimated = max(1, len(prompt) // 4)  # conservative approximation for English-heavy transcripts
        if estimated > self.input_tokens_per_minute:
            raise ValueError("A prepared request exceeds the Groq input-token budget; reduce its transcript chunk size.")
        await self._wait_slot(self._usage, self.input_tokens_per_minute, estimated)

    async def _reserve_output(self) -> None:
        await self._wait_slot(self._usage_out, self.output_tokens_per_minute, self.max_completion_tokens)

    def _record_output(self, completion_tokens: int | None) -> None:
        if not completion_tokens or not self._usage_out:
            return
        timestamp, _ = self._usage_out.pop()
        self._usage_out.append((timestamp, min(completion_tokens, self.max_completion_tokens)))

    async def _create_with_retry(self, **kwargs):
        """Retry transient Groq/network faults; respect retry-after for rate limits."""
        for attempt in range(6):
            try:
                return await self.client.chat.completions.create(**kwargs)
            except Exception as exc:
                status_code = getattr(exc, "status_code", None)
                transient = type(exc).__name__ in {"APIConnectionError", "RateLimitError", "InternalServerError"} or status_code in {429, 500, 502, 503, 504}
                if not transient or attempt == 5:
                    raise
                delay = float(2 ** attempt)
                response = getattr(exc, "response", None)
                if response and hasattr(response, "headers"):
                    retry_after = response.headers.get("retry-after")
                    if retry_after:
                        try:
                            delay = max(delay, float(retry_after) + 0.5)
                        except (ValueError, TypeError):
                            pass
                match = re.search(r"try again in ([0-9.]+)s", str(exc))
                if match:
                    try:
                        delay = max(delay, float(match.group(1)) + 0.5)
                    except (ValueError, TypeError):
                        pass
                await asyncio.sleep(delay)
    async def json(self, prompt: str) -> dict[str, Any]:
        await self._reserve_input(prompt)
        await self._reserve_output()
        response = await self._create_with_retry(model=self.model, temperature=0.15, max_tokens=self.max_completion_tokens, response_format={"type": "json_object"}, messages=[{"role": "system", "content": "Return only valid JSON. Do not add facts absent from the supplied source."}, {"role": "user", "content": prompt}])
        self._record_output(getattr(getattr(response, "usage", None), "completion_tokens", None))
        return json.loads(response.choices[0].message.content or "{}")
    async def text(self, prompt: str) -> str:
        await self._reserve_input(prompt)
        await self._reserve_output()
        response = await self._create_with_retry(model=self.model, temperature=0.2, max_tokens=self.max_completion_tokens, messages=[{"role": "system", "content": "Write accurate Markdown. Never invent unsupported details."}, {"role": "user", "content": prompt}])
        self._record_output(getattr(getattr(response, "usage", None), "completion_tokens", None))
        return response.choices[0].message.content or ""
