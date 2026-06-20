"""Doubao image generation client (Seedream, via Ark images API).

Image generation is synchronous (single call returns the result), so this is
a thin wrapper over ``ark.images.generate``.
"""

from dataclasses import dataclass

from loguru import logger

from open_notebook.ai.doubao.client import build_ark_client
from open_notebook.ai.doubao.config import DoubaoConfig, get_config


@dataclass
class ImageResult:
    """Outcome of an image generation call."""

    url: str | None
    b64_json: str | None
    raw: object  # the SDK response, for callers needing extra fields


class DoubaoImageClient:
    """Thin wrapper over Ark images API for text-to-image."""

    def __init__(self, config: DoubaoConfig | None = None):
        self._config = config or get_config()
        self._client = build_ark_client(self._config)

    def generate(
        self,
        prompt: str,
        *,
        size: str | None = None,
        response_format: str = "url",
        model: str | None = None,
        watermark: bool | None = None,
    ) -> ImageResult:
        """Generate a single image and return its URL (or base64 if requested)."""
        model = model or self._config.require_image_model()

        # Volcengine Seedream-5 model requires image size to be at least 3686400 pixels.
        # Auto-upgrade legacy sizes to their high-res equivalents.
        if size == "1280x720":
            size = "2560x1440"
        elif size == "1024x1024":
            size = "2048x2048"

        kwargs: dict = {
            "model": model,
            "prompt": prompt,
            "response_format": response_format,
        }
        if size is not None:
            kwargs["size"] = size
        if watermark is not None:
            kwargs["watermark"] = watermark

        logger.info(f"Generating Doubao image (model={model}, size={size})")
        resp = self._client.images.generate(**kwargs)
        first = resp.data[0] if getattr(resp, "data", None) else None
        return ImageResult(
            url=getattr(first, "url", None) if first else None,
            b64_json=getattr(first, "b64_json", None) if first else None,
            raw=resp,
        )
