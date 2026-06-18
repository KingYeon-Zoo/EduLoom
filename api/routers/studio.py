"""Studio resource generation API (Project C).

Endpoints for the four resource generators (report / video / mindmap /
infographic): generate, list/get/delete/retry artifacts, stream binary files,
and CRUD presets. Mirrors api/routers/podcasts.py.
"""

import mimetypes
from pathlib import Path
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import FileResponse
from loguru import logger
from pydantic import BaseModel

from api.studio_service import StudioService

router = APIRouter()


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class StudioGenerationRequest(BaseModel):
    resource_type: str
    profile_name: str
    name: str
    notebook_id: Optional[str] = None
    content: Optional[str] = None
    instructions: Optional[str] = None


class StudioGenerationResponse(BaseModel):
    job_id: str
    artifact_id: str
    status: str
    message: str


class StudioArtifactResponse(BaseModel):
    id: str
    name: str
    resource_type: str
    notebook_id: Optional[str] = None
    profile_snapshot: Dict[str, Any] = {}
    instructions: Optional[str] = None
    content: Optional[str] = None
    file_urls: List[str] = []
    created: Optional[str] = None
    job_status: Optional[str] = None
    error_message: Optional[str] = None


class StudioProfileRequest(BaseModel):
    name: str
    resource_type: str
    description: Optional[str] = None
    default_prompt: str
    config: Dict[str, Any] = {}


class StudioProfileResponse(BaseModel):
    id: str
    name: str
    resource_type: str
    description: Optional[str] = None
    default_prompt: str
    config: Dict[str, Any] = {}
    builtin: bool = False


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
async def _to_artifact_response(artifact) -> StudioArtifactResponse:
    job_status = None
    error_message = None
    if artifact.command:
        try:
            detail = await artifact.get_job_detail()
            job_status = detail["status"]
            error_message = detail["error_message"]
        except Exception:
            job_status = "unknown"
    else:
        job_status = "completed" if (artifact.content or artifact.file_paths) else "unknown"

    file_urls = [
        f"/api/studio/artifacts/{artifact.id}/files/{idx}"
        for idx in range(len(artifact.file_paths or []))
    ]

    return StudioArtifactResponse(
        id=str(artifact.id),
        name=artifact.name,
        resource_type=artifact.resource_type,
        notebook_id=str(artifact.notebook_id) if artifact.notebook_id else None,
        profile_snapshot=artifact.profile_snapshot or {},
        instructions=artifact.instructions,
        content=artifact.content,
        file_urls=file_urls,
        created=str(artifact.created) if artifact.created else None,
        job_status=job_status,
        error_message=error_message,
    )


# --------------------------------------------------------------------------
# Generation + artifacts
# --------------------------------------------------------------------------
@router.post("/studio/generate", response_model=StudioGenerationResponse)
async def generate_studio_artifact(request: StudioGenerationRequest):
    """Generate a study resource. Returns immediately with a job id."""
    result = await StudioService.submit_generation_job(
        resource_type=request.resource_type,
        profile_name=request.profile_name,
        name=request.name,
        notebook_id=request.notebook_id,
        content=request.content,
        instructions=request.instructions,
    )
    return StudioGenerationResponse(
        job_id=result["job_id"],
        artifact_id=result["artifact_id"],
        status="submitted",
        message=f"Generation started for '{request.name}'",
    )


@router.get("/studio/artifacts", response_model=List[StudioArtifactResponse])
async def list_studio_artifacts(
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
):
    """List studio artifacts, optionally filtered by resource type."""
    artifacts = await StudioService.list_artifacts(resource_type)
    return [await _to_artifact_response(a) for a in artifacts]


@router.get("/studio/artifacts/{artifact_id}", response_model=StudioArtifactResponse)
async def get_studio_artifact(artifact_id: str):
    """Get a single studio artifact."""
    artifact = await StudioService.get_artifact(artifact_id)
    return await _to_artifact_response(artifact)


@router.get("/studio/artifacts/{artifact_id}/files/{idx}")
async def get_studio_artifact_file(artifact_id: str, idx: int):
    """Stream a binary product (image / video) of an artifact by index."""
    artifact = await StudioService.get_artifact(artifact_id)
    paths = artifact.file_paths or []
    if idx < 0 or idx >= len(paths):
        raise HTTPException(status_code=404, detail="File index out of range")

    file_path = Path(paths[idx])
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found on disk")

    media_type = mimetypes.guess_type(str(file_path))[0] or "application/octet-stream"
    return FileResponse(file_path, media_type=media_type, filename=file_path.name)


