"""Smoke test: does seed-2.0-lite accept base64 input_audio via chat/completions?

This is the FOUNDATION check for the Doubao audio/video understanding design
(docs/superpowers/specs/2026-06-18-doubao-audio-video-understanding-design.md).

It is NOT part of pytest — it makes a real, paid Ark call. Run manually:

    .venv/bin/python scripts/doubao_audio_smoke_test.py

What it verifies:
  1. chat/completions accepts a base64 `data:` URI in an `input_audio` part.
  2. seed-2.0-lite returns a non-empty transcription/understanding of the clip.

The bundled clip says "Hello there", so a passing run prints text mentioning
that. If Ark rejects base64 input_audio (HTTP 400 invalid value), this is where
we find out — and the design falls back to the TOS + Responses API route.
"""

import base64
import sys
from pathlib import Path

from dotenv import load_dotenv
from loguru import logger

load_dotenv()

from open_notebook.ai.doubao.client import build_ark_client  # noqa: E402
from open_notebook.ai.doubao.config import get_config  # noqa: E402

# The bundled speech clip used elsewhere for STT connection testing.
CLIP = Path(__file__).resolve().parents[1] / "edu_loom" / "ai" / "assets" / "test_speech.mp3"

PROMPT = "请先完整转写这段音频的内容，再用一句话说明它讲了什么。"


def main() -> int:
    config = get_config()
    if not config.ark_api_key:
        logger.error("ARK_API_KEY is not set in .env — cannot run smoke test.")
        return 1

    audio_b64 = base64.b64encode(CLIP.read_bytes()).decode("ascii")
    logger.info(f"Clip: {CLIP.name} ({CLIP.stat().st_size} bytes, {len(audio_b64)} b64 chars)")
    logger.info(f"Model: {config.llm_model}")

    client = build_ark_client(config)

    # Two shapes are seen in the wild for input_audio. Try the OpenAI-style
    # data+format object first; fall back to a data: URI string.
    attempts = [
        (
            "input_audio object (data+format)",
            {"type": "input_audio", "input_audio": {"data": audio_b64, "format": "mp3"}},
        ),
        (
            "input_audio data: URI",
            {"type": "input_audio", "input_audio": {"data": f"data:audio/mp3;base64,{audio_b64}", "format": "mp3"}},
        ),
    ]

    for label, audio_part in attempts:
        logger.info(f"--- Attempt: {label} ---")
        try:
            resp = client.chat.completions.create(
                model=config.llm_model,
                messages=[
                    {
                        "role": "user",
                        "content": [
                            audio_part,
                            {"type": "text", "text": PROMPT},
                        ],
                    }
                ],
            )
            text = resp.choices[0].message.content
            logger.success(f"ACCEPTED. Model returned:\n{text}")
            logger.success(f"Working audio part shape: {label}")
            return 0
        except Exception as e:  # noqa: BLE001 — smoke test, surface everything
            logger.warning(f"Rejected ({label}): {type(e).__name__}: {e}")

    logger.error(
        "Both base64 input_audio shapes were rejected. "
        "chat/completions + base64 is NOT viable for audio — "
        "fall back to the TOS + Responses API route (see spec)."
    )
    return 2


if __name__ == "__main__":
    sys.exit(main())
