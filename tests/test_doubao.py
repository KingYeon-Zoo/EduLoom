"""Unit tests for the Doubao integration layer.

These mock the Ark SDK / HTTP so they run without real credentials or network.
The integration smoke test (real generation) lives in
scripts/doubao_smoke_test.py and is run manually with real keys.
"""

import base64
from unittest.mock import MagicMock, patch

import pytest

from open_notebook.ai.doubao.config import DoubaoConfig
from open_notebook.ai.doubao.exceptions import (
    DoubaoConfigError,
    DoubaoError,
    DoubaoTaskFailed,
    DoubaoTimeout,
)


def _config(**overrides) -> DoubaoConfig:
    base = dict(
        ark_api_key="test-key",
        ark_base_url="https://ark.test/api/v3",
        video_model="seedance-test",
        image_model="seedream-test",
        embedding_model="embedding-test",
        llm_model="llm-test",
        tts_endpoint="https://tts.test/api/v3/tts/unidirectional",
        tts_resource_id="seed-tts-2.0",
        tts_speaker="zh_female_vv_uranus_bigtts",
        tts_api_key="tts-key",
        tts_app_id=None,
        tts_access_token=None,
    )
    base.update(overrides)
    return DoubaoConfig(**base)


# --- config ---------------------------------------------------------------


def test_config_from_env_treats_empty_as_unset(monkeypatch):
    monkeypatch.setenv("ARK_API_KEY", "   ")
    monkeypatch.delenv("DOUBAO_VIDEO_MODEL", raising=False)
    cfg = DoubaoConfig.from_env()
    assert cfg.ark_api_key is None
    assert cfg.video_model is None
    # base_url falls back to default
    assert cfg.ark_base_url.startswith("https://ark")


def test_require_ark_raises_when_unset():
    with pytest.raises(DoubaoConfigError):
        _config(ark_api_key=None).require_ark()


def test_require_tts_reports_missing_auth():
    cfg = _config(tts_api_key=None, tts_app_id=None, tts_access_token=None)
    with pytest.raises(DoubaoConfigError):
        cfg.tts_auth_headers()


def test_tts_auth_prefers_api_key():
    headers = _config().tts_auth_headers()
    assert headers["X-Api-Key"] == "tts-key"
    assert headers["X-Api-Resource-Id"] == "seed-tts-2.0"


def test_tts_auth_falls_back_to_legacy():
    cfg = _config(tts_api_key=None, tts_app_id="app", tts_access_token="tok")
    headers = cfg.tts_auth_headers()
    assert headers["X-Api-App-Id"] == "app"
    assert headers["X-Api-Access-Key"] == "tok"
    assert "X-Api-Key" not in headers


# --- video ----------------------------------------------------------------


def _video_client(fake_ark):
    from open_notebook.ai.doubao.video import DoubaoVideoClient

    with patch(
        "open_notebook.ai.doubao.video.build_ark_client", return_value=fake_ark
    ):
        return DoubaoVideoClient(config=_config())


def test_video_create_task_builds_text_content():
    fake_ark = MagicMock()
    fake_ark.content_generation.tasks.create.return_value = MagicMock(id="task-1")
    client = _video_client(fake_ark)

    task_id = client.create_task("a cat", ratio="16:9", duration=5)

    assert task_id == "task-1"
    kwargs = fake_ark.content_generation.tasks.create.call_args.kwargs
    assert kwargs["model"] == "seedance-test"
    assert kwargs["content"] == [{"type": "text", "text": "a cat"}]
    assert kwargs["ratio"] == "16:9"
    assert kwargs["duration"] == 5


def test_video_wait_returns_on_success():
    fake_ark = MagicMock()
    done = MagicMock(status="succeeded", content=MagicMock(video_url="http://v/x.mp4"))
    fake_ark.content_generation.tasks.get.return_value = done
    client = _video_client(fake_ark)

    result = client.wait("task-1", poll_interval=0, max_wait_seconds=5)

    assert result.status == "succeeded"
    assert result.video_url == "http://v/x.mp4"


def test_video_wait_raises_on_failure():
    fake_ark = MagicMock()
    failed = MagicMock(status="failed", content=None, error=MagicMock(code="E123"))
    fake_ark.content_generation.tasks.get.return_value = failed
    client = _video_client(fake_ark)

    with pytest.raises(DoubaoTaskFailed) as exc:
        client.wait("task-1", poll_interval=0, max_wait_seconds=5)
    assert exc.value.task_id == "task-1"
    assert exc.value.code == "E123"


def test_video_wait_times_out():
    fake_ark = MagicMock()
    running = MagicMock(status="running", content=None)
    fake_ark.content_generation.tasks.get.return_value = running
    client = _video_client(fake_ark)

    with pytest.raises(DoubaoTimeout):
        client.wait("task-1", poll_interval=0, max_wait_seconds=-1)


# --- image ----------------------------------------------------------------


def test_image_generate_returns_url():
    from open_notebook.ai.doubao.image import DoubaoImageClient

    fake_ark = MagicMock()
    fake_ark.images.generate.return_value = MagicMock(
        data=[MagicMock(url="http://img/x.png", b64_json=None)]
    )
    with patch(
        "open_notebook.ai.doubao.image.build_ark_client", return_value=fake_ark
    ):
        client = DoubaoImageClient(config=_config())
        result = client.generate("a logo", size="1024x1024")

    assert result.url == "http://img/x.png"
    kwargs = fake_ark.images.generate.call_args.kwargs
    assert kwargs["model"] == "seedream-test"
    assert kwargs["prompt"] == "a logo"
    assert kwargs["size"] == "1024x1024"


# --- tts ------------------------------------------------------------------


def test_tts_synthesize_decodes_ndjson_audio():
    from open_notebook.ai.doubao.tts import DoubaoTTSClient

    chunk1 = base64.b64encode(b"\x00\x01").decode()
    chunk2 = base64.b64encode(b"fake-mp3").decode()
    body = "\n".join(
        [
            '{"code":0,"data":"' + chunk1 + '"}',
            '{"code":0,"data":"' + chunk2 + '"}',
            '{"code":20000000}',
        ]
    )
    fake_resp = MagicMock()
    fake_resp.text = body
    fake_resp.raise_for_status.return_value = None

    with patch("open_notebook.ai.doubao.tts.httpx.post", return_value=fake_resp):
        client = DoubaoTTSClient(config=_config())
        result = client.synthesize("你好")

    assert result.audio == b"\x00\x01fake-mp3"
    assert result.encoding == "mp3"


def test_tts_raises_on_error_line():
    from open_notebook.ai.doubao.tts import DoubaoTTSClient

    fake_resp = MagicMock()
    fake_resp.text = '{"code":40000001,"message":"bad request"}'
    fake_resp.raise_for_status.return_value = None

    with patch("open_notebook.ai.doubao.tts.httpx.post", return_value=fake_resp):
        client = DoubaoTTSClient(config=_config())
        with pytest.raises(DoubaoError):
            client.synthesize("你好")
