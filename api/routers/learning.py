"""Learning loop API (Projects D / E).

Endpoints for personalized learning-path planning + resource pushing (D),
multi-dimension learning-effect assessment (E⑤), and the multi-agent roster.
Generation runs async (returns a job id; poll via /api/commands/{id}).
Mirrors api/routers/studio.py.
"""

from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Query
from pydantic import BaseModel

from api.learning_service import LearningService

router = APIRouter()


# --------------------------------------------------------------------------
# Schemas
# --------------------------------------------------------------------------
class PathStepResponse(BaseModel):
    title: str
    description: str = ""
    order: int = 0
    status: str = "todo"
    objectives: List[str] = []
    recommended_artifacts: List[str] = []
    resource_gap: Optional[str] = None
    gap_resource_type: Optional[str] = None
    gap_prompt: Optional[str] = None


class LearningPathResponse(BaseModel):
    id: str
    name: str
    notebook_id: Optional[str] = None
    summary: Optional[str] = None
    steps: List[PathStepResponse] = []
    profile_snapshot: Dict[str, Any] = {}
    created: Optional[str] = None
    updated: Optional[str] = None
    job_status: Optional[str] = None
    error_message: Optional[str] = None


class GenerateRequest(BaseModel):
    notebook_id: str


class GenerateResponse(BaseModel):
    job_id: str
    status: str = "submitted"
    message: str = ""


class UpdateStepRequest(BaseModel):
    notebook_id: str
    order: int
    status: str


class AssessmentDimensionResponse(BaseModel):
    name: str
    label: str = ""
    score: int = 0
    comment: str = ""
    evidence: str = ""


class LearningAssessmentResponse(BaseModel):
    id: str
    notebook_id: Optional[str] = None
    dimensions: List[AssessmentDimensionResponse] = []
    overall_comment: Optional[str] = None
    suggestions: List[str] = []
    created: Optional[str] = None


class AgentInfo(BaseModel):
    key: str
    name: str
    project: str
    responsibility: str


# --------------------------------------------------------------------------
# Helpers
# --------------------------------------------------------------------------
async def _to_path_response(path) -> LearningPathResponse:
    job_status = None
    error_message = None
    if path.command:
        try:
            detail = await path.get_job_detail()
            job_status = detail["status"]
            error_message = detail["error_message"]
        except Exception:
            job_status = "unknown"
    else:
        job_status = "completed" if path.steps else "unknown"

    steps = [PathStepResponse(**s) for s in (path.steps or [])]
    return LearningPathResponse(
        id=str(path.id),
        name=path.name,
        notebook_id=str(path.notebook_id) if path.notebook_id else None,
        summary=path.summary,
        steps=steps,
        profile_snapshot=path.profile_snapshot or {},
        created=str(path.created) if path.created else None,
        updated=str(path.updated) if path.updated else None,
        job_status=job_status,
        error_message=error_message,
    )


def _to_assessment_response(a) -> LearningAssessmentResponse:
    return LearningAssessmentResponse(
        id=str(a.id),
        notebook_id=str(a.notebook_id) if a.notebook_id else None,
        dimensions=[AssessmentDimensionResponse(**d) for d in (a.dimensions or [])],
        overall_comment=a.overall_comment,
        suggestions=a.suggestions or [],
        created=str(a.created) if a.created else None,
    )


# --------------------------------------------------------------------------
# Path endpoints
# --------------------------------------------------------------------------
@router.get("/learning/path", response_model=Optional[LearningPathResponse])
async def get_learning_path(
    notebook_id: str = Query(..., description="Notebook id"),
):
    """Get the learning path for a notebook (null if none planned yet)."""
    path = await LearningService.get_path(notebook_id)
    if not path:
        return None
    return await _to_path_response(path)


@router.post("/learning/path/generate", response_model=GenerateResponse)
async def generate_learning_path(request: GenerateRequest):
    """Plan a learning path for a notebook. Returns a job id immediately."""
    result = await LearningService.submit_path_generation(request.notebook_id)
    return GenerateResponse(
        job_id=result["job_id"], message="Path planning started"
    )


@router.patch("/learning/path/steps", response_model=LearningPathResponse)
async def update_path_step(request: UpdateStepRequest):
    """Update a single step's status (learner self-tracking)."""
    path = await LearningService.update_step_status(
        request.notebook_id, request.order, request.status
    )
    return await _to_path_response(path)


# --------------------------------------------------------------------------
# Assessment endpoints
# --------------------------------------------------------------------------
@router.get(
    "/learning/assessments", response_model=List[LearningAssessmentResponse]
)
async def get_assessments(
    notebook_id: str = Query(..., description="Notebook id"),
):
    """Get assessment history for a notebook, newest first."""
    assessments = await LearningService.get_assessments(notebook_id)
    return [_to_assessment_response(a) for a in assessments]


@router.post("/learning/assessment/generate", response_model=GenerateResponse)
async def generate_assessment(request: GenerateRequest):
    """Assess learning effect for a notebook. Returns a job id immediately."""
    result = await LearningService.submit_assessment(request.notebook_id)
    return GenerateResponse(job_id=result["job_id"], message="Assessment started")


# --------------------------------------------------------------------------
# Agent roster
# --------------------------------------------------------------------------
@router.get("/learning/agents", response_model=List[AgentInfo])
async def get_agent_roster():
    """List the collaborating agents (multi-agent architecture, for UI + docs)."""
    return [AgentInfo(**a) for a in LearningService.get_agent_roster()]
