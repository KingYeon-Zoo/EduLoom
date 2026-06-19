"""Service layer for the learning loop (Projects D / E).

Thin wrapper over the LearningPath / LearningAssessment domain models + the
generate_path / generate_assessment commands, plus the agent roster. Mirrors
api/studio_service.py and api/learner_profile_service.py.
"""

from typing import Any, Dict, List, Optional

from fastapi import HTTPException
from loguru import logger
from surreal_commands import get_command_status, submit_command

from edu_loom.agents.coordinator import AGENT_ROSTER
from edu_loom.domain.learning_path import (
    STEP_STATUSES,
    LearningAssessment,
    LearningPath,
)
from open_notebook.domain.notebook import Notebook


class LearningService:
    """Service layer for learning path + assessment operations."""

    # ---- Path -------------------------------------------------------------
    @staticmethod
    async def get_path(notebook_id: str) -> Optional[LearningPath]:
        try:
            return await LearningPath.get_by_notebook(notebook_id)
        except Exception as e:
            logger.error(f"Failed to get learning path: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get learning path: {str(e)}"
            )

    @staticmethod
    async def submit_path_generation(notebook_id: str) -> Dict[str, str]:
        """Submit a path-planning job; returns the command id for polling."""
        try:
            # Validate the notebook exists and derive a default name.
            notebook = await Notebook.get(notebook_id)
            name = f"{getattr(notebook, 'name', '课程')} · 学习路径"
        except Exception:
            raise HTTPException(status_code=404, detail="Notebook not found")

        try:
            import commands.learning_commands  # noqa: F401
        except ImportError as e:
            logger.error(f"Failed to import learning commands: {e}")
            raise HTTPException(status_code=500, detail="Learning commands unavailable")

        try:
            job_id = submit_command(
                "open_notebook",
                "generate_path",
                {"notebook_id": notebook_id, "name": name},
            )
            if not job_id:
                raise ValueError("Failed to get job_id from submit_command")

            # Link the command onto the existing path (if any) for status tracking.
            existing = await LearningPath.get_by_notebook(notebook_id)
            if existing:
                existing.command = str(job_id)
                await existing.save()

            logger.info(f"Submitted path generation job {job_id} for {notebook_id}")
            return {"job_id": str(job_id)}
        except Exception as e:
            logger.error(f"Failed to submit path generation: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to submit path generation: {str(e)}"
            )

    @staticmethod
    async def update_step_status(
        notebook_id: str, order: int, status: str
    ) -> LearningPath:
        """Update one step's status (learner self-tracking, Open Learner Model)."""
        if status not in STEP_STATUSES:
            raise HTTPException(
                status_code=400, detail=f"Invalid status '{status}'"
            )
        path = await LearningPath.get_by_notebook(notebook_id)
        if not path:
            raise HTTPException(status_code=404, detail="Learning path not found")

        updated = False
        for step in path.steps:
            if step.get("order") == order:
                step["status"] = status
                updated = True
                break
        if not updated:
            raise HTTPException(status_code=404, detail=f"Step {order} not found")

        await path.save()
        return path

    # ---- Assessment -------------------------------------------------------
    @staticmethod
    async def get_assessments(notebook_id: str) -> List[LearningAssessment]:
        try:
            return await LearningAssessment.get_by_notebook(notebook_id)
        except Exception as e:
            logger.error(f"Failed to get assessments: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get assessments: {str(e)}"
            )

    @staticmethod
    async def submit_assessment(notebook_id: str) -> Dict[str, str]:
        """Submit an assessment job; returns the command id for polling."""
        try:
            await Notebook.get(notebook_id)
        except Exception:
            raise HTTPException(status_code=404, detail="Notebook not found")

        try:
            import commands.learning_commands  # noqa: F401
        except ImportError as e:
            logger.error(f"Failed to import learning commands: {e}")
            raise HTTPException(status_code=500, detail="Learning commands unavailable")

        try:
            job_id = submit_command(
                "open_notebook",
                "generate_assessment",
                {"notebook_id": notebook_id},
            )
            if not job_id:
                raise ValueError("Failed to get job_id from submit_command")
            logger.info(f"Submitted assessment job {job_id} for {notebook_id}")
            return {"job_id": str(job_id)}
        except Exception as e:
            logger.error(f"Failed to submit assessment: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to submit assessment: {str(e)}"
            )

    # ---- Job status / roster ---------------------------------------------
    @staticmethod
    async def get_job_status(job_id: str) -> Dict[str, Any]:
        try:
            status = await get_command_status(job_id)
            return {
                "job_id": job_id,
                "status": status.status if status else "unknown",
                "error_message": getattr(status, "error_message", None)
                if status
                else None,
            }
        except Exception as e:
            logger.error(f"Failed to get learning job status: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get job status: {str(e)}"
            )

    @staticmethod
    def get_agent_roster() -> List[Dict[str, str]]:
        """Return the multi-agent roster (for the 协作智能体 view + docs)."""
        return AGENT_ROSTER
