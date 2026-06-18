"""Service layer for learner-profile endpoints (Project B).

Thin wrapper over the LearnerProfile domain model + the extract_profile command,
mirroring the existing *_service.py pattern.
"""

from typing import Dict, List

from loguru import logger
from surreal_commands import submit_command

from edu_loom.domain.learner_profile import (
    PROFILE_DIMENSIONS,
    LearnerProfile,
    ProfileEntry,
)


def _serialize(profile: LearnerProfile) -> Dict[str, List[dict]]:
    """Dump each dimension's entries to plain dicts for the API response."""
    out: Dict[str, List[dict]] = {}
    for dim in PROFILE_DIMENSIONS:
        entries = getattr(profile, dim, []) or []
        out[dim] = [
            e.model_dump() if isinstance(e, ProfileEntry) else e for e in entries
        ]
    return out


async def get_profile() -> Dict[str, List[dict]]:
    """Read the singleton profile (creates an empty one implicitly on first read)."""
    profile = await LearnerProfile.get_instance()
    return _serialize(profile)


async def update_profile(dimensions: Dict[str, List[dict]]) -> Dict[str, List[dict]]:
    """Replace entries for the given dimensions (manual Open Learner Model edit).

    Unknown dimension keys are ignored; omitted dimensions stay unchanged.
    """
    profile = await LearnerProfile.get_instance()
    for dim, entries in dimensions.items():
        if dim not in PROFILE_DIMENSIONS:
            logger.warning(f"Ignoring unknown profile dimension: {dim}")
            continue
        coerced = [
            ProfileEntry(**e) if isinstance(e, dict) else e for e in (entries or [])
        ]
        setattr(profile, dim, coerced)
    await profile.update()
    return _serialize(profile)


async def reset_profile() -> Dict[str, List[dict]]:
    """Clear all dimensions back to empty."""
    profile = await LearnerProfile.get_instance()
    for dim in PROFILE_DIMENSIONS:
        setattr(profile, dim, [])
    await profile.update()
    return _serialize(profile)


def submit_extraction(conversation: str, session_id: str = "manual") -> str:
    """Fire a manual extraction run; returns the command id for polling."""
    return submit_command(
        "open_notebook",
        "extract_profile",
        {"conversation": conversation, "session_id": session_id},
    )