@router.post("/studio/artifacts/{artifact_id}/retry")
async def retry_studio_artifact(artifact_id: str):
    """Retry a failed artifact: delete it and resubmit from its snapshot."""
    artifact = await StudioService.get_artifact(artifact_id)

    detail = await artifact.get_job_detail()
    if detail["status"] not in ("failed", "error"):
        raise HTTPException(
            status_code=400,
            detail=f"Artifact is not in a failed state (current: {detail['status']})",
        )

    snapshot = artifact.profile_snapshot or {}
    profile_name = snapshot.get("name")
    if not profile_name:
        raise HTTPException(
            status_code=400, detail="Cannot retry: profile name missing from snapshot"
        )

    name = artifact.name
    resource_type = artifact.resource_type
    notebook_id = str(artifact.notebook_id) if artifact.notebook_id else None
    instructions = artifact.instructions

    # Clean up disk products from the failed run.
    for p in artifact.file_paths or []:
        try:
            fp = Path(p)
            if fp.exists():
                fp.unlink()
        except Exception as e:
            logger.warning(f"Failed to delete file {p}: {e}")

    await artifact.delete()

    result = await StudioService.submit_generation_job(
        resource_type=resource_type,
        profile_name=profile_name,
        name=name,
        notebook_id=notebook_id,
        instructions=instructions,
    )
    return {"job_id": result["job_id"], "message": "Retry submitted successfully"}


@router.delete("/studio/artifacts/{artifact_id}")
async def delete_studio_artifact(artifact_id: str):
    """Delete an artifact and its on-disk products."""
    artifact = await StudioService.get_artifact(artifact_id)

    for p in artifact.file_paths or []:
        try:
            fp = Path(p)
            if fp.exists():
                fp.unlink()
        except Exception as e:
            logger.warning(f"Failed to delete file {p}: {e}")

    await artifact.delete()
    return {"message": "Artifact deleted", "artifact_id": artifact_id}


# --------------------------------------------------------------------------
# Profiles (presets)
# --------------------------------------------------------------------------
def _to_profile_response(profile) -> StudioProfileResponse:
    return StudioProfileResponse(
        id=str(profile.id),
        name=profile.name,
        resource_type=profile.resource_type,
        description=profile.description,
        default_prompt=profile.default_prompt,
        config=profile.config or {},
        builtin=profile.builtin,
    )


@router.get("/studio/profiles", response_model=List[StudioProfileResponse])
async def list_studio_profiles(
    resource_type: Optional[str] = Query(None, description="Filter by resource type"),
):
    """List generation presets, optionally filtered by resource type."""
    profiles = await StudioService.list_profiles(resource_type)
    return [_to_profile_response(p) for p in profiles]


@router.post("/studio/profiles", response_model=StudioProfileResponse)
async def create_studio_profile(request: StudioProfileRequest):
    """Create a custom generation preset."""
    profile = await StudioService.create_profile(request.model_dump())
    return _to_profile_response(profile)


@router.put("/studio/profiles/{profile_id}", response_model=StudioProfileResponse)
async def update_studio_profile(profile_id: str, request: StudioProfileRequest):
    """Update a generation preset (built-in presets cannot be edited)."""
    profile = await StudioService.get_profile(profile_id)
    if profile.builtin:
        raise HTTPException(status_code=400, detail="Built-in presets cannot be edited")
    profile.name = request.name
    profile.resource_type = request.resource_type
    profile.description = request.description
    profile.default_prompt = request.default_prompt
    profile.config = request.config
    await profile.save()
    return _to_profile_response(profile)


@router.delete("/studio/profiles/{profile_id}")
async def delete_studio_profile(profile_id: str):
    """Delete a custom preset (built-in presets cannot be deleted)."""
    profile = await StudioService.get_profile(profile_id)
    if profile.builtin:
        raise HTTPException(status_code=400, detail="Built-in presets cannot be deleted")
    await profile.delete()
    return {"message": "Profile deleted", "profile_id": profile_id}
