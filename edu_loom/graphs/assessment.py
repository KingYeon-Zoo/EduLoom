"""Learning-effect assessment graph (Project E - 学习效果评估).

A single async LangGraph node (AssessmentAnalyst) under the LearningCoordinator:
reads the learner-profile summary + the notebook's quiz artifacts + the path
progress, then produces a multi-dimension evaluation (score + comment +
evidence per dimension) plus adjustment suggestions for re-planning.

Mirrors edu_loom/graphs/profile_extraction.py conventions.
"""

from typing import List

from ai_prompter import Prompter
from langchain_core.output_parsers.pydantic import PydanticOutputParser
from langgraph.graph import END, START, StateGraph
from loguru import logger
from pydantic import BaseModel, Field
from typing_extensions import TypedDict

from edu_loom.domain.learning_path import ASSESSMENT_DIMENSIONS
from open_notebook.ai.provision import provision_langchain_model
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content

_VALID_DIMENSIONS = set(ASSESSMENT_DIMENSIONS.keys())


class ScoredDimension(BaseModel):
    name: str = Field(..., description="Dimension key")
    # No range constraint here: real LLMs occasionally emit out-of-range scores;
    # we clamp to [0,100] in analyze() rather than fail parsing on the whole batch.
    score: int = Field(0)
    comment: str = Field("")
    evidence: str = Field("")


class AssessmentResult(BaseModel):
    dimensions: List[ScoredDimension] = Field(default_factory=list)
    suggestions: List[str] = Field(default_factory=list)
    overall_comment: str = Field("")


class AssessmentState(TypedDict, total=False):
    profile_summary: str
    path_progress: str
    quiz_content: str
    dimensions: List[dict]
    suggestions: List[str]
    overall_comment: str


async def analyze(state: AssessmentState) -> dict:
    """AssessmentAnalyst node: profile + quiz + progress -> scored dimensions."""
    try:
        parser = PydanticOutputParser(pydantic_object=AssessmentResult)
        system_prompt = Prompter(
            prompt_template="assessment/analyze", parser=parser
        ).render(  # type: ignore[arg-type]
            data={
                "profile_summary": state.get("profile_summary", ""),
                "path_progress": state.get("path_progress", ""),
                "quiz_content": state.get("quiz_content", ""),
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
            raise ValueError(f"Failed to parse assessment output: {e}") from e

        dimensions: List[dict] = []
        for d in parsed.dimensions:
            if d.name not in _VALID_DIMENSIONS:
                continue
            try:
                score = int(round(float(d.score)))
            except (TypeError, ValueError):
                score = 0
            dimensions.append(
                {
                    "name": d.name,
                    "label": ASSESSMENT_DIMENSIONS[d.name],
                    "score": max(0, min(100, score)),
                    "comment": d.comment,
                    "evidence": d.evidence,
                }
            )
        logger.info(f"AssessmentAnalyst scored {len(dimensions)} dimensions")
        return {
            "dimensions": dimensions,
            "suggestions": parsed.suggestions,
            "overall_comment": parsed.overall_comment,
        }
    except (OpenNotebookError, ValueError):
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


_builder = StateGraph(AssessmentState)
_builder.add_node("analyze", analyze)
_builder.add_edge(START, "analyze")
_builder.add_edge("analyze", END)
graph = _builder.compile()
