"""Esperanto-compatible Doubao embedding provider.

Open Notebook generates all embeddings through
``esperanto.AIFactory.create_embedding(provider, ...)`` (see
``open_notebook.ai.models.ModelManager.get_model`` and
``open_notebook.utils.embedding``). Esperanto ships no Doubao provider, so we
implement the Esperanto ``EmbeddingModel`` interface here and register it into
the factory's provider map at startup (see ``register.py``). The installed
esperanto package is not modified; selecting provider ``"doubao"`` routes
embeddings through Volcengine Ark's multimodal embeddings endpoint.

Ark quirk: the ``/embeddings/multimodal`` endpoint accepts a list of input
parts (text and/or image) and returns a SINGLE pooled embedding for the whole
request — it does NOT return one embedding per text the way the OpenAI batch
embeddings API does. To embed N texts we therefore issue N separate requests,
one per text. ``aembed`` runs those requests concurrently.
"""

import asyncio
import os
from typing import Any, Dict, List

import httpx
from esperanto.common_types import Model
from esperanto.providers.embedding.base import EmbeddingModel

from edu_loom.ai.doubao.config import DEFAULT_EMBEDDING_MODEL, get_config

PROVIDER_NAME = "doubao"


class DoubaoEmbeddingModel(EmbeddingModel):
    """Esperanto embedding provider backed by Ark's multimodal embeddings API.

    Returns 2048-dimensional vectors (for ``doubao-embedding-vision-*``). The
    dimension is determined by the model, not configured here; Open Notebook's
    SurrealDB vector search is dimension-agnostic (cosine over flexible-length
    arrays), so no schema change is required.
    """

    def __post_init__(self) -> None:
        super().__post_init__()
        cfg = get_config()
        # api_key/base_url may come from the Esperanto config (credential-backed)
        # or fall back to the Ark env config. The Ark key lives in ARK_API_KEY.
        self.api_key = self.api_key or cfg.ark_api_key or os.getenv("ARK_API_KEY")
        self.base_url = self.base_url or cfg.ark_base_url
        # model_name falls back to the configured Doubao embedding model.
        if not self.model_name:
            self.model_name = cfg.embedding_model
        self._create_http_clients()

    def _embeddings_url(self) -> str:
        return f"{self.base_url.rstrip('/')}/embeddings/multimodal"

    def _headers(self) -> Dict[str, str]:
        if not self.api_key:
            raise RuntimeError(
                "Doubao embedding API key is not set. Configure ARK_API_KEY "
                "(or a Doubao credential) to use Doubao embeddings."
            )
        return {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

    def _payload(self, text: str) -> Dict[str, Any]:
        return {
            "model": self.model_name,
            "input": [{"type": "text", "text": text}],
        }

    @staticmethod
    def _parse_embedding(data: Dict[str, Any]) -> List[float]:
        """Extract the embedding vector from an Ark multimodal response.

        Response shape:
            {"data": {"embedding": [...floats...], "object": "embedding"}, ...}
        """
        payload = data.get("data")
        if isinstance(payload, dict):
            embedding = payload.get("embedding")
        elif isinstance(payload, list) and payload:
            # Defensive: some Ark endpoints use the OpenAI-style list form.
            embedding = payload[0].get("embedding") if isinstance(payload[0], dict) else None
        else:
            embedding = None

        if not isinstance(embedding, list):
            raise RuntimeError(
                f"Unexpected Doubao embedding response (no embedding array): {str(data)[:200]}"
            )
        return [float(x) for x in embedding]

    def embed(self, texts: List[str], **kwargs) -> List[List[float]]:
        """Synchronously embed each text (one Ark request per text)."""
        headers = self._headers()
        url = self._embeddings_url()
        results: List[List[float]] = []
        for text in texts:
            cleaned = text if text and text.strip() else " "
            resp = self.client.post(url, headers=headers, json=self._payload(cleaned))
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise RuntimeError(f"Doubao embedding API error: {e.response.text}") from e
            results.append(self._parse_embedding(resp.json()))
        return results

    async def aembed(self, texts: List[str], **kwargs) -> List[List[float]]:
        """Asynchronously embed each text concurrently (one Ark request per text)."""
        headers = self._headers()
        url = self._embeddings_url()

        async def _one(text: str) -> List[float]:
            cleaned = text if text and text.strip() else " "
            resp = await self.async_client.post(
                url, headers=headers, json=self._payload(cleaned)
            )
            try:
                resp.raise_for_status()
            except httpx.HTTPStatusError as e:
                raise RuntimeError(
                    f"Doubao embedding API error: {e.response.text}"
                ) from e
            return self._parse_embedding(resp.json())

        return await asyncio.gather(*(_one(t) for t in texts))

    def _get_models(self) -> List[Model]:
        return [Model(id=DEFAULT_EMBEDDING_MODEL, owned_by="doubao")]

    def _get_default_model(self) -> str:
        return DEFAULT_EMBEDDING_MODEL

    @property
    def provider(self) -> str:
        return PROVIDER_NAME
