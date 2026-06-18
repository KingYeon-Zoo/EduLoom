"""Register Doubao providers into Esperanto's factory at runtime.

Esperanto resolves providers via a mutable class-level map
``AIFactory._provider_modules[service_type][provider] = "module:Class"``.
We inject ``doubao`` entries pointing at our adapters so that
``AIFactory.create_text_to_speech("doubao", ...)`` and
``AIFactory.create_embedding("doubao", ...)`` — and therefore podcast-creator
and the embedding pipeline — route through Doubao. This does NOT modify the
installed esperanto package.

Call :func:`register_doubao_tts` / :func:`register_doubao_embedding` once at
startup (both idempotent), or :func:`register_doubao_providers` for both.
"""

from loguru import logger

from edu_loom.ai.doubao.esperanto_embedding import (
    PROVIDER_NAME as EMBEDDING_PROVIDER_NAME,
)
from edu_loom.ai.doubao.esperanto_llm import PROVIDER_NAME as LLM_PROVIDER_NAME
from edu_loom.ai.doubao.esperanto_tts import PROVIDER_NAME

_MODULE_PATH = "edu_loom.ai.doubao.esperanto_tts:DoubaoTextToSpeechModel"
_EMBEDDING_MODULE_PATH = (
    "edu_loom.ai.doubao.esperanto_embedding:DoubaoEmbeddingModel"
)
_LLM_MODULE_PATH = "edu_loom.ai.doubao.esperanto_llm:DoubaoLanguageModel"


def register_doubao_tts() -> None:
    """Inject the Doubao TTS provider into Esperanto's factory (idempotent)."""
    from esperanto.factory import AIFactory

    tts_map = AIFactory._provider_modules.get("text_to_speech")
    if tts_map is None:
        logger.warning("Esperanto factory has no text_to_speech map; cannot register Doubao TTS")
        return
    if tts_map.get(PROVIDER_NAME) == _MODULE_PATH:
        return
    tts_map[PROVIDER_NAME] = _MODULE_PATH
    logger.info("Registered Doubao TTS provider with Esperanto factory")


def register_doubao_embedding() -> None:
    """Inject the Doubao embedding provider into Esperanto's factory (idempotent)."""
    from esperanto.factory import AIFactory

    embedding_map = AIFactory._provider_modules.get("embedding")
    if embedding_map is None:
        logger.warning(
            "Esperanto factory has no embedding map; cannot register Doubao embedding"
        )
        return
    if embedding_map.get(EMBEDDING_PROVIDER_NAME) == _EMBEDDING_MODULE_PATH:
        return
    embedding_map[EMBEDDING_PROVIDER_NAME] = _EMBEDDING_MODULE_PATH
    logger.info("Registered Doubao embedding provider with Esperanto factory")


def register_doubao_llm() -> None:
    """Inject the Doubao language provider into Esperanto's factory (idempotent)."""
    from esperanto.factory import AIFactory

    language_map = AIFactory._provider_modules.get("language")
    if language_map is None:
        logger.warning(
            "Esperanto factory has no language map; cannot register Doubao LLM"
        )
        return
    if language_map.get(LLM_PROVIDER_NAME) == _LLM_MODULE_PATH:
        return
    language_map[LLM_PROVIDER_NAME] = _LLM_MODULE_PATH
    logger.info("Registered Doubao language provider with Esperanto factory")


def register_doubao_providers() -> None:
    """Register all Doubao Esperanto providers (TTS + embedding + LLM)."""
    register_doubao_tts()
    register_doubao_embedding()
    register_doubao_llm()

