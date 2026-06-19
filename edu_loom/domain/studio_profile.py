"""Studio generation presets (templates).

A StudioProfile is a reusable preset for one resource type (report / quiz /
video / mindmap / ppt). It bundles a default system prompt and type-specific
config (e.g. video ratio/duration, ppt slide count, quiz question count). Users
pick a profile + add free-form custom instructions when generating, and can
CRUD their own profiles in the Templates tab.

Mirrors the EpisodeProfile pattern (open_notebook/podcasts/models.py).
"""

from typing import Any, ClassVar, Dict, Optional

from pydantic import Field

from open_notebook.database.repository import repo_query
from open_notebook.domain.base import ObjectModel

# Valid resource types shared across the studio feature.
RESOURCE_TYPES = ("report", "quiz", "video", "mindmap", "ppt")


class StudioProfile(ObjectModel):
    """A reusable generation preset scoped to one resource type."""

    table_name: ClassVar[str] = "studio_profile"
    nullable_fields: ClassVar[set[str]] = {"description"}

    name: str = Field(..., description="Unique profile name")
    resource_type: str = Field(
        ..., description="report | quiz | video | mindmap | ppt"
    )
    description: Optional[str] = Field(None, description="Profile description")
    default_prompt: str = Field(
        ..., description="System prompt template for this preset"
    )
    config: Dict[str, Any] = Field(
        default_factory=dict,
        description="Type-specific params (video: ratio/duration/resolution; "
        "ppt: num_images/size)",
    )
    builtin: bool = Field(
        default=False, description="Seeded preset (UI marks as non-deletable)"
    )

    @classmethod
    async def get_by_name(cls, name: str) -> Optional["StudioProfile"]:
        """Get a studio profile by its unique name."""
        result = await repo_query(
            "SELECT * FROM studio_profile WHERE name = $name", {"name": name}
        )
        if result:
            return cls(**result[0])
        return None

    @classmethod
    async def get_by_type(cls, resource_type: str) -> list["StudioProfile"]:
        """Get all profiles for a given resource type, oldest first."""
        result = await repo_query(
            "SELECT * FROM studio_profile WHERE resource_type = $rt "
            "ORDER BY created ASC",
            {"rt": resource_type},
        )
        return [cls(**row) for row in result]
