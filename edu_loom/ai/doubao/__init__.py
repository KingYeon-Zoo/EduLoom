"""Doubao (Volcengine Ark) integration layer.

Provides three capability clients backed by Doubao models:
  * DoubaoTTSClient   — speech synthesis (Volcengine openspeech)
  * DoubaoVideoClient — text-to-video (Seedance, async task + poll)
  * DoubaoImageClient — text-to-image (Seedream, synchronous)

Plus configuration and a unified exception hierarchy. Subproject C consumes
these clients directly.
"""

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
]
