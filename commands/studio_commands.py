"""Async commands for studio resource generation (Project C).

Four independent generators, each a named "agent" run in the worker process
via surreal-commands (same mechanism as podcasts). Each command updates a
single ``StudioArtifact`` record and links it to its command job:

  * generate_report      — ReportWriter:        LLM -> markdown (artifact.content)
  * generate_mindmap     — MindMapArchitect:    LLM -> mermaid  (artifact.content)
  * generate_infographic — InfographicDesigner: LLM -> N prompts -> Doubao images
  * generate_video       — VideoDirector:       LLM -> prompt -> Doubao Seedance mp4

Text generation reuses ``provision_langchain_model`` (the same path as
transformations); image/video reuse the Doubao clients from Project A. Binary
outputs land under ``data/studio/<artifact_id>/``.
"""

import json
import time
from pathlib import Path
from typing import Any, Dict, List, Optional

import httpx
from langchain_core.messages import HumanMessage, SystemMessage
from loguru import logger
from surreal_commands import CommandInput, CommandOutput, command

from open_notebook.ai.provision import provision_langchain_model
from open_notebook.config import DATA_FOLDER
from open_notebook.domain.artifact import StudioArtifact
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.text_utils import extract_text_content

_DOWNLOAD_TIMEOUT = 180.0


def _download(url: str, dest: Path) -> None:
    """Stream a remote file to ``dest``."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    with httpx.stream(
        "GET", url, timeout=_DOWNLOAD_TIMEOUT, follow_redirects=True
    ) as resp:
        resp.raise_for_status()
        with open(dest, "wb") as f:
            for chunk in resp.iter_bytes():
                f.write(chunk)


def _artifact_dir(artifact_id: str) -> Path:
    """Filesystem-safe output dir for an artifact's binary products."""
    safe = str(artifact_id).replace(":", "_")
    return Path(f"{DATA_FOLDER}/studio/{safe}")


async def _run_llm(system_prompt: str, content: str, instructions: Optional[str]) -> str:
    """Run a single LLM completion and return cleaned text output."""
    sys_text = system_prompt
    if instructions:
        sys_text = f"{system_prompt}\n\n额外要求：{instructions}"
    payload = [
        SystemMessage(content=sys_text),
        HumanMessage(content=content or ""),
    ]
    chain = await provision_langchain_model(
        str(payload), None, "transformation", max_tokens=8192
    )
    response = await chain.ainvoke(payload)
    return clean_thinking_content(extract_text_content(response.content))


def _strip_code_fence(text: str) -> str:
    """Strip a leading/trailing ``` fence if the model added one."""
    t = text.strip()
    if t.startswith("```"):
        lines = t.splitlines()
        # drop first fence line (``` or ```lang)
        lines = lines[1:]
        # drop trailing fence line
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        t = "\n".join(lines).strip()
    return t


# --------------------------------------------------------------------------
# Shared I/O models
# --------------------------------------------------------------------------
class StudioGenerationInput(CommandInput):
    artifact_id: str
    profile_name: str
    content: str
    instructions: Optional[str] = None
    system_prompt: str
    config: Dict[str, Any] = {}


class StudioGenerationOutput(CommandOutput):
    success: bool
    artifact_id: Optional[str] = None
    processing_time: float = 0.0
    error_message: Optional[str] = None


async def _load_artifact(artifact_id: str) -> StudioArtifact:
    artifact = await StudioArtifact.get(artifact_id)
    if not artifact:
        raise ValueError(f"Studio artifact '{artifact_id}' not found")
    return artifact


# --------------------------------------------------------------------------
# ReportWriter — LLM markdown
# --------------------------------------------------------------------------
@command("generate_report", app="open_notebook", retry={"max_attempts": 1})
async def generate_report_command(
    input_data: StudioGenerationInput,
) -> StudioGenerationOutput:
    """ReportWriter agent: generate a markdown report."""
    start = time.time()
    try:
        artifact = await _load_artifact(input_data.artifact_id)
        markdown = await _run_llm(
            input_data.system_prompt, input_data.content, input_data.instructions
        )
        artifact.content = markdown
        await artifact.save()
        logger.info(f"ReportWriter done: {artifact.id}")
        return StudioGenerationOutput(
            success=True,
            artifact_id=str(artifact.id),
            processing_time=time.time() - start,
        )
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Report generation failed: {e}")
        logger.exception(e)
        raise RuntimeError(str(e)) from e


