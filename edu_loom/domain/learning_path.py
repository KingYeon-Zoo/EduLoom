"""Learning path + assessment domain models (Projects D / E).

Two ObjectModels backing the personalized learning loop:

  * ``LearningPath``       — one ordered study plan per notebook (course). Each
                             step carries objectives, a status the learner can
                             toggle, recommended existing StudioArtifacts, and a
                             ``resource_gap`` hint when no suitable resource
                             exists yet.
  * ``LearningAssessment`` — a multi-dimension evaluation snapshot for a
                             notebook (knowledge mastery / quiz performance /
                             progress / error-prone points / engagement / goal
                             attainment), plus adjustment suggestions feeding
                             back into re-planning.

Both mirror ``StudioArtifact`` (open_notebook/domain/artifact.py): record-ref
fields stored as RecordID, a ``command`` link to the async job for status
tracking, and ``get_by_notebook`` class queries.
"""

from typing import Any, ClassVar, Dict, List, Optional, Union

from pydantic import BaseModel, ConfigDict, Field, field_validator
from surrealdb import RecordID

from open_notebook.database.repository import ensure_record_id, repo_query
from open_notebook.domain.base import ObjectModel

# Valid step statuses shared with the API/frontend.
STEP_STATUSES = ("todo", "in_progress", "done")

# Assessment dimensions (single source of truth, mirrors the rubric directions).
ASSESSMENT_DIMENSIONS: Dict[str, str] = {
    "knowledge_mastery": "知识掌握",
    "quiz_performance": "练习表现",
    "learning_progress": "学习进度",
    "error_prone": "易错点",
    "engagement": "学习投入",
    "goal_attainment": "目标达成",
}


class PathStep(BaseModel):
    """A single ordered step within a learning path."""

    title: str = Field(..., description="Step title")
    description: str = Field("", description="What this step covers")
    order: int = Field(0, description="0-based position in the path")
    status: str = Field("todo", description="todo | in_progress | done")
    objectives: List[str] = Field(
        default_factory=list, description="Concrete learning objectives"
    )
    recommended_artifacts: List[str] = Field(
        default_factory=list,
        description="StudioArtifact ids recommended for this step",
    )
    resource_gap: Optional[str] = Field(
        default=None,
        description="When no suitable resource exists: what kind of C resource "
        "to generate + a one-line generation hint",
    )
    gap_resource_type: Optional[str] = Field(
        default=None,
        description="Suggested resource type to fill the gap "
        "(report|quiz|mindmap|ppt|video)",
    )

    @field_validator("status", mode="before")
    @classmethod
    def _valid_status(cls, v):
        if v not in STEP_STATUSES:
            return "todo"
        return v


class AssessmentDimension(BaseModel):
    """One scored dimension of a learning assessment."""

    name: str = Field(..., description="Dimension key (see ASSESSMENT_DIMENSIONS)")
    label: str = Field("", description="Chinese display label")
    score: int = Field(0, ge=0, le=100, description="Score 0-100")
    comment: str = Field("", description="Short qualitative comment")
    evidence: str = Field(
        "", description="Evidence supporting the score (anti-hallucination)"
    )

    @field_validator("score", mode="before")
    @classmethod
    def _clamp_score(cls, v):
        try:
            v = int(round(float(v)))
        except (TypeError, ValueError):
            return 0
        return max(0, min(100, v))


