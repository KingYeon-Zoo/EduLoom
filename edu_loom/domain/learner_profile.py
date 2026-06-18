"""Learner profile domain model (Project B - 对话式学习画像).

A single global learner profile (singleton, Open Learner Model style) built
automatically from chat conversations via background extract+reconcile.

Design references mainstream LLM-memory pipelines (Mem0 / LangMem / Letta /
ChatGPT Memory): each fact carries confidence + provenance + timestamps, and is
maintained with ADD/UPDATE/DELETE/NOOP operations.

The "cognitive_style" dimension intentionally stores *evidence-based observed
interaction preferences* (e.g. "prefers worked examples before explanation"),
NOT VARK-style learner-type labels — the VARK matching hypothesis is a debunked
neuromyth (Frontiers 2023, Educational Psychology Review 2025, Yale Poorvu).
"""

from datetime import datetime, timezone
from typing import ClassVar, Dict, List

from loguru import logger
from pydantic import BaseModel, Field, field_validator

from open_notebook.domain.base import RecordModel

# Single source of truth: dimension field name -> Chinese display name.
# Shared by the extraction prompt, the API, and (mirrored in) the frontend.
PROFILE_DIMENSIONS: Dict[str, str] = {
    "knowledge_base": "知识基础",
    "cognitive_style": "认知风格",
    "error_prone": "易错点偏好",
    "learning_goals": "学习目标",
    "learning_progress": "学习进度",
    "learning_interests": "学习兴趣方向",
}


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class ProfileEntry(BaseModel):
    """A single learner-profile fact within one dimension."""

    content: str = Field(..., description="One observed fact about the learner")
    confidence: float = Field(
        ..., ge=0.0, le=1.0, description="Confidence 0-1, assigned by reconcile LLM"
    )
    provenance: str = Field(
        default="unknown", description="Source chat session id (traceable)"
    )
    created: str = Field(default_factory=_now_iso, description="ISO creation time")
    updated: str = Field(default_factory=_now_iso, description="ISO last-update time")

    @field_validator("content")
    @classmethod
    def _content_not_empty(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("ProfileEntry.content cannot be empty")
        return v.strip()

    @field_validator("created", "updated", mode="before")
    @classmethod
    def _default_timestamp(cls, v):
        # Manual edits via the API may omit timestamps (sent as None); fill them.
        if v is None or (isinstance(v, str) and not v.strip()):
            return _now_iso()
        return v

    @field_validator("provenance", mode="before")
    @classmethod
    def _default_provenance(cls, v):
        if v is None or (isinstance(v, str) and not v.strip()):
            return "unknown"
        return v


class LearnerProfile(RecordModel):
    """Global singleton learner profile with 6 fixed dimensions.

    Satisfies the rubric requirement of "no fewer than 6 dimensions" with
    continuous refresh (随学随新) via background extraction after each chat turn.
    """

    record_id: ClassVar[str] = "learner_profile:singleton"
    table_name: ClassVar[str] = "learner_profile"

    knowledge_base: List[ProfileEntry] = []
    cognitive_style: List[ProfileEntry] = []  # evidence-driven, NOT VARK
    error_prone: List[ProfileEntry] = []
    learning_goals: List[ProfileEntry] = []
    learning_progress: List[ProfileEntry] = []
    learning_interests: List[ProfileEntry] = []

    def _coerce_entries(self) -> None:
        """Normalize each dimension to a list[ProfileEntry].

        RecordModel._load_from_db writes raw dicts back via object.__setattr__,
        bypassing validation, so loaded dimensions hold list[dict]. Reconstruct
        them into ProfileEntry instances. Invalid entries are dropped (defensive).
        """
        for dim in PROFILE_DIMENSIONS:
            raw = getattr(self, dim, None) or []
            coerced: List[ProfileEntry] = []
            for item in raw:
                if isinstance(item, ProfileEntry):
                    coerced.append(item)
                elif isinstance(item, dict):
                    try:
                        coerced.append(ProfileEntry(**item))
                    except Exception as e:  # noqa: BLE001 - drop malformed rows
                        logger.warning(f"Dropping malformed profile entry in {dim}: {e}")
            object.__setattr__(self, dim, coerced)

    @classmethod
    async def get_instance(cls) -> "LearnerProfile":
        """Load the singleton fresh from DB and coerce stored dicts to ProfileEntry.

        The profile refreshes continuously in the background (随学随新), so each
        read MUST re-hit the DB rather than trust the cached singleton state.
        RecordModel caches the instance and only loads once (_db_loaded); reset
        that flag so every get_instance reflects the latest persisted profile.
        """
        instance = cls()
        # Clear cached dimensions first so a reload reflects DB state exactly
        # (a dimension absent/emptied in the DB must not keep stale entries).
        for dim in PROFILE_DIMENSIONS:
            object.__setattr__(instance, dim, [])
        object.__setattr__(instance, "_db_loaded", False)
        await instance._load_from_db()
        instance._coerce_entries()
        return instance  # type: ignore[return-value]

    async def update(self):
        """Persist, serializing ProfileEntry dimensions to plain dicts first.

        The SurrealDB driver cannot serialize Pydantic models directly, so dump
        each dimension to dicts for the upsert, then re-coerce after reload.
        """
        for dim in PROFILE_DIMENSIONS:
            entries = getattr(self, dim, None) or []
            dumped = [
                e.model_dump() if isinstance(e, ProfileEntry) else e for e in entries
            ]
            object.__setattr__(self, dim, dumped)
        await super().update()
        self._coerce_entries()
        return self
