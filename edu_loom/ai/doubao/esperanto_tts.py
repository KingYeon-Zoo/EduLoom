"""Esperanto-compatible Doubao TTS provider (path 1 of the deep-integration design).

podcast-creator generates audio via ``esperanto.AIFactory.create_text_to_speech(
provider, ...)``. Esperanto ships no Doubao provider, so we implement the
Esperanto ``TextToSpeechModel`` interface here and register it into the
factory's provider map at startup (see ``register.py``). podcast-creator stays
untouched; selecting provider ``"doubao"`` routes audio through our
``DoubaoTTSClient``.

The ``voice`` passed by podcast-creator is the speaker's ``voice_id`` — i.e. a
Doubao voice such as ``zh_female_vv_uranus_bigtts``.
"""

import asyncio
from pathlib import Path
from typing import Optional, Union

from esperanto.common_types import Model
from esperanto.common_types.tts import AudioResponse, Voice
from esperanto.providers.tts.base import TextToSpeechModel

from edu_loom.ai.doubao.config import get_config
from edu_loom.ai.doubao.tts import DoubaoTTSClient
from edu_loom.ai.doubao.voices import BUILTIN_VOICES

PROVIDER_NAME = "doubao"



class DoubaoTextToSpeechModel(TextToSpeechModel):
    """Esperanto TTS provider backed by DoubaoTTSClient."""

    def __post_init__(self):
        super().__post_init__()
        # Build the underlying client lazily-but-once; config comes from env.
        self._client = DoubaoTTSClient(config=get_config())

    def generate_speech(
        self,
        text: str,
        voice: str,
        output_file: Optional[Union[str, Path]] = None,
        **kwargs,
    ) -> AudioResponse:
        result = self._client.synthesize(text, speaker=voice)
        if output_file:
            self.save_audio(result.audio, output_file)
        return AudioResponse(
            audio_data=result.audio,
            content_type=f"audio/{result.encoding}",
        )

    async def agenerate_speech(
        self,
        text: str,
        voice: str,
        output_file: Optional[Union[str, Path]] = None,
        **kwargs,
    ) -> AudioResponse:
        # DoubaoTTSClient is synchronous (single HTTP call); run it off the loop.
        return await asyncio.to_thread(
            self.generate_speech, text, voice, output_file, **kwargs
        )

    @property
    def available_voices(self) -> dict[str, Voice]:
        return {
            v.id: Voice(name=v.name, id=v.id, gender=v.gender.upper())
            for v in BUILTIN_VOICES
        }

    def _get_models(self) -> list[Model]:
        return [Model(id="seed-tts-2.0", owned_by="doubao")]

    def _get_provider_type(self) -> str:
        return "text_to_speech"

    @property
    def provider(self) -> str:
        return PROVIDER_NAME
