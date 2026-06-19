"""API tests for learning loop endpoints (Projects D / E).

Mocks the service layer so no live SurrealDB / command queue is required.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from api.main import app

    return TestClient(app)


def _fake_path():
    p = MagicMock()
    p.id = "learning_path:1"
    p.name = "课程 · 学习路径"
    p.notebook_id = "notebook:abc"
    p.summary = "概述"
    p.steps = [
        {
            "title": "入门",
            "description": "基础",
            "order": 0,
            "status": "todo",
            "objectives": ["了解概念"],
            "recommended_artifacts": [],
            "resource_gap": None,
            "gap_resource_type": None,
        }
    ]
    p.profile_snapshot = {}
    p.command = None
    p.created = "2026-06-19T00:00:00"
    p.updated = "2026-06-19T00:00:00"
    return p


class TestLearningPathAPI:
    @patch("api.routers.learning.LearningService.get_path", new_callable=AsyncMock)
    def test_get_path_returns_steps(self, mock_get, client):
        mock_get.return_value = _fake_path()
        resp = client.get("/api/learning/path", params={"notebook_id": "notebook:abc"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] == "learning_path:1"
        assert len(data["steps"]) == 1
        assert data["steps"][0]["title"] == "入门"

    @patch("api.routers.learning.LearningService.get_path", new_callable=AsyncMock)
    def test_get_path_null_when_none(self, mock_get, client):
        mock_get.return_value = None
        resp = client.get("/api/learning/path", params={"notebook_id": "notebook:abc"})
        assert resp.status_code == 200
        assert resp.json() is None

    @patch(
        "api.routers.learning.LearningService.submit_path_generation",
        new_callable=AsyncMock,
    )
    def test_generate_path_returns_job_id(self, mock_submit, client):
        mock_submit.return_value = {"job_id": "command:job1"}
        resp = client.post(
            "/api/learning/path/generate", json={"notebook_id": "notebook:abc"}
        )
        assert resp.status_code == 200
        assert resp.json()["job_id"] == "command:job1"

    @patch(
        "api.routers.learning.LearningService.update_step_status",
        new_callable=AsyncMock,
    )
    def test_update_step(self, mock_update, client):
        path = _fake_path()
        path.steps[0]["status"] = "done"
        mock_update.return_value = path
        resp = client.patch(
            "/api/learning/path/steps",
            json={"notebook_id": "notebook:abc", "order": 0, "status": "done"},
        )
        assert resp.status_code == 200
        assert resp.json()["steps"][0]["status"] == "done"


class TestLearningAssessmentAPI:
    @patch(
        "api.routers.learning.LearningService.get_assessments", new_callable=AsyncMock
    )
    def test_get_assessments(self, mock_get, client):
        a = MagicMock()
        a.id = "learning_assessment:1"
        a.notebook_id = "notebook:abc"
        a.dimensions = [
            {
                "name": "knowledge_mastery",
                "label": "知识掌握",
                "score": 80,
                "comment": "good",
                "evidence": "e",
            }
        ]
        a.overall_comment = "ok"
        a.suggestions = ["s1"]
        a.created = "2026-06-19T00:00:00"
        mock_get.return_value = [a]
        resp = client.get(
            "/api/learning/assessments", params={"notebook_id": "notebook:abc"}
        )
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 1
        assert data[0]["dimensions"][0]["score"] == 80

    @patch(
        "api.routers.learning.LearningService.submit_assessment", new_callable=AsyncMock
    )
    def test_generate_assessment_returns_job_id(self, mock_submit, client):
        mock_submit.return_value = {"job_id": "command:job2"}
        resp = client.post(
            "/api/learning/assessment/generate", json={"notebook_id": "notebook:abc"}
        )
        assert resp.status_code == 200
        assert resp.json()["job_id"] == "command:job2"


class TestAgentRosterAPI:
    def test_get_agents(self, client):
        resp = client.get("/api/learning/agents")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 5
        keys = {a["key"] for a in data}
        assert "path_planner" in keys
        assert "assessment_analyst" in keys
        # each has required fields
        for a in data:
            assert a["name"] and a["project"] and a["responsibility"]
