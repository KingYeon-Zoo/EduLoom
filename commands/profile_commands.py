"""Background command for learner-profile extraction (Project B).

Fire-and-forget: invoked after each chat turn so the profile refreshes
continuously (随学随新) with zero added latency on the chat hot path.
"""

import time
from typing import Optional

from loguru import logger
from surreal_commands import CommandInput, CommandOutput, command

from edu_loom.domain.learner_profile import LearnerProfile
from edu_loom.graphs.profile_extraction import graph as profile_graph
from open_notebook.exceptions import ConfigurationError


class ExtractProfileInput(CommandInput):
    """Input for a learner-profile extraction run."""

    conversation: str  # recent conversation window text
    session_id: str = "unknown"  # chat session id, used as provenance


class ExtractProfileOutput(CommandOutput):
    """Output from the extraction command."""

    success: bool
    changes: dict = {}  # per-dimension {added, updated, deleted}
    processing_time: float
    error_message: Optional[str] = None


@command(
    "extract_profile",
    app="open_notebook",
    retry={
        "max_attempts": 5,
        "wait_strategy": "exponential_jitter",
        "wait_min": 1,
        "wait_max": 60,
        # Permanent failures: malformed LLM JSON (ValueError) and config errors.
        "stop_on": [ValueError, ConfigurationError],
        "retry_log_level": "debug",
    },
)
async def extract_profile_command(
    input_data: ExtractProfileInput,
) -> ExtractProfileOutput:
    """Run extract+reconcile over a conversation window and persist the profile.

    Retry strategy mirrors embedding_commands: retry transient failures with
    exponential jitter; never retry ValueError (bad LLM output) — skip the round
    so a single bad extraction can't poison the profile or spin forever.
    """
    start_time = time.time()

    try:
        if not input_data.conversation or not input_data.conversation.strip():
            raise ValueError("conversation is empty - nothing to extract")

        profile = await LearnerProfile.get_instance()
        result = await profile_graph.ainvoke(
            {
                "conversation": input_data.conversation,
                "session_id": input_data.session_id,
                "profile": profile,
            }
        )

        processing_time = time.time() - start_time
        changes = result.get("changes", {}) or {}
        logger.info(
            f"extract_profile completed in {processing_time:.2f}s; changes={changes}"
        )
        return ExtractProfileOutput(
            success=True,
            changes=changes,
            processing_time=processing_time,
        )

    except ValueError as e:
        # Permanent failure - don't retry, leave profile untouched.
        processing_time = time.time() - start_time
        logger.error(f"extract_profile permanent failure: {e}")
        return ExtractProfileOutput(
            success=False,
            processing_time=processing_time,
            error_message=str(e),
        )
    except Exception as e:
        # Transient failure - surreal-commands will retry.
        logger.debug(f"extract_profile transient error: {e}")
        raise
