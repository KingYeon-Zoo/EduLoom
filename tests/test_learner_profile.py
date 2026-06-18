"""Unit tests for the LearnerProfile domain model (Project B).

DB-free: covers ProfileEntry validation, the 6 fixed dimensions, and the
serialization/coercion round-trip used by update()/get_instance().
"""

import pytest
from pydantic import ValidationError

from edu_loom.domain.learner_profile import (
    PROFILE_DIMENSIONS,
    LearnerProfile,
    ProfileEntry,
)


class TestProfileEntry:
    def test_valid_entry_gets_timestamps(self):
        e = ProfileEntry(content="熟悉 Python 基础", confidence=0.8)
        assert e.content == "熟悉 Python 基础"
        assert e.confidence == 0.8
        assert e.provenance == "unknown"
        assert e.created and e.updated  # auto-filled ISO strings

    def test_confidence_out_of_range_rejected(self):
        with pytest.raises(ValidationError):
            ProfileEntry(content="x", confidence=1.5)
        with pytest.raises(ValidationError):
            ProfileEntry(content="x", confidence=-0.1)

    def test_empty_content_rejected(self):
        with pytest.raises(ValidationError):
            ProfileEntry(content="   ", confidence=0.5)

    def test_none_timestamps_filled(self):
        # API manual edits send created/updated as None; must be auto-filled.
        e = ProfileEntry(
            content="x", confidence=0.5, provenance=None, created=None, updated=None
        )
        assert e.created and e.updated
        assert e.provenance == "unknown"


class TestLearnerProfileModel:
    def teardown_method(self):
        LearnerProfile.clear_instance()

    def test_has_six_dimensions(self):
        assert len(PROFILE_DIMENSIONS) == 6
        profile = LearnerProfile()
        for dim in PROFILE_DIMENSIONS:
            assert hasattr(profile, dim)
            assert getattr(profile, dim) == []

    def test_cognitive_style_is_a_dimension(self):
        # Kept as a dimension (rubric) but evidence-driven, not VARK.
        assert "cognitive_style" in PROFILE_DIMENSIONS

    def test_coerce_entries_rebuilds_from_dicts(self):
        profile = LearnerProfile()
        # Simulate what _load_from_db does: raw dicts via object.__setattr__
        object.__setattr__(
            profile,
            "knowledge_base",
            [{"content": "知道 for 循环", "confidence": 0.7, "provenance": "s1"}],
        )
        profile._coerce_entries()
        entries = profile.knowledge_base
        assert len(entries) == 1
        assert isinstance(entries[0], ProfileEntry)
        assert entries[0].content == "知道 for 循环"

    def test_coerce_entries_drops_malformed(self):
        profile = LearnerProfile()
        object.__setattr__(
            profile,
            "error_prone",
            [
                {"content": "ok", "confidence": 0.5},
                {"confidence": 0.5},  # missing content -> dropped
            ],
        )
        profile._coerce_entries()
        assert len(profile.error_prone) == 1
