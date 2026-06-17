"""Doubao integration smoke test (manual, requires real credentials).

Runs real Doubao generation for all three capabilities and writes the
artifacts under data/doubao/smoke/. This is NOT part of the pytest suite —
it costs money and takes time. Run it manually after configuring .env:

    .venv/bin/python scripts/doubao_smoke_test.py

Expected result: three files appear under data/doubao/smoke/
  - image.png  (Seedream)
  - speech.mp3 (Doubao TTS)
  - video.mp4  (Seedance)
"""

import sys
from pathlib import Path

import httpx
from dotenv import load_dotenv
from loguru import logger

load_dotenv()

from open_notebook.ai.doubao import (
    DoubaoImageClient,
    DoubaoTTSClient,
    DoubaoVideoClient,
)
from open_notebook.config import DATA_FOLDER

OUT = Path(f"{DATA_FOLDER}/doubao/smoke")


def _download(url: str, dest: Path) -> None:
    dest.parent.mkdir(parents=True, exist_ok=True)
    resp = httpx.get(url, timeout=120.0, follow_redirects=True)
    resp.raise_for_status()
    dest.write_bytes(resp.content)


def run_image() -> None:
    logger.info("=== Image (Seedream) ===")
    client = DoubaoImageClient()
    result = client.generate(
        "一张简洁的计算机科学课程封面插画,扁平风格", size="2048x2048"
    )
    if result.url:
        _download(result.url, OUT / "image.png")
        logger.info(f"Image saved: {OUT / 'image.png'}")
    else:
        logger.warning("Image returned no URL")


def run_tts() -> None:
    logger.info("=== TTS (Doubao) ===")
    client = DoubaoTTSClient()
    result = client.synthesize("欢迎使用个性化学习智能体系统。")
    dest = OUT / "speech.mp3"
    dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_bytes(result.audio)
    logger.info(f"Speech saved: {dest}")


def run_video() -> None:
    logger.info("=== Video (Seedance) ===")
    client = DoubaoVideoClient()
    task_id = client.create_task(
        "一段展示二叉树遍历过程的教学动画,简洁清晰", ratio="16:9", duration=5
    )
    logger.info(f"Task submitted: {task_id}, waiting...")
    result = client.wait(task_id, max_wait_seconds=600)
    if result.video_url:
        _download(result.video_url, OUT / "video.mp4")
        logger.info(f"Video saved: {OUT / 'video.mp4'}")
    else:
        logger.warning("Video returned no URL")


def main() -> int:
    steps = {"image": run_image, "tts": run_tts, "video": run_video}
    # Allow running a subset: python scripts/doubao_smoke_test.py image tts
    selected = sys.argv[1:] or list(steps)
    failures = []
    for name in selected:
        fn = steps.get(name)
        if not fn:
            logger.error(f"Unknown step: {name} (choose from {list(steps)})")
            failures.append(name)
            continue
        try:
            fn()
        except Exception as e:
            logger.error(f"Step '{name}' failed: {e}")
            failures.append(name)
    if failures:
        logger.error(f"Smoke test FAILED for: {failures}")
        return 1
    logger.info(f"Smoke test passed. Artifacts in {OUT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
