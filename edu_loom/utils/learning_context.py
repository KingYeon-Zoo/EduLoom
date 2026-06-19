"""Shared learning-context helpers (Projects C / D / E).

Two functions used across studio resource generation (C), learning-path
planning + assessment (D/E): summarizing the singleton learner profile and
assembling a notebook's source text into a single prompt-friendly string.

Extracted from ``api/studio_service.py`` so the studio service, the
path-planning graph and the assessment graph all share one implementation
instead of each re-deriving it.
"""

from typing import List

from loguru import logger

from edu_loom.domain.learner_profile import PROFILE_DIMENSIONS, LearnerProfile
from open_notebook.domain.notebook import Notebook, Source


async def build_notebook_content(notebook_id: str) -> str:
    """Assemble a plain-text context string from a notebook's sources.

    Concatenates each source's title + full_text (falling back to insights).
    Self-contained so generators/planners don't depend on the frontend
    serializing context.

    Note: ``notebook.get_sources()`` returns list-projected sources whose
    ``full_text`` is not hydrated, so each source is re-fetched by id via
    ``Source.get()`` to obtain its full text.
    """
    notebook = await Notebook.get(notebook_id)
    sources = await notebook.get_sources()
    parts: List[str] = []
    for src in sources:
        title = getattr(src, "title", None) or "Untitled"
        body = getattr(src, "full_text", None)
        if not body:
            # Re-fetch the full record (the list query omits full_text).
            try:
                full = await Source.get(str(src.id))
                body = getattr(full, "full_text", None)
            except Exception:
                body = None
        if not body:
            try:
                insights = await src.get_insights()
                body = "\n".join(
                    i.content for i in insights if getattr(i, "content", None)
                )
            except Exception:
                body = ""
        if body:
            parts.append(f"## {title}\n\n{body}")
    return "\n\n---\n\n".join(parts)


async def summarize_learner_profile() -> str:
    """Render the singleton learner profile into a compact prompt-friendly text.

    Returns "" when the profile has no entries yet (cold start), so callers can
    fall back to a default behavior.
    """
    try:
        profile = await LearnerProfile.get_instance()
    except Exception as e:
        logger.warning(f"Failed to load learner profile: {e}")
        return ""

    lines: List[str] = []
    for dim, label in PROFILE_DIMENSIONS.items():
        entries = getattr(profile, dim, None) or []
        contents = [
            getattr(e, "content", None)
            or (e.get("content") if isinstance(e, dict) else None)
            for e in entries
        ]
        contents = [c for c in contents if c]
        if contents:
            lines.append(f"- {label}：" + "；".join(contents))
    return "\n".join(lines)
