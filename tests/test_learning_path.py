"""Unit tests for the learning loop domain models (Projects D / E).

Pure model-level validation (no DB), mirroring tests/test_studio.py style.
"""

import pytest

from edu_loom.domain.learning_path import (
    ASSESSMENT_DIMENSIONS,
    STEP_STATUSES,
    AssessmentDimension,
    LearningAssessment,
    LearningPath,
    PathStep,
)


class TestPathStep:
    def test_defaults(self):
        s = PathStep(title="入门")
        assert s.order == 0
        assert s.status == "todo"
        assert s.objectives == []
        assert s.recommended_artifacts == []
        assert s.resource_gap is None

    def test_invalid_status_coerced_to_todo(self):
        s = PathStep(title="x", status="bogus")
        assert s.status == "todo"

    @pytest.mark.parametrize("status", STEP_STATUSES)
    def test_valid_statuses_kept(self, status):
        s = PathStep(title="x", status=status)
        assert s.status == status


class TestAssessmentDimension:
    def test_score_clamped_high(self):
        d = AssessmentDimension(name="knowledge_mastery", score=150)
        assert d.score == 100

    def test_score_clamped_low(self):
        d = AssessmentDimension(name="knowledge_mastery", score=-5)
        assert d.score == 0

    def test_score_non_numeric_defaults_zero(self):
        d = AssessmentDimension(name="knowledge_mastery", score="N/A")  # type: ignore[arg-type]
        assert d.score == 0


class TestLearningPath:
    def test_table_name(self):
        assert LearningPath.table_name == "learning_path"

    def test_command_none_by_default(self):
        p = LearningPath(name="p", notebook_id="notebook:abc")
        assert p.command is None

    def test_notebook_id_surfaced_as_string(self):
        from surrealdb import RecordID

        p = LearningPath(name="p", notebook_id=RecordID("notebook", "abc"))
        assert isinstance(p.notebook_id, str)
        assert p.notebook_id == "notebook:abc"

    def test_prepare_save_coerces_record_refs(self):
        p = LearningPath(
            name="p", notebook_id="notebook:abc", command="command:job1"
        )
        data = p._prepare_save_data()
        from surrealdb import RecordID

        assert isinstance(data["notebook_id"], RecordID)
        assert isinstance(data["command"], RecordID)

    def test_steps_roundtrip_as_dicts(self):
        step = PathStep(title="t", order=0, objectives=["o1"]).model_dump()
        p = LearningPath(name="p", notebook_id="notebook:abc", steps=[step])
        assert p.steps[0]["title"] == "t"
        assert p.steps[0]["objectives"] == ["o1"]


class TestLearningAssessment:
    def test_table_name(self):
        assert LearningAssessment.table_name == "learning_assessment"

    def test_dimensions_default_empty(self):
        a = LearningAssessment(notebook_id="notebook:abc")
        assert a.dimensions == []
        assert a.suggestions == []

    def test_assessment_dimensions_constant_has_six(self):
        assert len(ASSESSMENT_DIMENSIONS) == 6
