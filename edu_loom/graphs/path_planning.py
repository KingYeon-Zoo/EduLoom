"""Learning-path planning graph (Project D).

Two async LangGraph nodes orchestrated under the LearningCoordinator:

  1. PathPlanner   — LLM reads notebook content + learner-profile summary →
                     ordered study steps (objectives, no resources yet).
  2. ResourcePusher — LLM matches the notebook's existing StudioArtifacts onto
                     each step; marks a ``resource_gap`` (+ suggested type and
                     generation hint) where no suitable resource exists.

Mirrors edu_loom/graphs/profile_extraction.py: PydanticOutputParser + json
structured output, classify_error wrapping, malformed JSON -> ValueError.
"""

import json
from typing import List, Optional

from ai_prompter import Prompter
from langchain_core.output_parsers.pydantic import PydanticOutputParser
from langgraph.graph import END, START, StateGraph
from loguru import logger
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from open_notebook.ai.provision import provision_langchain_model
from open_notebook.domain.artifact import StudioArtifact
from open_notebook.domain.studio_profile import RESOURCE_TYPES
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content

_VALID_TYPES = set(RESOURCE_TYPES)


# --- LLM output schemas ---------------------------------------------------
class PlannedStep(BaseModel):
    title: str = Field(..., description="Step title")
    description: str = Field("", description="One-line description")
    objectives: List[str] = Field(default_factory=list)


class PlannedPath(BaseModel):
    summary: str = Field("", description="One-paragraph overview")
    steps: List[PlannedStep] = Field(default_factory=list)


class PushDecision(BaseModel):
    order: int = Field(..., description="0-based step index this decision targets")
    recommended_artifact_ids: List[str] = Field(default_factory=list)
    resource_gap: Optional[str] = Field(None)
    gap_resource_type: Optional[str] = Field(None)
    gap_prompt: Optional[str] = Field(None)


class PushDecisions(BaseModel):
    decisions: List[PushDecision] = Field(default_factory=list)


class PathState(TypedDict, total=False):
    notebook_id: str
    notebook_content: str
    profile_summary: str
    steps: List[dict]  # accumulating PathStep dicts
    summary: str


async def plan_steps(state: PathState) -> dict:
    """PathPlanner node: notebook + profile -> ordered steps."""
    try:
        parser = PydanticOutputParser(pydantic_object=PlannedPath)
        system_prompt = Prompter(prompt_template="path/plan", parser=parser).render(  # type: ignore[arg-type]
            data={
                "notebook_content": state.get("notebook_content", ""),
                "profile_summary": state.get("profile_summary", ""),
            }
        )
        model = await provision_langchain_model(
            system_prompt,
            None,
            "transformation",
            max_tokens=4000,
            structured=dict(type="json"),
        )
        ai_message = await model.ainvoke(system_prompt)
        content = clean_thinking_content(extract_text_content(ai_message.content))
        try:
            parsed = parser.parse(content)
        except Exception as e:
            raise ValueError(f"Failed to parse planning output: {e}") from e

        steps: List[dict] = []
        for i, s in enumerate(parsed.steps):
            steps.append(
                {
                    "title": s.title,
                    "description": s.description,
                    "order": i,
                    "status": "todo",
                    "objectives": s.objectives,
                    "recommended_artifacts": [],
                    "resource_gap": None,
                    "gap_resource_type": None,
                }
            )
        logger.info(f"PathPlanner produced {len(steps)} steps")
        return {"steps": steps, "summary": parsed.summary}
    except (OpenNotebookError, ValueError):
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


def _render_artifacts(artifacts: List[StudioArtifact]) -> str:
    """Render existing artifacts (id + type + name) for the pusher LLM."""
    if not artifacts:
        return ""
    lines = []
    for a in artifacts:
        lines.append(f"- id={a.id} | type={a.resource_type} | name={a.name}")
    return "\n".join(lines)


def apply_push_decisions(
    steps: List[dict],
    decisions: List[PushDecision],
    valid_artifact_ids: set,
) -> List[dict]:
    """Apply pusher decisions onto steps in place. Pure + reusable.

    Only artifact ids that actually exist on the notebook are kept (anti-
    hallucination). gap_resource_type is validated against RESOURCE_TYPES.
    """
    by_order = {s["order"]: s for s in steps}
    for d in decisions:
        step = by_order.get(d.order)
        if step is None:
            continue
        recommended = [
            aid for aid in (d.recommended_artifact_ids or []) if aid in valid_artifact_ids
        ]
        step["recommended_artifacts"] = recommended
        if recommended:
            # Has a real resource -> no gap.
            step["resource_gap"] = None
            step["gap_resource_type"] = None
        else:
            gap_type = (d.gap_resource_type or "").strip().lower()
            step["resource_gap"] = d.resource_gap or step.get("resource_gap")
            step["gap_resource_type"] = gap_type if gap_type in _VALID_TYPES else None
            if d.gap_prompt:
                # Stash the generation hint inside resource_gap text if separate
                # field absent; keep resource_gap human-readable.
                step["gap_prompt"] = d.gap_prompt
    return steps


async def push_resources(state: PathState) -> dict:
    """ResourcePusher node: match existing artifacts onto steps / mark gaps."""
    try:
        steps = state.get("steps", [])
        if not steps:
            return {"steps": steps}

        notebook_id = state.get("notebook_id", "")
        artifacts: List[StudioArtifact] = []
        if notebook_id:
            try:
                all_artifacts = await StudioArtifact.get_all(order_by="created desc")
                artifacts = [
                    a
                    for a in all_artifacts
                    if str(getattr(a, "notebook_id", "")) == str(notebook_id)
                    and (a.content or a.file_paths)  # only completed ones
                ]
            except Exception as e:
                logger.warning(f"ResourcePusher failed to load artifacts: {e}")
                artifacts = []

        valid_ids = {str(a.id) for a in artifacts}

        parser = PydanticOutputParser(pydantic_object=PushDecisions)
        steps_json = json.dumps(
            [
                {"order": s["order"], "title": s["title"], "objectives": s.get("objectives", [])}
                for s in steps
            ],
            ensure_ascii=False,
            indent=2,
        )
        system_prompt = Prompter(prompt_template="path/push", parser=parser).render(  # type: ignore[arg-type]
            data={
                "steps": steps_json,
                "artifacts": _render_artifacts(artifacts),
            }
        )
        model = await provision_langchain_model(
            system_prompt,
            None,
            "transformation",
            max_tokens=3000,
            structured=dict(type="json"),
        )
        ai_message = await model.ainvoke(system_prompt)
        content = clean_thinking_content(extract_text_content(ai_message.content))
        try:
            parsed = parser.parse(content)
        except Exception as e:
            raise ValueError(f"Failed to parse push output: {e}") from e

        updated = apply_push_decisions(steps, parsed.decisions, valid_ids)
        logger.info(f"ResourcePusher applied {len(parsed.decisions)} decisions")
        return {"steps": updated}
    except (OpenNotebookError, ValueError):
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


_builder = StateGraph(PathState)
_builder.add_node("plan", plan_steps)
_builder.add_node("push", push_resources)
_builder.add_edge(START, "plan")
_builder.add_edge("plan", "push")
_builder.add_edge("push", END)
graph = _builder.compile()
