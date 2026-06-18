"""Doubao (Volcengine Ark) configuration.

Reads credentials and model IDs from environment variables. Validation is
lazy: a missing key only raises when the corresponding capability is actually
used, so the rest of the app keeps working without Doubao configured.

Two distinct credential sets are involved:
  * Ark Runtime (video + image) — uses ARK_API_KEY + ARK_BASE_URL.
  * Doubao TTS — a separate Volcengine speech service. We target the V3
    unidirectional HTTP interface (required for seed-tts-2.0 voices). Auth is
    either the new-console API key (X-Api-Key) or the legacy app id + access
    token (X-Api-App-Id / X-Api-Access-Key), plus an X-Api-Resource-Id.
"""

import os
from dataclasses import dataclass

from open_notebook.ai.doubao.exceptions import DoubaoConfigError

DEFAULT_ARK_BASE_URL = "https://ark.cn-beijing.volces.com/api/v3"
DEFAULT_TTS_ENDPOINT = "https://openspeech.bytedance.com/api/v3/tts/unidirectional"
DEFAULT_TTS_RESOURCE_ID = "seed-tts-2.0"
DEFAULT_EMBEDDING_MODEL = "doubao-embedding-vision-251215"
DEFAULT_LLM_MODEL = "doubao-seed-2-0-lite-260428"


@dataclass(frozen=True)
class DoubaoConfig:
    """Resolved Doubao configuration. Build via :meth:`from_env`."""

    ark_api_key: str | None
    ark_base_url: str
    video_model: str | None
    image_model: str | None
    embedding_model: str
    llm_model: str
    # TTS (V3 unidirectional)
    tts_endpoint: str
    tts_resource_id: str
    tts_speaker: str | None
    tts_api_key: str | None  # new console: X-Api-Key
    tts_app_id: str | None  # legacy console: X-Api-App-Id
    tts_access_token: str | None  # legacy console: X-Api-Access-Key

    @classmethod
    def from_env(cls) -> "DoubaoConfig":
        return cls(
            ark_api_key=_clean(os.environ.get("ARK_API_KEY")),
            ark_base_url=_clean(os.environ.get("ARK_BASE_URL")) or DEFAULT_ARK_BASE_URL,
            video_model=_clean(os.environ.get("DOUBAO_VIDEO_MODEL")),
            image_model=_clean(os.environ.get("DOUBAO_IMAGE_MODEL")),
            embedding_model=_clean(os.environ.get("DOUBAO_EMBEDDING_MODEL"))
            or DEFAULT_EMBEDDING_MODEL,
            llm_model=_clean(os.environ.get("DOUBAO_LLM_MODEL")) or DEFAULT_LLM_MODEL,
            tts_endpoint=_clean(os.environ.get("DOUBAO_TTS_ENDPOINT")) or DEFAULT_TTS_ENDPOINT,
            tts_resource_id=_clean(os.environ.get("DOUBAO_TTS_RESOURCE_ID")) or DEFAULT_TTS_RESOURCE_ID,
            tts_speaker=_clean(os.environ.get("DOUBAO_TTS_SPEAKER")),
            tts_api_key=_clean(os.environ.get("DOUBAO_TTS_API_KEY")),
            tts_app_id=_clean(os.environ.get("DOUBAO_TTS_APP_ID")),
            tts_access_token=_clean(os.environ.get("DOUBAO_TTS_ACCESS_TOKEN")),
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

    def embeddings_url(self) -> str:
        """Full URL for the Ark multimodal embeddings endpoint.

        The vision embedding model (doubao-embedding-vision-*) is served from
        the ``/embeddings/multimodal`` path rather than the plain
        ``/embeddings`` text endpoint.
        """
        return f"{self.ark_base_url.rstrip('/')}/embeddings/multimodal"

    def tts_auth_headers(self) -> dict[str, str]:
        """Build V3 TTS auth headers, or raise if neither auth method is set.

        Prefers the new-console API key (X-Api-Key); falls back to the legacy
        app id + access token. X-Api-Resource-Id is always required.
        """
        headers = {"X-Api-Resource-Id": self.tts_resource_id}
        if self.tts_api_key:
            headers["X-Api-Key"] = self.tts_api_key
            return headers
        if self.tts_app_id and self.tts_access_token:
            headers["X-Api-App-Id"] = self.tts_app_id
            headers["X-Api-Access-Key"] = self.tts_access_token
            return headers
        raise DoubaoConfigError(
            "Doubao TTS auth is not configured. Set DOUBAO_TTS_API_KEY (new "
            "console), or both DOUBAO_TTS_APP_ID and DOUBAO_TTS_ACCESS_TOKEN "
            "(legacy console)."
        )

    def require_speaker(self) -> str:
        if not self.tts_speaker:
            raise DoubaoConfigError(
                "DOUBAO_TTS_SPEAKER is not set. For seed-tts-2.0 use a "
                "'*_uranus_bigtts' voice, e.g. zh_female_vv_uranus_bigtts."
            )
        return self.tts_speaker


def _clean(value: str | None) -> str | None:
    """Strip whitespace; treat empty string as unset (None)."""
    if value is None:
        return None
    value = value.strip()
    return value or None


def get_config() -> DoubaoConfig:
    """Convenience: read a fresh config from the current environment."""
    return DoubaoConfig.from_env()
