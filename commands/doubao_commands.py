"""Async commands for Doubao generation that run in the worker process.

Video generation can take minutes, so it runs as a surreal-command (same
mechanism as podcasts): the command submits the Ark task, polls to completion,
downloads the result to ``data/doubao/<task_id>/`` and returns the local path.
Image generation is synchronous and does not need a command — callers use
DoubaoImageClient directly.
"""

import time
from pathlib import Path
from typing import Optional

import httpx
from loguru import logger
from surreal_commands import CommandInput, CommandOutput, command

from open_notebook.ai.doubao import DoubaoVideoClient
from open_notebook.config import DATA_FOLDER

_DOWNLOAD_TIMEOUT = 120.0


def _download(url: str, dest: Path) -> None:
    """Stream a remote file to ``dest``."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with httpx.stream("GET", url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_bytes():
                f.write(chunk)


class DoubaoVideoInput(CommandInput):
    prompt: str
    resolution: Optional[str] = None
    ratio: Optional[str] = None
    duration: Optional[int] = None
    max_wait_seconds: float = 600.0


class DoubaoVideoOutput(CommandOutput):
    success: bool
    task_id: Optional[str] = None
    video_url: Optional[str] = None
    video_file_path: Optional[str] = None
    processing_time: float = 0.0
    error_message: Optional[str] = None


@command("generate_doubao_video", app="open_notebook", retry={"max_attempts": 1})
async def generate_doubao_video_command(
    input_data: DoubaoVideoInput,
) -> DoubaoVideoOutput:
    """Submit a Doubao video task, wait for it, download the result."""
    start = time.time()
    try:
        client = DoubaoVideoClient()
        task_id = client.create_task(
            input_data.prompt,
            resolution=input_data.resolution,
            ratio=input_data.ratio,
            duration=input_data.duration,
        )
        result = client.wait(task_id, max_wait_seconds=input_data.max_wait_seconds)

        video_path: Optional[str] = None
        if result.video_url:
            dest = Path(f"{DATA_FOLDER}/doubao/{task_id}/video.mp4")
            _download(result.video_url, dest)
            video_path = str(dest)

        logger.info(f"Doubao video done: {task_id} -> {video_path}")
        return DoubaoVideoOutput(
            success=True,
            task_id=task_id,
            video_url=result.video_url,
            video_file_path=video_path,
            processing_time=time.time() - start,
        )
    except Exception as e:
        logger.error(f"Doubao video command failed: {e}")
        return DoubaoVideoOutput(
            success=False,
            processing_time=time.time() - start,
            error_message=str(e),
        )
