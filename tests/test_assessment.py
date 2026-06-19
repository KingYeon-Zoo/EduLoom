"""Unit tests for the assessment graph (Project E).

Mocks the LLM provisioning so no real credentials/network are needed; verifies
multi-dimension parsing, invalid-dimension filtering, score clamping, and that
malformed JSON surfaces as ValueError (permanent failure).
"""

import json
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from edu_loom.graphs.assessment import analyze, graph


def _mock_model(payload: str):
    """Build a mock chain whose ainvoke returns an AIMessage-like object."""
    model = MagicMock()
    msg = MagicMock()
    msg.content = payload
    model.ainvoke = AsyncMock(return_value=msg)
    return model


@pytest.mark.asyncio
async def test_analyze_parses_dimensions():
    payload = json.dumps(
        {
            "dimensions": [
                {
                    "name": "knowledge_mastery",
                    "score": 80,
                    "comment": "掌握良好",
                    "evidence": "练习正确率高",
                },
                {
                    "name": "quiz_performance",
                    "score": 120,  # should clamp to 100
                    "comment": "表现优秀",
                    "evidence": "测试满分",
                },
                {
                    "name": "not_a_real_dimension",  # filtered out
                    "score": 50,
                    "comment": "x",
                    "evidence": "y",
                },
            ],
            "suggestions": ["多做综合题"],
            "overall_comment": "总体不错",
        }
    )
    with patch(
        "edu_loom.graphs.assessment.provision_langchain_model",
        new=AsyncMock(return_value=_mock_model(payload)),
    ):
        result = await analyze(
            {"profile_summary": "p", "path_progress": "", "quiz_content": "q"}
        )

    dims = result["dimensions"]
    assert len(dims) == 2  # invalid dimension filtered
    names = {d["name"] for d in dims}
    assert names == {"knowledge_mastery", "quiz_performance"}
    quiz = next(d for d in dims if d["name"] == "quiz_performance")
    assert quiz["score"] == 100  # clamped
    assert quiz["label"] == "练习表现"
    assert result["suggestions"] == ["多做综合题"]
    assert result["overall_comment"] == "总体不错"


@pytest.mark.asyncio
async def test_analyze_malformed_json_raises_value_error():
    with patch(
        "edu_loom.graphs.assessment.provision_langchain_model",
        new=AsyncMock(return_value=_mock_model("not json at all")),
    ):
        with pytest.raises(ValueError):
            await analyze(
                {"profile_summary": "", "path_progress": "", "quiz_content": ""}
            )


def test_graph_has_analyze_node():
    nodes = set(graph.get_graph().nodes.keys())
    assert "analyze" in nodes
