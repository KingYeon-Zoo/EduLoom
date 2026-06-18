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
