"""Service layer for studio resource generation (Project C).

Orchestrates the four resource generators. Generation flow:
  1. Resolve the chosen StudioProfile (preset) for its prompt + config.
  2. Create a StudioArtifact record up front so it has an id.
  3. Submit the matching surreal-command with that artifact id; record the
     command id back onto the artifact for status tracking.

Mirrors api/podcast_service.py.
"""

from typing import Any, Dict, List, Optional

import json

from fastapi import HTTPException
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger
from surreal_commands import get_command_status, submit_command

from open_notebook.ai.provision import provision_langchain_model
from open_notebook.domain.artifact import StudioArtifact
from open_notebook.domain.studio_profile import RESOURCE_TYPES, StudioProfile
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.learning_context import (
    build_notebook_content as _build_notebook_content,
)
from open_notebook.utils.learning_context import (
    summarize_learner_profile as _summarize_learner_profile,
)
from open_notebook.utils.text_utils import extract_text_content

# resource_type -> surreal command name
COMMAND_BY_TYPE = {
    "report": "generate_report",
    "quiz": "generate_quiz",
    "mindmap": "generate_mindmap",
    "ppt": "generate_ppt",
    "video": "generate_video",
}


# Schema the recommender LLM must return.
_RECOMMEND_SCHEMA = (
    '{"recommended_profile_name": "<必须是候选预设名之一>", '
    '"reason": "<一句话中文推荐理由，结合学习画像>", '
    '"suggested_instructions": "<可选的中文自定义指令补充，没有则空字符串>"}'
)


def _parse_recommendation(raw: str, valid_names: List[str]) -> Dict[str, str]:
    """Parse the recommender LLM's JSON; coerce to a valid known profile name."""
    text = raw.strip()
    if text.startswith("```"):
        lines = text.splitlines()[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    name = ""
    reason = ""
    suggested = ""
    try:
        parsed = json.loads(text)
        name = str(parsed.get("recommended_profile_name", "")).strip()
        reason = str(parsed.get("reason", "")).strip()
        suggested = str(parsed.get("suggested_instructions", "")).strip()
    except (json.JSONDecodeError, AttributeError):
        pass
    # Coerce to a valid name (exact match, else substring, else first candidate).
    if name not in valid_names:
        match = next((n for n in valid_names if n and (n in name or name in n)), None)
        name = match or (valid_names[0] if valid_names else "")
    return {
        "recommended_profile_name": name,
        "reason": reason,
        "suggested_instructions": suggested,
    }


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

    @staticmethod
    async def recommend_profile(resource_type: str) -> Dict[str, str]:
        """Recommend a preset for this resource type from the learner profile.

        A lightweight "RecommenderAgent": reads the singleton learner profile +
        the candidate presets, runs a single LLM call, and returns which preset
        to use plus a one-line reason and optional custom-instruction補充. Falls
        back to the first preset (with a generic reason) when the profile is
        empty (cold start) or the LLM call fails.
        """
        if resource_type not in RESOURCE_TYPES:
            raise HTTPException(
                status_code=400, detail=f"Unknown resource type '{resource_type}'"
            )

        profiles = await StudioProfile.get_by_type(resource_type)
        if not profiles:
            raise HTTPException(
                status_code=404,
                detail=f"No presets available for '{resource_type}'",
            )
        valid_names = [p.name for p in profiles]

        profile_text = await _summarize_learner_profile()

        # Cold start: no learner signal yet -> default to the first preset.
        if not profile_text:
            return {
                "recommended_profile_name": valid_names[0],
                "reason": "暂无学习画像数据，已为你推荐默认预设。多与 AI 对话可获得更精准的个性化推荐。",
                "suggested_instructions": "",
                "profile_empty": True,
            }

        catalog = "\n".join(
            f"- {p.name}：{p.description or '（无描述）'}" for p in profiles
        )
        system_prompt = (
            "你是一名个性化学习顾问。根据学习者画像，从候选预设中选出最适合该学习者的一个，"
            "并给出一句中文推荐理由，必要时补充一条简短的中文自定义生成指令。"
            f"只输出一个 JSON 对象，格式如下，不要任何解释或代码块标记：\n{_RECOMMEND_SCHEMA}"
        )
        human = (
            f"学习者画像：\n{profile_text}\n\n"
            f"候选预设（资源类型：{resource_type}）：\n{catalog}\n\n"
            f"recommended_profile_name 必须是以下之一：{valid_names}"
        )
        try:
            chain = await provision_langchain_model(
                f"{system_prompt}\n{human}", None, "transformation", max_tokens=1024
            )
            response = await chain.ainvoke(
                [SystemMessage(content=system_prompt), HumanMessage(content=human)]
            )
            raw = clean_thinking_content(extract_text_content(response.content))
            result = _parse_recommendation(raw, valid_names)
            result["profile_empty"] = False
            return result
        except Exception as e:
            logger.warning(f"Recommendation LLM failed, falling back: {e}")
            return {
                "recommended_profile_name": valid_names[0],
                "reason": "已根据你的学习画像推荐预设。",
                "suggested_instructions": "",
                "profile_empty": False,
            }

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
