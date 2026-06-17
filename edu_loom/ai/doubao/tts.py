"""Doubao TTS client (Volcengine speech synthesis).

Doubao TTS is NOT part of the Ark Runtime SDK — it's a separate Volcengine
speech service authenticated with an app id + access token against the
openspeech endpoint. We call it directly over HTTP. The response carries the
synthesized audio as base64; this client decodes it and returns raw bytes.
"""

import base64
import uuid
from dataclasses import dataclass

import httpx
from loguru import logger

from open_notebook.ai.doubao.config import DoubaoConfig, get_config
from open_notebook.ai.doubao.exceptions import DoubaoError

_TIMEOUT_SECONDS = 60.0


@dataclass
class TTSResult:
    """Outcome of a TTS synthesis call."""

    audio: bytes
    encoding: str  # e.g. "mp3"


class DoubaoTTSClient:
    """Thin wrapper over the Volcengine openspeech TTS HTTP endpoint."""

    def __init__(self, config: DoubaoConfig | None = None):
        self._config = config or get_config()

    def synthesize(
        self,
        text: str,
        *,
        voice_type: str | None = None,
        encoding: str = "mp3",
        speed_ratio: float = 1.0,
    ) -> TTSResult:
        """Synthesize speech for ``text`` and return decoded audio bytes."""
        app_id, access_token, default_voice = self._config.require_tts()
        voice = voice_type or default_voice

        payload = {
            "app": {
                "appid": app_id,
                "token": access_token,
                "cluster": self._config.tts_cluster,
            },
            "user": {"uid": "edu_loom"},
            "audio": {
                "voice_type": voice,
                "encoding": encoding,
                "speed_ratio": speed_ratio,
            },
            "request": {
                "reqid": str(uuid.uuid4()),
                "text": text,
                "operation": "query",
            },
        }
        headers = {"Authorization": f"Bearer;{access_token}"}

        logger.info(f"Synthesizing Doubao TTS ({len(text)} chars, voice={voice})")
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

        body = resp.json()
        # Volcengine TTS returns code 3000 on success; audio is base64 in "data".
        code = body.get("code")
        if code != 3000 or "data" not in body:
            raise DoubaoError(
                f"Doubao TTS returned error (code={code}): {body.get('message')}"
            )

        return TTSResult(audio=base64.b64decode(body["data"]), encoding=encoding)
