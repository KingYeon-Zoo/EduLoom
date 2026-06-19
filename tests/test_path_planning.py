"""Unit tests for the path-planning graph (Project D).

Focus on the pure resource-pushing logic (apply_push_decisions), which is DB-
and LLM-free, plus a sanity check the graph has the two expected nodes.
"""

from edu_loom.graphs.path_planning import (
    PushDecision,
    apply_push_decisions,
    graph,
)


def _steps():
    return [
        {
            "order": 0,
            "title": "t0",
            "recommended_artifacts": [],
            "resource_gap": None,
            "gap_resource_type": None,
        },
        {
            "order": 1,
            "title": "t1",
            "recommended_artifacts": [],
            "resource_gap": None,
            "gap_resource_type": None,
        },
    ]


class TestApplyPushDecisions:
    def test_keeps_only_valid_artifact_ids(self):
        steps = _steps()
        decisions = [
            PushDecision(
                order=0,
                recommended_artifact_ids=["studio_artifact:real", "studio_artifact:fake"],
            )
        ]
        out = apply_push_decisions(steps, decisions, {"studio_artifact:real"})
        assert out[0]["recommended_artifacts"] == ["studio_artifact:real"]
        # Has a real resource -> gap cleared.
        assert out[0]["resource_gap"] is None
        assert out[0]["gap_resource_type"] is None

    def test_marks_gap_when_no_valid_resource(self):
        steps = _steps()
        decisions = [
            PushDecision(
                order=1,
                recommended_artifact_ids=["studio_artifact:fake"],
                resource_gap="需要一个视频讲解",
                gap_resource_type="video",
                gap_prompt="用动画演示概念",
            )
        ]
        out = apply_push_decisions(steps, decisions, {"studio_artifact:real"})
        assert out[1]["recommended_artifacts"] == []
        assert out[1]["resource_gap"] == "需要一个视频讲解"
        assert out[1]["gap_resource_type"] == "video"
        assert out[1]["gap_prompt"] == "用动画演示概念"

    def test_invalid_gap_type_dropped(self):
        steps = _steps()
        decisions = [
            PushDecision(
                order=0,
                recommended_artifact_ids=[],
                resource_gap="something",
                gap_resource_type="hologram",  # not a valid resource type
            )
        ]
        out = apply_push_decisions(steps, decisions, set())
        assert out[0]["gap_resource_type"] is None

    def test_unknown_order_ignored(self):
        steps = _steps()
        decisions = [PushDecision(order=99, recommended_artifact_ids=["studio_artifact:real"])]
        out = apply_push_decisions(steps, decisions, {"studio_artifact:real"})
        # Nothing changed on the real steps.
        assert out[0]["recommended_artifacts"] == []
        assert out[1]["recommended_artifacts"] == []


def test_graph_has_plan_and_push_nodes():
    nodes = set(graph.get_graph().nodes.keys())
    assert "plan" in nodes
    assert "push" in nodes
