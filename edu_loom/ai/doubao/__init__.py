"""Doubao (Volcengine Ark) integration layer.

Provides capability clients backed by Doubao models:
  * DoubaoTTSClient   — speech synthesis (Volcengine openspeech)
  * DoubaoVideoClient — text-to-video (Seedance, async task + poll)
  * DoubaoImageClient — text-to-image (Seedream, synchronous)
  * DoubaoAudioClient — audio/video understanding (seed-2.0-lite, transcription
    + understanding from a local file via chat/completions)

Plus configuration and a unified exception hierarchy. Subproject C consumes
these clients directly.
"""

from open_notebook.ai.doubao.audio import (
    DoubaoAudioClient,
    AudioResult,
    is_media_file,
)
from open_notebook.ai.doubao.config import DoubaoConfig, get_config
from open_notebook.ai.doubao.exceptions import (
    DoubaoConfigError,
    DoubaoError,
    DoubaoTaskFailed,
    DoubaoTimeout,
)
from open_notebook.ai.doubao.image import DoubaoImageClient, ImageResult
from open_notebook.ai.doubao.tts import DoubaoTTSClient, TTSResult
from open_notebook.ai.doubao.video import DoubaoVideoClient, VideoResult

__all__ = [
    "DoubaoConfig",
    "get_config",
    "DoubaoError",
    "DoubaoConfigError",
    "DoubaoTaskFailed",
    "DoubaoTimeout",
    "DoubaoTTSClient",
    "TTSResult",
    "DoubaoVideoClient",
    "VideoResult",
    "DoubaoImageClient",
    "ImageResult",
    "DoubaoAudioClient",
    "AudioResult",
    "is_media_file",
]
