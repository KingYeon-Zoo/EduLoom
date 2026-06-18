"""Learner-profile API endpoints (Project B - 对话式学习画像)."""

from fastapi import APIRouter, HTTPException
from loguru import logger

from api import learner_profile_service as service
from api.models import (
    LearnerProfileResponse,
    LearnerProfileUpdate,
    ProfileExtractRequest,
    ProfileExtractResponse,
)
from edu_loom.domain.learner_profile import PROFILE_DIMENSIONS

router = APIRouter()


@router.get("/learner-profile", response_model=LearnerProfileResponse)
async def get_learner_profile():
    """Read the global learner profile (6 dimensions + entries)."""
    try:
        dimensions = await service.get_profile()
        return LearnerProfileResponse(dimensions=dimensions, labels=PROFILE_DIMENSIONS)
    except Exception as e:
        logger.error(f"Error fetching learner profile: {e}")
        raise HTTPException(status_code=500, detail="Error fetching learner profile")


@router.put("/learner-profile", response_model=LearnerProfileResponse)
async def update_learner_profile(payload: LearnerProfileUpdate):
    """Manually edit the profile (Open Learner Model: learner can correct it)."""
    try:
        dimensions_in = {
            dim: [e.model_dump() for e in entries]
            for dim, entries in payload.dimensions.items()
        }
        dimensions = await service.update_profile(dimensions_in)
        return LearnerProfileResponse(dimensions=dimensions, labels=PROFILE_DIMENSIONS)
    except Exception as e:
        logger.error(f"Error updating learner profile: {e}")
        raise HTTPException(status_code=500, detail="Error updating learner profile")


@router.post("/learner-profile/extract", response_model=ProfileExtractResponse)
async def extract_learner_profile(payload: ProfileExtractRequest):
    """Manually trigger a re-extraction (demo / cold start). Returns a command id."""
    try:
        command_id = service.submit_extraction(payload.conversation, payload.session_id)
        return ProfileExtractResponse(command_id=str(command_id))
    except Exception as e:
        logger.error(f"Error submitting profile extraction: {e}")
        raise HTTPException(status_code=500, detail="Error submitting extraction")


@router.delete("/learner-profile", response_model=LearnerProfileResponse)
async def reset_learner_profile():
    """Clear/reset the profile."""
    try:
        dimensions = await service.reset_profile()
        return LearnerProfileResponse(dimensions=dimensions, labels=PROFILE_DIMENSIONS)
    except Exception as e:
        logger.error(f"Error resetting learner profile: {e}")
        raise HTTPException(status_code=500, detail="Error resetting learner profile")
