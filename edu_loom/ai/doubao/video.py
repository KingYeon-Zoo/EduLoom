"""Doubao video generation client (Seedance, via Ark content-generation tasks).

Video generation is asynchronous: you submit a task, then poll until it
reaches a terminal state. This client is stateless and does not touch the
database — long-running polling belongs in the command/worker layer. Use
:meth:`create_task` + :meth:`poll` for caller-controlled polling, or
:meth:`wait` for a simple blocking helper (tests / scripts).
"""

import time
from dataclasses import dataclass

from loguru import logger

from open_notebook.ai.doubao.client import build_ark_client
from open_notebook.ai.doubao.config import DoubaoConfig, get_config
from open_notebook.ai.doubao.exceptions import DoubaoTaskFailed, DoubaoTimeout

# Terminal states reported by Ark for content-generation tasks.
_SUCCEEDED = "succeeded"
_TERMINAL = {"succeeded", "failed", "cancelled"}


@dataclass
class VideoResult:
    """Outcome of a completed video task."""

    task_id: str
    status: str
    video_url: str | None
    raw: object  # the SDK task object, for callers needing extra fields


class DoubaoVideoClient:
    """Thin wrapper over Ark content-generation tasks for text-to-video."""

    def __init__(self, config: DoubaoConfig | None = None):
        self._config = config or get_config()
        self._client = build_ark_client(self._config)

    def create_task(
        self,
        prompt: str,
        *,
        resolution: str | None = None,
        ratio: str | None = None,
        duration: int | None = None,
        model: str | None = None,
    ) -> str:
        """Submit a text-to-video task and return its Ark task id."""
        model = model or self._config.require_video_model()
        content = [{"type": "text", "text": prompt}]
        kwargs: dict = {"model": model, "content": content}
        if resolution is not None:
            kwargs["resolution"] = resolution
        if ratio is not None:
            kwargs["ratio"] = ratio
        if duration is not None:
            kwargs["duration"] = duration

        logger.info(f"Submitting Doubao video task (model={model}, ratio={ratio})")
        task = self._client.content_generation.tasks.create(**kwargs)
        logger.info(f"Doubao video task submitted: {task.id}")
        return task.id

    def poll(self, task_id: str) -> VideoResult:
        """Fetch current task state once. Does not block."""
        task = self._client.content_generation.tasks.get(task_id)
        video_url = None
        content = getattr(task, "content", None)
        if content is not None:
            video_url = getattr(content, "video_url", None)
        return VideoResult(
            task_id=task_id,
            status=task.status,
            video_url=video_url,
            raw=task,
        )

    def wait(
        self,
        task_id: str,
        *,
        poll_interval: float = 5.0,
        max_wait_seconds: float = 600.0,
    ) -> VideoResult:
        """Block until the task reaches a terminal state.

        Raises DoubaoTaskFailed on failure/cancel, DoubaoTimeout on timeout.
        """
        start = time.time()
        while True:
            result = self.poll(task_id)
            if result.status in _TERMINAL:
                if result.status != _SUCCEEDED:
                    err = getattr(result.raw, "error", None)
                    code = getattr(err, "code", None)
                    raise DoubaoTaskFailed(
                        f"Doubao video task {task_id} ended as '{result.status}'"
                        + (f": {code}" if code else ""),
                        task_id=task_id,
                        code=code,
                    )
                return result
            if time.time() - start > max_wait_seconds:
                raise DoubaoTimeout(
                    f"Doubao video task {task_id} not done after "
                    f"{max_wait_seconds}s (last status: {result.status})",
                    task_id=task_id,
                )
            time.sleep(poll_interval)
