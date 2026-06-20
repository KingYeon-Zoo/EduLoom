"""Seed a Doubao embedding model as the default embedding model.

The fresh database ships with no ``model`` records and no
``open_notebook:default_models`` configuration, so ``ModelManager`` returns
``None`` for the embedding model and the whole vectorize/search pipeline is
inert. This helper idempotently registers a Doubao embedding ``Model`` record
and points ``default_embedding_model`` at it, so the embedding chain works out
of the box without manual UI configuration.

It is intentionally conservative:
  * It only creates a Doubao embedding model record if none already exists.
  * It only sets ``default_embedding_model`` when it is currently unset, so a
    user's explicit choice in Settings → Models is never overwritten.
"""

from loguru import logger

from edu_loom.ai.doubao.config import get_config
from edu_loom.ai.doubao.esperanto_embedding import PROVIDER_NAME
from edu_loom.ai.doubao.esperanto_llm import PROVIDER_NAME as LLM_PROVIDER_NAME
from open_notebook.ai.models import DefaultModels, Model


async def ensure_doubao_embedding_default() -> None:
    """Ensure a Doubao embedding model exists and is the default (idempotent)."""
    cfg = get_config()
    model_name = cfg.embedding_model

    # Find an existing Doubao embedding model record, if any.
    existing = await Model.get_models_by_type("embedding")
    doubao_model = next(
        (m for m in existing if m.provider == PROVIDER_NAME and m.name == model_name),
        None,
    )

    if doubao_model is None:
        doubao_model = Model(
            name=model_name,
            provider=PROVIDER_NAME,
            type="embedding",
        )
        await doubao_model.save()
        logger.info(
            f"Seeded Doubao embedding model '{model_name}' (id={doubao_model.id})"
        )

    # Only set the default when none is configured, to avoid clobbering a
    # user's explicit selection.
    defaults = await DefaultModels.get_instance()
    if not defaults.default_embedding_model:
        defaults.default_embedding_model = doubao_model.id
        await defaults.update()
        logger.info(
            f"Set default embedding model to Doubao '{model_name}' (id={doubao_model.id})"
        )


async def ensure_doubao_llm_default() -> None:
    """Ensure a Doubao language model exists and is the default (idempotent).

    Mirrors :func:`ensure_doubao_embedding_default` for the chat/text side. The
    same Doubao model backs the chat, tools, transformation and large-context
    defaults; each is only set when currently unset so a user's explicit
    selection in Settings → Models is never overwritten.
    """
    cfg = get_config()
    model_name = cfg.llm_model

    existing = await Model.get_models_by_type("language")
    doubao_model = next(
        (m for m in existing if m.provider == LLM_PROVIDER_NAME and m.name == model_name),
        None,
    )

    if doubao_model is None:
        doubao_model = Model(
            name=model_name,
            provider=LLM_PROVIDER_NAME,
            type="language",
        )
        await doubao_model.save()
        logger.info(f"Seeded Doubao language model '{model_name}' (id={doubao_model.id})")

    defaults = await DefaultModels.get_instance()
    changed = False
    for field in (
        "default_chat_model",
        "default_tools_model",
        "default_transformation_model",
        "large_context_model",
    ):
        if not getattr(defaults, field):
            setattr(defaults, field, doubao_model.id)
            changed = True
    if changed:
        await defaults.update()
        logger.info(
            f"Set default chat/tools/transformation/large-context models to "
            f"Doubao '{model_name}' (id={doubao_model.id})"
        )


async def ensure_doubao_tts_default() -> None:
    """Ensure a TTS model exists and is the default (idempotent).
    
    If Doubao TTS credentials are configured, we seed and default to Doubao.
    Otherwise, we fall back to OpenAI's tts-1 to ensure a functional default.
    """
    cfg = get_config()
    has_doubao_tts = bool(cfg.tts_api_key or (cfg.tts_app_id and cfg.tts_access_token))

    existing = await Model.get_models_by_type("text_to_speech")
    defaults = await DefaultModels.get_instance()

    if has_doubao_tts:
        model_name = cfg.tts_resource_id
        doubao_model = next(
            (m for m in existing if m.provider == "doubao" and m.name == model_name),
            None,
        )

        if doubao_model is None:
            doubao_model = Model(
                name=model_name,
                provider="doubao",
                type="text_to_speech",
            )
            await doubao_model.save()
            logger.info(
                f"Seeded Doubao TTS model '{model_name}' (id={doubao_model.id})"
            )

        # Only set the default when none is configured, to avoid clobbering a
        # user's explicit selection.
        if not defaults.default_text_to_speech_model:
            defaults.default_text_to_speech_model = doubao_model.id
            await defaults.update()
            logger.info(
                f"Set default TTS model to Doubao '{model_name}' (id={doubao_model.id})"
            )
    else:
        # Find or create OpenAI tts-1 model record
        openai_model = next(
            (m for m in existing if m.provider == "openai" and m.name == "tts-1"),
            None,
        )
        if openai_model is None:
            openai_model = Model(
                name="tts-1",
                provider="openai",
                type="text_to_speech",
            )
            await openai_model.save()
            logger.info("Seeded OpenAI TTS model 'tts-1'")

        # If default is unset, OR it points to a Doubao model but Doubao isn't configured,
        # point it to OpenAI tts-1 to avoid errors.
        should_use_openai = False
        if not defaults.default_text_to_speech_model:
            should_use_openai = True
        else:
            try:
                current_default = await Model.get(defaults.default_text_to_speech_model)
                if current_default.provider == "doubao":
                    should_use_openai = True
            except Exception:
                should_use_openai = True

        if should_use_openai:
            defaults.default_text_to_speech_model = openai_model.id
            await defaults.update()
            logger.info(
                f"Set default TTS model to OpenAI 'tts-1' (id={openai_model.id}) "
                f"because Doubao TTS is not configured"
            )
