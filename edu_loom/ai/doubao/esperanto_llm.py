"""Esperanto-compatible Doubao language model provider.

Open Notebook provisions chat / transformation / tools models through
``esperanto.AIFactory.create_language(provider, ...)`` and then calls
``model.to_langchain()`` (see ``open_notebook.ai.provision`` and the LangGraph
chat graphs). Doubao's text models are served from Volcengine Ark's
OpenAI-compatible ``/chat/completions`` endpoint, so we subclass Esperanto's
``OpenAICompatibleLanguageModel`` rather than reimplement the protocol — we
only need to (a) default the Ark base URL / API key and (b) forward the Doubao
``reasoning_effort`` thinking-strength parameter, which the stock provider does
not surface.

``reasoning_effort`` (``minimal`` / ``low`` / ``medium`` / ``high``) is a
top-level request-body parameter on Ark's chat endpoint. ``ChatOpenAI`` merges
its ``model_kwargs`` into the request body as top-level keys, so injecting it
there is sufficient for the LangChain path used by the chat graphs.
"""

import os
from dataclasses import dataclass
from typing import TYPE_CHECKING, List, Optional

from esperanto.common_types import Model
from esperanto.providers.llm.openai_compatible import OpenAICompatibleLanguageModel

from edu_loom.ai.doubao.config import DEFAULT_LLM_MODEL, get_config

if TYPE_CHECKING:
    from langchain_openai import ChatOpenAI

PROVIDER_NAME = "doubao"

# Accepted Doubao thinking-strength values. Anything else is dropped so we never
# send a value the Ark endpoint will reject with HTTP 400.
VALID_REASONING_EFFORTS = frozenset({"minimal", "low", "medium", "high"})
DEFAULT_REASONING_EFFORT = "medium"


def normalize_reasoning_effort(value: Optional[str]) -> str:
    """Coerce an arbitrary reasoning-effort value to a valid one.

    Invalid / missing values fall back to the default ("medium") so callers
    never forward a value the Ark endpoint rejects with HTTP 400.
    """
    if isinstance(value, str) and value in VALID_REASONING_EFFORTS:
        return value
    return DEFAULT_REASONING_EFFORT


@dataclass
class DoubaoLanguageModel(OpenAICompatibleLanguageModel):
    """Esperanto language provider backed by Volcengine Ark (Doubao)."""

    def __post_init__(self) -> None:
        cfg = get_config()
        # Default Ark connection details before the parent validates them.
        # Explicit config/api_key still wins (credential-backed models).
        self.base_url = self.base_url or cfg.ark_base_url
        self.api_key = self.api_key or cfg.ark_api_key or os.getenv("ARK_API_KEY")
        super().__post_init__()
        if not self.model_name:
            self.model_name = cfg.llm_model

        # Extract the Doubao thinking-strength parameter from config so it is
        # not treated as an unknown completion kwarg. Invalid values are
        # ignored (falls back to the model's own default).
        effort = self._config.get("reasoning_effort")
        self.reasoning_effort: Optional[str] = (
            effort if effort in VALID_REASONING_EFFORTS else None
        )

    def to_langchain(self) -> "ChatOpenAI":
        """Build the LangChain model, forwarding ``reasoning_effort`` to Ark."""
        model = super().to_langchain()
        if self.reasoning_effort:
            # ChatOpenAI forwards model_kwargs into the request body as
            # top-level params; merge rather than replace to keep response_format.
            merged = {**(model.model_kwargs or {}), "reasoning_effort": self.reasoning_effort}
            model.model_kwargs = merged
        return model

    def _get_models(self) -> List[Model]:
        return [Model(id=DEFAULT_LLM_MODEL, owned_by="doubao")]

    def _get_default_model(self) -> str:
        return DEFAULT_LLM_MODEL

    @property
    def provider(self) -> str:
        return PROVIDER_NAME
