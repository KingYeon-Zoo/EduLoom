"""Ark client factory.

Centralizes construction of the Volcengine Ark SDK client so auth, base URL,
and retry behaviour are configured in one place. Video and image clients
share this; TTS uses a plain HTTP call (different service/auth) and does not
go through here.
"""

from functools import lru_cache

from volcenginesdkarkruntime import Ark, AsyncArk

from open_notebook.ai.doubao.config import DoubaoConfig, get_config

# Bounded retries for transient network/rate-limit errors, handled by the SDK.
_MAX_RETRIES = 2


def build_ark_client(config: DoubaoConfig | None = None) -> Ark:
    """Build a synchronous Ark client. Raises DoubaoConfigError if key unset."""
    config = config or get_config()
    return Ark(
        api_key=config.require_ark(),
        base_url=config.ark_base_url,
        max_retries=_MAX_RETRIES,
    )


def build_async_ark_client(config: DoubaoConfig | None = None) -> AsyncArk:
    """Build an asynchronous Ark client. Raises DoubaoConfigError if key unset."""
    config = config or get_config()
    return AsyncArk(
        api_key=config.require_ark(),
        base_url=config.ark_base_url,
        max_retries=_MAX_RETRIES,
    )


@lru_cache(maxsize=1)
def get_ark_client() -> Ark:
    """Cached synchronous Ark client built from the current environment."""
    return build_ark_client()
