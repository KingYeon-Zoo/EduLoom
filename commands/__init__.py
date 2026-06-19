"""Surreal-commands integration for Open Notebook"""

# Register Doubao Esperanto providers at import time. The surreal-commands worker
# loads this package via `--import-modules commands` but never runs the API
# startup hook, so without this any LLM-backed command (extract_profile, etc.)
# would fail with "Provider 'doubao' not supported". Registration is idempotent.
try:
    from edu_loom.ai.doubao.register import register_doubao_providers

    register_doubao_providers()
except Exception as _e:  # noqa: BLE001 - never block command import
    from loguru import logger

    logger.warning(f"Doubao provider registration skipped in worker: {_e}")

from .embedding_commands import (
    embed_insight_command,
    embed_note_command,
    embed_source_command,
    rebuild_embeddings_command,
)
from .doubao_commands import generate_doubao_video_command
from .example_commands import analyze_data_command, process_text_command
from .learning_commands import (
    generate_assessment_command,
    generate_path_command,
)
from .podcast_commands import generate_podcast_command
from .profile_commands import extract_profile_command
from .source_commands import process_source_command
from .studio_commands import (
    generate_mindmap_command,
    generate_ppt_command,
    generate_quiz_command,
    generate_report_command,
    generate_video_command,
)

__all__ = [
    # Embedding commands
    "embed_note_command",
    "embed_insight_command",
    "embed_source_command",
    "rebuild_embeddings_command",
    # Other commands
    "generate_podcast_command",
    "generate_doubao_video_command",
    "process_source_command",
    "process_text_command",
    "analyze_data_command",
    "extract_profile_command",
    # Studio commands (Project C)
    "generate_report_command",
    "generate_quiz_command",
    "generate_mindmap_command",
    "generate_ppt_command",
    "generate_video_command",
    # Learning loop commands (Projects D / E)
    "generate_path_command",
    "generate_assessment_command",
]
