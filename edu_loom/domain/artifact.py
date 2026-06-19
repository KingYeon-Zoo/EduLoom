"""Unified studio artifact: a generated multimodal study resource.

One table backs all five resource types (report / quiz / video / mindmap /
ppt), discriminated by ``resource_type``. Text outputs (report
markdown, quiz markdown, mindmap mermaid) live in ``content``; binary outputs
(video mp4, ppt slide images + .pptx deck) are written to
``data/studio/<artifact_id>/`` and their paths recorded in ``file_paths``.

Job tracking mirrors PodcastEpisode (open_notebook/podcasts/models.py): the
``command`` field links to a surreal-commands record and ``get_job_detail()``
surfaces status + error_message for the UI.
"""

from typing import Any, ClassVar, Dict, List, Optional, Union

from pydantic import ConfigDict, Field, field_validator
from surrealdb import RecordID

from open_notebook.database.repository import ensure_record_id


from open_notebook.domain.base import ObjectModel


class StudioArtifact(ObjectModel):
    """A generated study resource (report / quiz / video / mindmap / ppt)."""

    table_name: ClassVar[str] = "studio_artifact"
    nullable_fields: ClassVar[set[str]] = {
        "content",
        "instructions",
        "command",
        "notebook_id",
    }

    name: str = Field(..., description="Artifact display name")
    resource_type: str = Field(
        ..., description="report | quiz | video | mindmap | ppt"
    )
    notebook_id: Optional[str] = Field(
        default=None, description="Owning notebook (record<notebook>)"
    )
    profile_snapshot: Dict[str, Any] = Field(
        default_factory=dict, description="Profile used, snapshotted at generation"
    )
    instructions: Optional[str] = Field(
        default=None, description="User custom instructions appended to the prompt"
    )
    content: Optional[str] = Field(
        default=None, description="Text output (report markdown / mindmap mermaid)"
    )
    file_paths: List[str] = Field(
        default_factory=list,
        description="Binary outputs on disk (video mp4 / ppt slide images + deck)",
    )
    command: Optional[Union[str, RecordID]] = Field(
        default=None, description="Link to surreal-commands job"
    )

    model_config = ConfigDict(arbitrary_types_allowed=True)

    async def get_job_detail(self) -> dict:
        """Get status and error_message of the associated command."""
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

    @field_validator("command", mode="before")
    @classmethod
    def parse_command(cls, value):
        if isinstance(value, str):
            return ensure_record_id(value)
        return value

    @field_validator("notebook_id", mode="before")
    @classmethod
    def parse_notebook_id(cls, value):
        # Stored as record<notebook>; surface as string for the API layer.
        if isinstance(value, RecordID):
            return str(value)
        return value

    def _prepare_save_data(self) -> dict:
        """Ensure record-reference fields are RecordID for the database."""
        data = super()._prepare_save_data()
        if data.get("command") is not None:
            data["command"] = ensure_record_id(data["command"])
        if data.get("notebook_id") is not None:
            data["notebook_id"] = ensure_record_id(data["notebook_id"])
        return data

    @classmethod
    async def get_by_type(cls, resource_type: str) -> list["StudioArtifact"]:
        """Get all artifacts of a resource type, newest first."""
        from open_notebook.database.repository import repo_query

        result = await repo_query(
            "SELECT * FROM studio_artifact WHERE resource_type = $rt "
            "ORDER BY created DESC",
            {"rt": resource_type},
        )
        return [cls(**row) for row in result]
