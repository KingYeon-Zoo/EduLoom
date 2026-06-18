"""Unit tests for the profile extraction/reconciliation engine (Project B).

Focus on the pure reconcile logic (apply_operations), which is DB- and LLM-free,
plus a sanity check that the graph is wired with the two expected nodes.
"""

from edu_loom.domain.learner_profile import LearnerProfile, ProfileEntry
from edu_loom.graphs.profile_extraction import (
    Operation,
    apply_operations,
    graph,
)


def _fresh_profile() -> LearnerProfile:
    LearnerProfile.clear_instance()
    p = LearnerProfile()
    return p


class TestApplyOperations:
    def teardown_method(self):
        LearnerProfile.clear_instance()

    def test_add_appends_entry(self):
        p = _fresh_profile()
        ops = [
            Operation(op="ADD", dimension="knowledge_base", content="会用列表推导式", confidence=0.8)
        ]
        changes = apply_operations(p, ops, "session:1")
        assert len(p.knowledge_base) == 1
        assert p.knowledge_base[0].content == "会用列表推导式"
        assert p.knowledge_base[0].provenance == "session:1"
        assert changes["knowledge_base"]["added"] == 1

    def test_update_replaces_and_keeps_created(self):
        p = _fresh_profile()
        p.knowledge_base = [
            ProfileEntry(content="旧事实", confidence=0.5, created="2020-01-01T00:00:00")
        ]
        ops = [
            Operation(
                op="UPDATE",
                dimension="knowledge_base",
                target_index=0,
                content="更精确的事实",
                confidence=0.9,
            )
        ]
        changes = apply_operations(p, ops, "session:2")
        assert p.knowledge_base[0].content == "更精确的事实"
        assert p.knowledge_base[0].confidence == 0.9
        assert p.knowledge_base[0].created == "2020-01-01T00:00:00"  # preserved
        assert changes["knowledge_base"]["updated"] == 1

    def test_delete_removes_entry(self):
        p = _fresh_profile()
        p.learning_goals = [
            ProfileEntry(content="目标A", confidence=0.5),
            ProfileEntry(content="目标B", confidence=0.5),
        ]
        ops = [Operation(op="DELETE", dimension="learning_goals", target_index=0)]
        changes = apply_operations(p, ops, "s")
        assert len(p.learning_goals) == 1
        assert p.learning_goals[0].content == "目标B"
        assert changes["learning_goals"]["deleted"] == 1

    def test_noop_changes_nothing(self):
        p = _fresh_profile()
        p.error_prone = [ProfileEntry(content="易混淆 == 和 is", confidence=0.6)]
        ops = [Operation(op="NOOP", dimension="error_prone")]
        apply_operations(p, ops, "s")
        assert len(p.error_prone) == 1

    def test_out_of_range_index_ignored(self):
        p = _fresh_profile()
        ops = [
            Operation(op="UPDATE", dimension="knowledge_base", target_index=5, content="x"),
            Operation(op="DELETE", dimension="knowledge_base", target_index=9),
        ]
        changes = apply_operations(p, ops, "s")
        assert len(p.knowledge_base) == 0
        assert changes["knowledge_base"] == {"added": 0, "updated": 0, "deleted": 0}

    def test_invalid_dimension_ignored(self):
        p = _fresh_profile()
        ops = [Operation(op="ADD", dimension="not_a_dim", content="x", confidence=0.5)]
        changes = apply_operations(p, ops, "s")
        assert "not_a_dim" not in changes

    def test_multiple_deletes_shift_correctly(self):
        p = _fresh_profile()
        p.learning_interests = [
            ProfileEntry(content=f"兴趣{i}", confidence=0.5) for i in range(4)
        ]
        ops = [
            Operation(op="DELETE", dimension="learning_interests", target_index=0),
            Operation(op="DELETE", dimension="learning_interests", target_index=2),
        ]
        apply_operations(p, ops, "s")
        # removed indices 0 and 2 from [0,1,2,3] -> [1,3]
        contents = [e.content for e in p.learning_interests]
        assert contents == ["兴趣1", "兴趣3"]


class TestGraphWiring:
    def test_graph_has_extract_and_reconcile_nodes(self):
        nodes = set(graph.get_graph().nodes.keys())
        assert "extract" in nodes
        assert "reconcile" in nodes