class LearningPath(ObjectModel):
    """An ordered, personalized study plan for one notebook (course)."""

    table_name: ClassVar[str] = "learning_path"
    nullable_fields: ClassVar[set[str]] = {"summary", "command", "notebook_id"}

    name: str = Field(..., description="Path display name")
    notebook_id: Optional[str] = Field(
        default=None, description="Owning notebook (record<notebook>)"
    )
    summary: Optional[str] = Field(
        default=None, description="One-paragraph overview of the plan"
    )
    steps: List[Dict[str, Any]] = Field(
        default_factory=list, description="Ordered PathStep dicts"
    )
    profile_snapshot: Dict[str, Any] = Field(
        default_factory=dict, description="Learner-profile summary at planning time"
    )
    command: Optional[Union[str, RecordID]] = Field(
        default=None, description="Link to surreal-commands job"
    )

    model_config = ConfigDict(arbitrary_types_allowed=True)

    @field_validator("command", mode="before")
    @classmethod
    def parse_command(cls, value):
        if isinstance(value, str):
            return ensure_record_id(value)
        return value

    @field_validator("notebook_id", mode="before")
    @classmethod
    def parse_notebook_id(cls, value):
        if isinstance(value, RecordID):
            return str(value)
        return value

    def _prepare_save_data(self) -> dict:
        data = super()._prepare_save_data()
        if data.get("command") is not None:
            data["command"] = ensure_record_id(data["command"])
        if data.get("notebook_id") is not None:
            data["notebook_id"] = ensure_record_id(data["notebook_id"])
        return data

    async def get_job_detail(self) -> dict:
        """Status + error_message of the associated planning command."""
        if not self.command:
            return {"status": None, "error_message": None}
        try:
            from surreal_commands import get_command_status

            status = await get_command_status(str(self.command))
            if not status:
                return {"status": "unknown", "error_message": None}
            return {
                "status": status.status,
                "error_message": getattr(status, "error_message", None),
            }
        except Exception:
            return {"status": "unknown", "error_message": None}

    @classmethod
    async def get_by_notebook(cls, notebook_id: str) -> Optional["LearningPath"]:
        """Get the (single) learning path for a notebook, if any."""
        result = await repo_query(
            "SELECT * FROM learning_path WHERE notebook_id = $nb "
            "ORDER BY created DESC LIMIT 1",
            {"nb": ensure_record_id(notebook_id)},
        )
        if result:
            return cls(**result[0])
        return None


class LearningAssessment(ObjectModel):
    """A multi-dimension evaluation snapshot for a notebook."""

    table_name: ClassVar[str] = "learning_assessment"
    nullable_fields: ClassVar[set[str]] = {"overall_comment", "command", "notebook_id"}

    notebook_id: Optional[str] = Field(
        default=None, description="Owning notebook (record<notebook>)"
    )
    dimensions: List[Dict[str, Any]] = Field(
        default_factory=list, description="AssessmentDimension dicts"
    )
    overall_comment: Optional[str] = Field(
        default=None, description="Overall qualitative summary"
    )
    suggestions: List[str] = Field(
        default_factory=list,
        description="Adjustment suggestions for path/resource pushing",
    )
    profile_snapshot: Dict[str, Any] = Field(
        default_factory=dict, description="Learner-profile summary at assessment time"
    )
    command: Optional[Union[str, RecordID]] = Field(
        default=None, description="Link to surreal-commands job"
    )

    model_config = ConfigDict(arbitrary_types_allowed=True)

    @field_validator("command", mode="before")
    @classmethod
    def parse_command(cls, value):
        if isinstance(value, str):
            return ensure_record_id(value)
        return value

    @field_validator("notebook_id", mode="before")
    @classmethod
    def parse_notebook_id(cls, value):
        if isinstance(value, RecordID):
            return str(value)
        return value

    def _prepare_save_data(self) -> dict:
        data = super()._prepare_save_data()
        if data.get("command") is not None:
            data["command"] = ensure_record_id(data["command"])
        if data.get("notebook_id") is not None:
            data["notebook_id"] = ensure_record_id(data["notebook_id"])
        return data

    async def get_job_detail(self) -> dict:
        """Status + error_message of the associated assessment command."""
        if not self.command:
            return {"status": None, "error_message": None}
        try:
            from surreal_commands import get_command_status

            status = await get_command_status(str(self.command))
            if not status:
                return {"status": "unknown", "error_message": None}
            return {
                "status": status.status,
                "error_message": getattr(status, "error_message", None),
            }
        except Exception:
            return {"status": "unknown", "error_message": None}

    @classmethod
    async def get_by_notebook(
        cls, notebook_id: str
    ) -> List["LearningAssessment"]:
        """Get all assessments for a notebook, newest first."""
        result = await repo_query(
            "SELECT * FROM learning_assessment WHERE notebook_id = $nb "
            "ORDER BY created DESC",
            {"nb": ensure_record_id(notebook_id)},
        )
        return [cls(**row) for row in result]
