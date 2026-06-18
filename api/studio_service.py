"""Service layer for studio resource generation (Project C).

Orchestrates the four resource generators. Generation flow:
  1. Resolve the chosen StudioProfile (preset) for its prompt + config.
  2. Create a StudioArtifact record up front so it has an id.
  3. Submit the matching surreal-command with that artifact id; record the
     command id back onto the artifact for status tracking.

Mirrors api/podcast_service.py.
"""

from typing import Any, Dict, Optional

from fastapi import HTTPException
from loguru import logger
from surreal_commands import get_command_status, submit_command

from open_notebook.domain.artifact import StudioArtifact
from open_notebook.domain.notebook import Notebook
from open_notebook.domain.studio_profile import RESOURCE_TYPES, StudioProfile

# resource_type -> surreal command name
COMMAND_BY_TYPE = {
    "report": "generate_report",
    "mindmap": "generate_mindmap",
    "infographic": "generate_infographic",
    "video": "generate_video",
}


async def _build_notebook_content(notebook_id: str) -> str:
    """Assemble a plain-text context string from a notebook's sources.

    Concatenates each source's title + full_text (falling back to insights).
    This is self-contained so generators don't depend on the frontend
    serializing context.
    """
    notebook = await Notebook.get(notebook_id)
    sources = await notebook.get_sources()
    parts: list[str] = []
    for src in sources:
        title = getattr(src, "title", None) or "Untitled"
        body = getattr(src, "full_text", None)
        if not body:
            try:
                insights = await src.get_insights()
                body = "\n".join(i.content for i in insights if getattr(i, "content", None))
            except Exception:
                body = ""
        if body:
            parts.append(f"## {title}\n\n{body}")
    return "\n\n---\n\n".join(parts)


class StudioService:
    """Service layer for studio operations."""

    @staticmethod
    async def submit_generation_job(
        resource_type: str,
        profile_name: str,
        name: str,
        notebook_id: Optional[str] = None,
        content: Optional[str] = None,
        instructions: Optional[str] = None,
    ) -> Dict[str, str]:
        """Create an artifact and submit its generation command."""
        try:
            if resource_type not in RESOURCE_TYPES:
                raise ValueError(f"Unknown resource type '{resource_type}'")

            profile = await StudioProfile.get_by_name(profile_name)
            if not profile:
                raise ValueError(f"Studio profile '{profile_name}' not found")
            if profile.resource_type != resource_type:
                raise ValueError(
                    f"Profile '{profile_name}' is for '{profile.resource_type}', "
                    f"not '{resource_type}'"
                )

            # Resolve content from notebook if not provided directly.
            if not content and notebook_id:
                try:
                    content = await _build_notebook_content(notebook_id)
                except Exception as e:
                    logger.warning(f"Failed to load notebook content: {e}")
                    content = ""
            if not content:
                raise ValueError(
                    "Content is required - the notebook has no usable source content"
                )
            content = str(content)

            # Create the artifact record first so it has an id.
            artifact = StudioArtifact(
                name=name,
                resource_type=resource_type,
                notebook_id=notebook_id,
                profile_snapshot=profile.model_dump(),
                instructions=instructions,
            )
            await artifact.save()

            # Ensure command module is imported before submitting (registry).
            try:
                import commands.studio_commands  # noqa: F401
            except ImportError as import_err:
                logger.error(f"Failed to import studio commands: {import_err}")
                raise ValueError("Studio commands not available")

            command_args = {
                "artifact_id": str(artifact.id),
                "profile_name": profile_name,
                "content": content,
                "instructions": instructions,
                "system_prompt": profile.default_prompt,
                "config": profile.config,
            }

            command_name = COMMAND_BY_TYPE[resource_type]
            job_id = submit_command("open_notebook", command_name, command_args)
            if not job_id:
                raise ValueError("Failed to get job_id from submit_command")

            # Link the command to the artifact for status tracking.
            artifact.command = str(job_id)
            await artifact.save()

            logger.info(
                f"Submitted {resource_type} job {job_id} for artifact {artifact.id}"
            )
            return {"job_id": str(job_id), "artifact_id": str(artifact.id)}

        except ValueError as e:
            raise HTTPException(status_code=400, detail=str(e))
        except HTTPException:
            raise
        except Exception as e:
            logger.error(f"Failed to submit studio generation job: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to submit generation job: {str(e)}"
            )

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
            logger.error(f"Failed to get studio job status: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to get job status: {str(e)}"
            )

    @staticmethod
    async def list_artifacts(resource_type: Optional[str] = None) -> list:
        try:
            if resource_type:
                return await StudioArtifact.get_by_type(resource_type)
            return await StudioArtifact.get_all(order_by="created desc")
        except Exception as e:
            logger.error(f"Failed to list studio artifacts: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to list artifacts: {str(e)}"
            )

    @staticmethod
    async def get_artifact(artifact_id: str) -> StudioArtifact:
        try:
            return await StudioArtifact.get(artifact_id)
        except Exception as e:
            logger.error(f"Failed to get studio artifact {artifact_id}: {e}")
            raise HTTPException(status_code=404, detail=f"Artifact not found: {str(e)}")

    # ---- Profile CRUD -----------------------------------------------------
    @staticmethod
    async def list_profiles(resource_type: Optional[str] = None) -> list:
        try:
            if resource_type:
                return await StudioProfile.get_by_type(resource_type)
            return await StudioProfile.get_all(order_by="created asc")
        except Exception as e:
            logger.error(f"Failed to list studio profiles: {e}")
            raise HTTPException(
                status_code=500, detail=f"Failed to list profiles: {str(e)}"
            )

    @staticmethod
    async def create_profile(data: Dict[str, Any]) -> StudioProfile:
        try:
            profile = StudioProfile(**data)
            await profile.save()
            return profile
        except Exception as e:
            logger.error(f"Failed to create studio profile: {e}")
            raise HTTPException(
                status_code=400, detail=f"Failed to create profile: {str(e)}"
            )

    @staticmethod
    async def get_profile(profile_id: str) -> StudioProfile:
        try:
            return await StudioProfile.get(profile_id)
        except Exception as e:
            logger.error(f"Failed to get studio profile {profile_id}: {e}")
            raise HTTPException(status_code=404, detail=f"Profile not found: {str(e)}")
