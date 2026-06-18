"""API tests for learner-profile endpoints (Project B).

Mocks the service layer so no live SurrealDB is required.
"""

from unittest.mock import AsyncMock, patch

import pytest
from fastapi.testclient import TestClient


@pytest.fixture
def client():
    from api.main import app

    return TestClient(app)


_SAMPLE = {
    "knowledge_base": [
        {
            "content": "熟悉 Python 基础",
            "confidence": 0.8,
            "provenance": "session:1",
            "created": "2026-06-18T00:00:00",
            "updated": "2026-06-18T00:00:00",
        }
    ],
    "cognitive_style": [],
    "error_prone": [],
    "learning_goals": [],
    "learning_progress": [],
    "learning_interests": [],
}


class TestLearnerProfileAPI:
    @patch("api.routers.learner_profile.service.get_profile", new_callable=AsyncMock)
    def test_get_returns_dimensions_and_labels(self, mock_get, client):
        mock_get.return_value = _SAMPLE
        resp = client.get("/api/learner-profile")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data["dimensions"]) == 6
        assert data["labels"]["cognitive_style"] == "认知风格"
        assert data["dimensions"]["knowledge_base"][0]["content"] == "熟悉 Python 基础"

    @patch("api.routers.learner_profile.service.update_profile", new_callable=AsyncMock)
    def test_put_updates_dimension(self, mock_update, client):
        mock_update.return_value = _SAMPLE
        resp = client.put(
            "/api/learner-profile",
            json={
                "dimensions": {
                    "knowledge_base": [
                        {"content": "熟悉 Python 基础", "confidence": 0.8}
                    ]
                }
            },
        )
        assert resp.status_code == 200
        mock_update.assert_awaited_once()
        assert resp.json()["dimensions"]["knowledge_base"][0]["confidence"] == 0.8

    @patch("api.routers.learner_profile.service.submit_extraction")
    def test_post_extract_returns_command_id(self, mock_submit, client):
        mock_submit.return_value = "command:xyz789"
        resp = client.post(
            "/api/learner-profile/extract",
            json={"conversation": "学生说他不懂递归", "session_id": "manual"},
        )
        assert resp.status_code == 200
        assert resp.json()["command_id"] == "command:xyz789"

    @patch("api.routers.learner_profile.service.reset_profile", new_callable=AsyncMock)
    def test_delete_resets_profile(self, mock_reset, client):
        empty = {k: [] for k in _SAMPLE}
        mock_reset.return_value = empty
        resp = client.delete("/api/learner-profile")
        assert resp.status_code == 200
        assert all(v == [] for v in resp.json()["dimensions"].values())
