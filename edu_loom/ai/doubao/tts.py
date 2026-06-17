"""Doubao TTS client (Volcengine V3 unidirectional speech synthesis).

Doubao TTS is NOT part of the Ark Runtime SDK — it's a separate Volcengine
speech service. We target the V3 unidirectional HTTP interface, which is
required for seed-tts-2.0 ('*_uranus_bigtts') voices.

The response is NDJSON: one JSON object per line. Audio arrives as base64 in
the ``data`` field across multiple chunks (``code == 0``); a final line with
``code == 20000000`` signals end of stream. We accumulate and decode the
chunks into a single audio blob. Calling ``response.json()`` on the whole body
would fail — it is not a single JSON object.
"""

import base64
import json
from dataclasses import dataclass

import httpx
from loguru import logger

from open_notebook.ai.doubao.config import DoubaoConfig, get_config
from open_notebook.ai.doubao.exceptions import DoubaoError

_TIMEOUT_SECONDS = 120.0
_STREAM_END_CODE = 20000000


@dataclass
class TTSResult:
    """Outcome of a TTS synthesis call."""

    audio: bytes
    encoding: str  # e.g. "mp3"


class DoubaoTTSClient:
    """Wrapper over the Volcengine V3 unidirectional TTS HTTP endpoint."""

    def __init__(self, config: DoubaoConfig | None = None):
        self._config = config or get_config()

    def synthesize(
        self,
        text: str,
        *,
        speaker: str | None = None,
        encoding: str = "mp3",
        sample_rate: int = 24000,
        speed_ratio: float = 1.0,
    ) -> TTSResult:
        """Synthesize speech for ``text`` and return decoded audio bytes."""
        headers = {
            "Content-Type": "application/json",
            **self._config.tts_auth_headers(),
        }
        voice = speaker or self._config.require_speaker()
        payload = {
            "user": {"uid": "edu_loom"},
            "req_params": {
                "text": text,
                "speaker": voice,
                "audio_params": {
                    "format": encoding,
                    "sample_rate": sample_rate,
                    "speech_rate": _to_speech_rate(speed_ratio),
                },
            },
        }

        logger.info(f"Synthesizing Doubao TTS ({len(text)} chars, speaker={voice})")
        try:
            resp = httpx.post(
                self._config.tts_endpoint,
                json=payload,
                headers=headers,
                timeout=_TIMEOUT_SECONDS,
            )
            resp.raise_for_status()
        except httpx.HTTPError as e:
            raise DoubaoError(f"Doubao TTS request failed: {e}") from e

        audio = _decode_ndjson_audio(resp.text)
        if not audio:
            raise DoubaoError("Doubao TTS returned no audio data.")
        return TTSResult(audio=audio, encoding=encoding)


def _to_speech_rate(speed_ratio: float) -> int:
    """Map a 1.0-centered speed ratio to V3's integer speech_rate (0 = normal).

    V3 uses an integer in roughly [-50, 100] where 0 is normal speed; we map a
    multiplicative ratio onto that scale (e.g. 1.0 -> 0, 1.5 -> 50).
    """
    return int(round((speed_ratio - 1.0) * 100))


def _decode_ndjson_audio(body: str) -> bytes:
    """Accumulate base64 audio chunks from an NDJSON TTS response body."""
    chunks: list[bytes] = []
    for line in body.splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            obj = json.loads(line)
        except json.JSONDecodeError:
            continue
        code = obj.get("code")
        if code == _STREAM_END_CODE:
            break
        # Non-zero, non-end codes indicate an error line.
        if code not in (0, None) and "data" not in obj:
            raise DoubaoError(
                f"Doubao TTS error (code={code}): {obj.get('message')}"
            )
        data = obj.get("data")
        if data:
            chunks.append(base64.b64decode(data))
    return b"".join(chunks)
