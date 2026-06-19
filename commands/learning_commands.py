"""Async commands for the learning loop (Projects D / E).

Two background commands run under surreal-commands (same mechanism as podcasts /
studio / profile extraction), driven by the LearningCoordinator:

  * generate_path        — PathPlanner + ResourcePusher -> upsert one
                           ``LearningPath`` per notebook (overwrites the old one).
  * generate_assessment  — AssessmentAnalyst -> append a ``LearningAssessment``.

Retry strategy mirrors profile_commands: exponential jitter, never retry
ValueError / ConfigurationError (permanent failures).
"""

import time
from typing import List, Optional

from loguru import logger
from surreal_commands import CommandInput, CommandOutput, command

from edu_loom.agents.coordinator import LearningCoordinator
from edu_loom.domain.learning_path import LearningAssessment, LearningPath
from open_notebook.domain.artifact import StudioArtifact
from open_notebook.exceptions import ConfigurationError


# --------------------------------------------------------------------------
# Path planning
# --------------------------------------------------------------------------
class GeneratePathInput(CommandInput):
    """Input for a learning-path planning run."""

    notebook_id: str
    name: Optional[str] = None  # path display name; defaults from notebook


class GeneratePathOutput(CommandOutput):
    success: bool
    path_id: Optional[str] = None
    step_count: int = 0
    processing_time: float = 0.0
    error_message: Optional[str] = None


@command(
    "generate_path",
    app="open_notebook",
    retry={
        "max_attempts": 5,
        "wait_strategy": "exponential_jitter",
        "wait_min": 1,
        "wait_max": 60,
        "stop_on": [ValueError, ConfigurationError],
        "retry_log_level": "debug",
    },
)
async def generate_path_command(input_data: GeneratePathInput) -> GeneratePathOutput:
    """Plan a learning path for a notebook and upsert it (one per notebook)."""
    start_time = time.time()
    try:
        notebook_id = input_data.notebook_id
        if not notebook_id:
            raise ValueError("notebook_id is required")

        result = await LearningCoordinator.plan_path(notebook_id)
        steps = result.get("steps", [])

        # Upsert: reuse the existing path record for this notebook if present.
        existing = await LearningPath.get_by_notebook(notebook_id)
        if existing:
            existing.name = input_data.name or existing.name
            existing.summary = result.get("summary", "")
            existing.steps = steps
            existing.profile_snapshot = result.get("profile_snapshot", {})
            existing.command = None  # detach old job link; refreshed below if needed
            await existing.save()
            path = existing
        else:
            path = LearningPath(
                name=input_data.name or "学习路径",
                notebook_id=notebook_id,
                summary=result.get("summary", ""),
                steps=steps,
                profile_snapshot=result.get("profile_snapshot", {}),
            )
            await path.save()

        processing_time = time.time() - start_time
        logger.info(
            f"generate_path completed in {processing_time:.2f}s; "
            f"{len(steps)} steps for {notebook_id}"
        )
        return GeneratePathOutput(
            success=True,
            path_id=str(path.id),
            step_count=len(steps),
            processing_time=processing_time,
        )
    except ValueError as e:
        processing_time = time.time() - start_time
        logger.error(f"generate_path permanent failure: {e}")
        return GeneratePathOutput(
            success=False, processing_time=processing_time, error_message=str(e)
        )
    except Exception as e:
        logger.debug(f"generate_path transient error: {e}")
        raise


# --------------------------------------------------------------------------
# Assessment
# --------------------------------------------------------------------------
class GenerateAssessmentInput(CommandInput):
    """Input for a learning-effect assessment run."""

    notebook_id: str


class GenerateAssessmentOutput(CommandOutput):
    success: bool
    assessment_id: Optional[str] = None
    dimension_count: int = 0
    processing_time: float = 0.0
    error_message: Optional[str] = None


async def _render_path_progress(notebook_id: str) -> str:
    """Render the notebook's path progress for the assessment prompt."""
    path = await LearningPath.get_by_notebook(notebook_id)
    if not path or not path.steps:
        return ""
    lines = []
    for s in path.steps:
        status = s.get("status", "todo")
        lines.append(f"- [{status}] {s.get('title', '')}")
    return "\n".join(lines)


async def _render_quiz_content(notebook_id: str) -> str:
    """Concatenate this notebook's quiz artifact contents for the assessment."""
    try:
        artifacts = await StudioArtifact.get_by_type("quiz")
    except Exception as e:
        logger.warning(f"Failed to load quiz artifacts: {e}")
        return ""
    parts: List[str] = []
    for a in artifacts:
        if str(getattr(a, "notebook_id", "")) != str(notebook_id):
            continue
        if a.content:
            parts.append(f"## {a.name}\n\n{a.content}")
    return "\n\n---\n\n".join(parts)


@command(
    "generate_assessment",
    app="open_notebook",
    retry={
        "max_attempts": 5,
        "wait_strategy": "exponential_jitter",
        "wait_min": 1,
        "wait_max": 60,
        "stop_on": [ValueError, ConfigurationError],
        "retry_log_level": "debug",
    },
)
async def generate_assessment_command(
    input_data: GenerateAssessmentInput,
) -> GenerateAssessmentOutput:
    """Assess learning effect for a notebook and append a snapshot."""
    start_time = time.time()
    try:
        notebook_id = input_data.notebook_id
        if not notebook_id:
            raise ValueError("notebook_id is required")

        path_progress = await _render_path_progress(notebook_id)
        quiz_content = await _render_quiz_content(notebook_id)

        result = await LearningCoordinator.assess(
            notebook_id, path_progress, quiz_content
        )

        assessment = LearningAssessment(
            notebook_id=notebook_id,
            dimensions=result.get("dimensions", []),
            overall_comment=result.get("overall_comment", ""),
            suggestions=result.get("suggestions", []),
            profile_snapshot=result.get("profile_snapshot", {}),
        )
        await assessment.save()

        processing_time = time.time() - start_time
        dims = result.get("dimensions", [])
        logger.info(
            f"generate_assessment completed in {processing_time:.2f}s; "
            f"{len(dims)} dimensions for {notebook_id}"
        )
        return GenerateAssessmentOutput(
            success=True,
            assessment_id=str(assessment.id),
            dimension_count=len(dims),
            processing_time=processing_time,
        )
    except ValueError as e:
        processing_time = time.time() - start_time
        logger.error(f"generate_assessment permanent failure: {e}")
        return GenerateAssessmentOutput(
            success=False, processing_time=processing_time, error_message=str(e)
        )
    except Exception as e:
        logger.debug(f"generate_assessment transient error: {e}")
        raise
