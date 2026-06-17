"""Doubao (Volcengine Ark) configuration.

Reads credentials and model IDs from environment variables. Validation is
lazy: a missing key only raises when the corresponding capability is actually
used, so the rest of the app keeps working without Doubao configured.

Two distinct credential sets are involved:
  * Ark Runtime (video + image) — uses ARK_API_KEY + ARK_BASE_URL.
  * Doubao TTS — a separate Volcengine speech service authenticated with
    app id + access token against the openspeech endpoint.
"""

import os
from dataclasses import dataclass

from open_notebook.ai.doubao.exceptions import DoubaoConfigError

DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
DEFAULT_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v1/tts"


@dataclass(frozen=True)
class DoubaoConfig:
    """Resolved Doubao configuration. Build via :meth:`from_env`."""

    ark_api_key: str | None
    ark_base_url: str
    video_model: str | None
    image_model: str | None
    tts_app_id: str | None
    tts_access_token: str | None
    tts_endpoint: str
    tts_voice_type: str | None
    tts_cluster: str

    @classmethod
    def from_env(cls) -> "DoubaoConfig":
        return cls(
            ark_api_key=_clean(os.environ.get("ARK_API_KEY")),
            ark_base_url=_clean(os.environ.get("ARK_BASE_URL")) or DEFAULT_ARK_BASE_URL,
            video_model=_clean(os.environ.get("DOUBAO_VIDEO_MODEL")),
            image_model=_clean(os.environ.get("DOUBAO_IMAGE_MODEL")),
            tts_app_id=_clean(os.environ.get("DOUBAO_TTS_APP_ID")),
            tts_access_token=_clean(os.environ.get("DOUBAO_TTS_ACCESS_TOKEN")),
            tts_endpoint=_clean(os.environ.get("DOUBAO_TTS_ENDPOINT")) or DEFAULT_TTS_ENDPOINT,
            tts_voice_type=_clean(os.environ.get("DOUBAO_TTS_VOICE_TYPE")),
            tts_cluster=_clean(os.environ.get("DOUBAO_TTS_CLUSTER")) or "volcano_tts",
        )

    def require_ark(self) -> str:
        """Return the Ark API key or raise if unset (video/image use this)."""
        if not self.ark_api_key:
            raise DoubaoConfigError(
                "ARK_API_KEY is not set. Add it to your .env to use Doubao "
                "video/image generation."
            )
        return self.ark_api_key

    def require_video_model(self) -> str:
        if not self.video_model:
            raise DoubaoConfigError(
                "DOUBAO_VIDEO_MODEL is not set. Set it to your Seedance model ID."
            )
        return self.video_model

    def require_image_model(self) -> str:
        if not self.image_model:
            raise DoubaoConfigError(
                "DOUBAO_IMAGE_MODEL is not set. Set it to your Seedream model ID."
            )
        return self.image_model

    def require_tts(self) -> tuple[str, str, str]:
        """Return (app_id, access_token, voice_type) or raise if any unset."""
        missing = [
            name
            for name, val in [
                ("DOUBAO_TTS_APP_ID", self.tts_app_id),
                ("DOUBAO_TTS_ACCESS_TOKEN", self.tts_access_token),
                ("DOUBAO_TTS_VOICE_TYPE", self.tts_voice_type),
            ]
            if not val
        ]
        if missing:
            raise DoubaoConfigError(
                f"Doubao TTS is not fully configured. Missing: {', '.join(missing)}."
            )
        return self.tts_app_id, self.tts_access_token, self.tts_voice_type  # type: ignore[return-value]


def _clean(value: str | None) -> str | None:
    """Strip whitespace; treat empty string as unset (None)."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def get_config() -> DoubaoConfig:
    """Convenience: read a fresh config from the current environment."""
    return DoubaoConfig.from_env()