# --------------------------------------------------------------------------
# MindMapArchitect — LLM mermaid
# --------------------------------------------------------------------------
@command("generate_mindmap", app="open_notebook", retry={"max_attempts": 1})
async def generate_mindmap_command(
    input_data: StudioGenerationInput,
) -> StudioGenerationOutput:
    """MindMapArchitect agent: generate Mermaid mind-map text."""
    start = time.time()
    try:
        artifact = await _load_artifact(input_data.artifact_id)
        mermaid = await _run_llm(
            input_data.system_prompt, input_data.content, input_data.instructions
        )
        artifact.content = _strip_code_fence(mermaid)
        await artifact.save()
        logger.info(f"MindMapArchitect done: {artifact.id}")
        return StudioGenerationOutput(
            success=True,
            artifact_id=str(artifact.id),
            processing_time=time.time() - start,
        )
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Mindmap generation failed: {e}")
        logger.exception(e)
        raise RuntimeError(str(e)) from e


# --------------------------------------------------------------------------
# InfographicDesigner — LLM prompts -> Doubao images
# --------------------------------------------------------------------------
def _parse_prompt_list(raw: str, limit: int) -> List[str]:
    """Parse the LLM's JSON array of image prompts; tolerate stray fences."""
    text = _strip_code_fence(raw)
    prompts: List[str] = []
    try:
        parsed = json.loads(text)
        if isinstance(parsed, list):
            prompts = [str(p).strip() for p in parsed if str(p).strip()]
    except json.JSONDecodeError:
        # Fallback: treat each non-empty line as a prompt.
        prompts = [ln.strip("-• \t") for ln in text.splitlines() if ln.strip()]
    if not prompts:
        raise ValueError("LLM did not return any image prompts")
    return prompts[:limit]


@command("generate_infographic", app="open_notebook", retry={"max_attempts": 1})
async def generate_infographic_command(
    input_data: StudioGenerationInput,
) -> StudioGenerationOutput:
    """InfographicDesigner agent: LLM -> N prompts -> Doubao images."""
    from open_notebook.ai.doubao import DoubaoImageClient

    start = time.time()
    try:
        artifact = await _load_artifact(input_data.artifact_id)
        num_images = int(input_data.config.get("num_images", 4))
        size = input_data.config.get("size", "1024x1024")

        raw = await _run_llm(
            input_data.system_prompt, input_data.content, input_data.instructions
        )
        prompts = _parse_prompt_list(raw, num_images)

        client = DoubaoImageClient()
        out_dir = _artifact_dir(input_data.artifact_id)
        file_paths: List[str] = []
        for idx, prompt in enumerate(prompts):
            result = client.generate(prompt, size=size, response_format="url")
            if not result.url:
                logger.warning(f"Infographic image {idx} returned no URL, skipping")
                continue
            dest = out_dir / f"img_{idx}.png"
            _download(result.url, dest)
            file_paths.append(str(dest))

        if not file_paths:
            raise RuntimeError("No infographic images were generated")

        artifact.file_paths = file_paths
        await artifact.save()
        logger.info(f"InfographicDesigner done: {artifact.id} ({len(file_paths)} imgs)")
        return StudioGenerationOutput(
            success=True,
            artifact_id=str(artifact.id),
            processing_time=time.time() - start,
        )
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Infographic generation failed: {e}")
        logger.exception(e)
        raise RuntimeError(str(e)) from e


# --------------------------------------------------------------------------
# VideoDirector — LLM prompt -> Doubao Seedance mp4
# --------------------------------------------------------------------------
@command("generate_video", app="open_notebook", retry={"max_attempts": 1})
async def generate_video_command(
    input_data: StudioGenerationInput,
) -> StudioGenerationOutput:
    """VideoDirector agent: LLM video prompt -> Doubao Seedance mp4."""
    from open_notebook.ai.doubao import DoubaoVideoClient

    start = time.time()
    try:
        artifact = await _load_artifact(input_data.artifact_id)
        video_prompt = await _run_llm(
            input_data.system_prompt, input_data.content, input_data.instructions
        )
        video_prompt = _strip_code_fence(video_prompt)

        client = DoubaoVideoClient()
        task_id = client.create_task(
            video_prompt,
            resolution=input_data.config.get("resolution"),
            ratio=input_data.config.get("ratio"),
            duration=input_data.config.get("duration"),
        )
        result = client.wait(task_id, max_wait_seconds=600.0)

        if not result.video_url:
            raise RuntimeError("Doubao video task returned no video URL")

        dest = _artifact_dir(input_data.artifact_id) / "video.mp4"
        _download(result.video_url, dest)

        # Keep the generated script as content for reference / accessibility.
        artifact.content = video_prompt
        artifact.file_paths = [str(dest)]
        await artifact.save()
        logger.info(f"VideoDirector done: {artifact.id} -> {dest}")
        return StudioGenerationOutput(
            success=True,
            artifact_id=str(artifact.id),
            processing_time=time.time() - start,
        )
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"Video generation failed: {e}")
        logger.exception(e)
        raise RuntimeError(str(e)) from e


# Map resource_type -> command name, used by the service layer.
COMMAND_BY_TYPE = {
    "report": "generate_report",
    "mindmap": "generate_mindmap",
    "infographic": "generate_infographic",
    "video": "generate_video",
}
