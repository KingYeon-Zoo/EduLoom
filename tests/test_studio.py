"""Unit tests for studio resource generation (Project C).

These mock the LLM provisioning, Doubao clients, file download, and artifact
persistence so they run without real credentials, network, or a database.
End-to-end generation is verified manually via the smoke test.
"""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

import commands.studio_commands as sc
from commands.studio_commands import (
    StudioGenerationInput,
    _parse_prompt_list,
    _strip_code_fence,
)
from open_notebook.domain.studio_profile import RESOURCE_TYPES


# --- pure helpers ---------------------------------------------------------


def test_strip_code_fence_removes_fence():
    text = "```mermaid\nmindmap\n  root\n```"
    assert _strip_code_fence(text) == "mindmap\n  root"


def test_strip_code_fence_noop_without_fence():
    text = "graph TD\n  A --> B"
    assert _strip_code_fence(text) == text


def test_parse_prompt_list_json_array():
    raw = '["a clean diagram", "a flowchart", "a chart", "extra"]'
    prompts = _parse_prompt_list(raw, limit=2)
    assert prompts == ["a clean diagram", "a flowchart"]


def test_parse_prompt_list_tolerates_fence():
    raw = '```json\n["one", "two"]\n```'
    assert _parse_prompt_list(raw, limit=4) == ["one", "two"]


def test_parse_prompt_list_line_fallback():
    raw = "- first prompt\n- second prompt"
    prompts = _parse_prompt_list(raw, limit=4)
    assert prompts == ["first prompt", "second prompt"]


def test_parse_prompt_list_empty_raises():
    with pytest.raises(ValueError):
        _parse_prompt_list("   ", limit=4)


def test_command_by_type_covers_all_resource_types():
    from api.studio_service import COMMAND_BY_TYPE

    assert set(COMMAND_BY_TYPE.keys()) == set(RESOURCE_TYPES)


# --- helper to build a fake artifact --------------------------------------


def _fake_artifact():
    artifact = MagicMock()
    artifact.id = "studio_artifact:abc"
    artifact.content = None
    artifact.file_paths = []
    artifact.save = AsyncMock()
    return artifact


def _input(**overrides):
    base = dict(
        artifact_id="studio_artifact:abc",
        profile_name="测试预设",
        content="some source content",
        instructions=None,
        system_prompt="你是助手",
        config={},
    )
    base.update(overrides)
    return StudioGenerationInput(**base)


# --- report ---------------------------------------------------------------


@pytest.mark.asyncio
async def test_report_command_writes_markdown():
    artifact = _fake_artifact()
    with patch.object(
        sc.StudioArtifact, "get", AsyncMock(return_value=artifact)
    ), patch.object(sc, "_run_llm", AsyncMock(return_value="# 报告\n内容")):
        out = await sc.generate_report_command(_input())

    assert out.success is True
    assert artifact.content == "# 报告\n内容"
    artifact.save.assert_awaited()


# --- mindmap --------------------------------------------------------------


@pytest.mark.asyncio
async def test_mindmap_command_strips_fence():
    artifact = _fake_artifact()
    fenced = "```mermaid\nmindmap\n  root((主题))\n```"
    with patch.object(
        sc.StudioArtifact, "get", AsyncMock(return_value=artifact)
    ), patch.object(sc, "_run_llm", AsyncMock(return_value=fenced)):
        out = await sc.generate_mindmap_command(_input(system_prompt="导图"))

    assert out.success is True
    assert artifact.content == "mindmap\n  root((主题))"


# --- infographic ----------------------------------------------------------


@pytest.mark.asyncio
async def test_infographic_command_generates_images():
    artifact = _fake_artifact()
    fake_image_client = MagicMock()
    fake_image_client.generate.return_value = MagicMock(url="https://img/x.png")

    with patch.object(
        sc.StudioArtifact, "get", AsyncMock(return_value=artifact)
    ), patch.object(
        sc, "_run_llm", AsyncMock(return_value='["p1", "p2"]')
    ), patch(
        "open_notebook.ai.doubao.DoubaoImageClient", return_value=fake_image_client
    ), patch.object(sc, "_download") as mock_dl:
        out = await sc.generate_infographic_command(
            _input(config={"num_images": 2, "size": "1024x1024"})
        )

    assert out.success is True
    assert len(artifact.file_paths) == 2
    assert fake_image_client.generate.call_count == 2
    assert mock_dl.call_count == 2
    # image client called with the requested size
    _, kwargs = fake_image_client.generate.call_args
    assert kwargs["size"] == "1024x1024"


# --- video ----------------------------------------------------------------


@pytest.mark.asyncio
async def test_video_command_creates_and_downloads():
    artifact = _fake_artifact()
    fake_video_client = MagicMock()
    fake_video_client.create_task.return_value = "task-123"
    fake_video_client.wait.return_value = MagicMock(video_url="https://vid/x.mp4")

    with patch.object(
        sc.StudioArtifact, "get", AsyncMock(return_value=artifact)
    ), patch.object(
        sc, "_run_llm", AsyncMock(return_value="a teaching animation")
    ), patch(
        "open_notebook.ai.doubao.DoubaoVideoClient", return_value=fake_video_client
    ), patch.object(sc, "_download") as mock_dl:
        out = await sc.generate_video_command(
            _input(config={"ratio": "16:9", "duration": 5})
        )

    assert out.success is True
    assert len(artifact.file_paths) == 1
    fake_video_client.create_task.assert_called_once()
    _, kwargs = fake_video_client.create_task.call_args
    assert kwargs["ratio"] == "16:9"
    assert kwargs["duration"] == 5
    mock_dl.assert_called_once()
