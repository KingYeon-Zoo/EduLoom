"""Register the Doubao TTS provider into Esperanto's factory at runtime.

Esperanto resolves providers via a mutable class-level map
``AIFactory._provider_modules[service_type][provider] = "module:Class"``.
We inject a ``doubao`` entry pointing at our adapter so that
``AIFactory.create_text_to_speech("doubao", ...)`` — and therefore
podcast-creator — can produce audio through Doubao. This does NOT modify the
installed esperanto package.

Call :func:`register_doubao_tts` once at startup (idempotent).
"""

from loguru import logger

from edu_loom.ai.doubao.esperanto_tts import PROVIDER_NAME

_MODULE_PATH = "edu_loom.ai.doubao.esperanto_tts:DoubaoTextToSpeechModel"


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
