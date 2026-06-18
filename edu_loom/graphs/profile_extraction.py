"""Learner-profile extraction + reconciliation graph (Project B).

Two async LangGraph nodes mirroring mainstream memory pipelines (Mem0):
  1. extract_facts  — LLM reads recent conversation → 6-dimension candidate facts.
  2. reconcile      — LLM diffs candidates against the current profile → applies
                      ADD / UPDATE / DELETE / NOOP operations, then persists.

The reconcile step is written as a pure helper (`apply_operations`) so a future
`consolidate_profile_command` (periodic reflection / decay) can reuse it without
touching this module.
"""

import json
from typing import List, Optional

from ai_prompter import Prompter
from langchain_core.output_parsers.pydantic import PydanticOutputParser
from langgraph.graph import END, START, StateGraph
from loguru import logger
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from edu_loom.domain.learner_profile import (
    PROFILE_DIMENSIONS,
    LearnerProfile,
    ProfileEntry,
    _now_iso,
)
from open_notebook.ai.provision import provision_langchain_model
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content

_VALID_DIMENSIONS = set(PROFILE_DIMENSIONS.keys())


class Candidate(BaseModel):
    dimension: str = Field(..., description="One of the 6 profile dimension keys")
    content: str = Field(..., description="A single observed fact")
    confidence: float = Field(0.6, ge=0.0, le=1.0)


class Candidates(BaseModel):
    candidates: List[Candidate] = Field(default_factory=list)


class Operation(BaseModel):
    op: str = Field(..., description="ADD | UPDATE | DELETE | NOOP")
    dimension: str = Field(..., description="One of the 6 profile dimension keys")
    target_index: Optional[int] = Field(
        None, description="0-based index into existing entries (UPDATE/DELETE)"
    )
    content: str = Field("", description="Merged content for ADD/UPDATE")
    confidence: float = Field(0.6, ge=0.0, le=1.0)


class Operations(BaseModel):
    operations: List[Operation] = Field(default_factory=list)


class ProfileState(TypedDict, total=False):
    conversation: str
    session_id: str
    profile: LearnerProfile
    candidates: List[Candidate]
    changes: dict


def _render_existing(profile: LearnerProfile) -> str:
    """Render the current profile per-dimension with indices for the LLM."""
    blocks = []
    for dim, label in PROFILE_DIMENSIONS.items():
        entries = getattr(profile, dim, []) or []
        lines = [f"## {dim} ({label})"]
        if not entries:
            lines.append("(empty)")
        else:
            for i, e in enumerate(entries):
                content = e.content if isinstance(e, ProfileEntry) else e.get("content")
                lines.append(f"[{i}] {content}")
        blocks.append("\n".join(lines))
    return "\n\n".join(blocks)


async def extract_facts(state: ProfileState) -> dict:
    try:
        parser = PydanticOutputParser(pydantic_object=Candidates)
        system_prompt = Prompter(prompt_template="profile/extract", parser=parser).render(  # type: ignore[arg-type]
            data={"conversation": state.get("conversation", "")}
        )
        model = await provision_langchain_model(
            system_prompt,
            None,
            "chat",
            max_tokens=2000,
            structured=dict(type="json"),
        )
        ai_message = await model.ainvoke(system_prompt)
        content = clean_thinking_content(extract_text_content(ai_message.content))
        try:
            parsed = parser.parse(content)
        except Exception as e:
            # Malformed LLM JSON is a permanent failure: skip this round cleanly.
            raise ValueError(f"Failed to parse extraction output: {e}") from e

        valid = [c for c in parsed.candidates if c.dimension in _VALID_DIMENSIONS]
        logger.info(f"Profile extraction produced {len(valid)} candidate facts")
        return {"candidates": valid}
    except (OpenNotebookError, ValueError):
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


def apply_operations(
    profile: LearnerProfile, operations: List[Operation], session_id: str
) -> dict:
    """Apply reconcile operations to the profile in place. Pure + reusable.

    Returns a per-dimension change counter. DELETE/UPDATE indices are validated
    against the current entry list; out-of-range targets are ignored.
    """
    changes = {dim: {"added": 0, "updated": 0, "deleted": 0} for dim in PROFILE_DIMENSIONS}
    now = _now_iso()

    # Process DELETE ops last per dimension would shift indices; instead collect
    # deletes and apply them after add/update, highest-index-first.
    deletes: dict = {dim: set() for dim in PROFILE_DIMENSIONS}

    for op in operations:
        dim = op.dimension
        if dim not in _VALID_DIMENSIONS:
            continue
        entries: List[ProfileEntry] = getattr(profile, dim)
        action = (op.op or "").strip().upper()

        if action == "ADD":
            if not op.content or not op.content.strip():
                continue
            entries.append(
                ProfileEntry(
                    content=op.content,
                    confidence=op.confidence,
                    provenance=session_id,
                    created=now,
                    updated=now,
                )
            )
            changes[dim]["added"] += 1
        elif action == "UPDATE":
            idx = op.target_index
            if idx is None or not (0 <= idx < len(entries)):
                continue
            if not op.content or not op.content.strip():
                continue
            existing = entries[idx]
            entries[idx] = ProfileEntry(
                content=op.content,
                confidence=op.confidence,
                provenance=session_id,
                created=existing.created if isinstance(existing, ProfileEntry) else now,
                updated=now,
            )
            changes[dim]["updated"] += 1
        elif action == "DELETE":
            idx = op.target_index
            if idx is not None and 0 <= idx < len(entries):
                deletes[dim].add(idx)
        # NOOP and unknown ops: ignore

    for dim, idxs in deletes.items():
        if not idxs:
            continue
        entries = getattr(profile, dim)
        for idx in sorted(idxs, reverse=True):
            del entries[idx]
            changes[dim]["deleted"] += 1

    return changes


async def reconcile(state: ProfileState) -> dict:
    try:
        profile = state["profile"]
        candidates = state.get("candidates", [])
        if not candidates:
            return {"changes": {}}

        parser = PydanticOutputParser(pydantic_object=Operations)
        candidates_json = json.dumps(
            [c.model_dump() for c in candidates], ensure_ascii=False, indent=2
        )
        system_prompt = Prompter(prompt_template="profile/reconcile", parser=parser).render(  # type: ignore[arg-type]
            data={
                "existing": _render_existing(profile),
                "candidates": candidates_json,
            }
        )
        model = await provision_langchain_model(
            system_prompt,
            None,
            "chat",
            max_tokens=2000,
            structured=dict(type="json"),
        )
        ai_message = await model.ainvoke(system_prompt)
        content = clean_thinking_content(extract_text_content(ai_message.content))
        try:
            parsed = parser.parse(content)
        except Exception as e:
            raise ValueError(f"Failed to parse reconcile output: {e}") from e

        changes = apply_operations(
            profile, parsed.operations, state.get("session_id", "unknown")
        )
        await profile.update()
        logger.info(f"Profile reconcile applied changes: {changes}")
        return {"changes": changes}
    except (OpenNotebookError, ValueError):
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


_builder = StateGraph(ProfileState)
_builder.add_node("extract", extract_facts)
_builder.add_node("reconcile", reconcile)
_builder.add_edge(START, "extract")
_builder.add_edge("extract", "reconcile")
_builder.add_edge("reconcile", END)
graph = _builder.compile()
