import asyncio
import sqlite3
from typing import Annotated, Optional

from ai_prompter import Prompter
from langchain_core.messages import AIMessage, SystemMessage
from langchain_core.runnables import RunnableConfig
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from loguru import logger
from typing_extensions import TypedDict

from open_notebook.ai.provision import provision_langchain_model
from edu_loom.ai.doubao.esperanto_llm import normalize_reasoning_effort
from open_notebook.config import LANGGRAPH_CHECKPOINT_FILE
from open_notebook.domain.notebook import Notebook
from open_notebook.exceptions import OpenNotebookError
from open_notebook.utils import clean_thinking_content
from open_notebook.utils.error_classifier import classify_error
from open_notebook.utils.text_utils import extract_text_content


class ThreadState(TypedDict):
    messages: Annotated[list, add_messages]
    notebook: Optional[Notebook]
    context: Optional[str]
    context_config: Optional[dict]
    model_override: Optional[str]
    reasoning_effort: Optional[str]


def call_model_with_messages(state: ThreadState, config: RunnableConfig) -> dict:
    try:
        system_prompt = Prompter(prompt_template="chat/system").render(data=state)  # type: ignore[arg-type]
        payload = [SystemMessage(content=system_prompt)] + state.get("messages", [])
        model_id = config.get("configurable", {}).get("model_id") or state.get(
            "model_override"
        )
        reasoning_effort = normalize_reasoning_effort(
            config.get("configurable", {}).get("reasoning_effort")
            or state.get("reasoning_effort")
        )

        # Handle async model provisioning from sync context
        def run_in_new_loop():
            """Run the async function in a new event loop"""
            new_loop = asyncio.new_event_loop()
            try:
                asyncio.set_event_loop(new_loop)
                return new_loop.run_until_complete(
                    provision_langchain_model(
                        str(payload),
                        model_id,
                        "chat",
                        max_tokens=8192,
                        reasoning_effort=reasoning_effort,
                    )
                )
            finally:
                new_loop.close()
                asyncio.set_event_loop(None)

        try:
            # Try to get the current event loop
            asyncio.get_running_loop()
            # If we're in an event loop, run in a thread with a new loop
            import concurrent.futures

            with concurrent.futures.ThreadPoolExecutor() as executor:
                future = executor.submit(run_in_new_loop)
                model = future.result()
        except RuntimeError:
            # No event loop running, safe to use asyncio.run()
            model = asyncio.run(
                provision_langchain_model(
                    str(payload),
                    model_id,
                    "chat",
                    max_tokens=8192,
                    reasoning_effort=reasoning_effort,
                )
            )

        ai_message = model.invoke(payload)

        # Clean thinking content from AI response (e.g., <think>...</think> tags)
        content = extract_text_content(ai_message.content)
        cleaned_content = clean_thinking_content(content)
        cleaned_message = ai_message.model_copy(update={"content": cleaned_content})

        # Fire-and-forget: refresh the learner profile from this turn (Project B).
        # Never block or break the chat reply if submission fails.
        _submit_profile_extraction(state, config, cleaned_content)

        return {"messages": cleaned_message}
    except OpenNotebookError:
        raise
    except Exception as e:
        error_class, user_message = classify_error(e)
        raise error_class(user_message) from e


def _submit_profile_extraction(
    state: ThreadState, config: RunnableConfig, reply: str
) -> None:
    """Submit a background learner-profile extraction for the latest turn.

    Builds a small recent-conversation window (last few messages + this reply)
    and fires the `extract_profile` command. All failures are swallowed with a
    warning so the chat path is never affected.
    """
    try:
        from surreal_commands import submit_command

        session_id = (
            config.get("configurable", {}).get("thread_id")
            or config.get("configurable", {}).get("session_id")
            or "unknown"
        )

        # Build a recent window: last 6 prior messages + the new reply.
        lines = []
        for msg in state.get("messages", [])[-6:]:
            role = getattr(msg, "type", "user")
            text = extract_text_content(getattr(msg, "content", ""))
            if text and text.strip():
                lines.append(f"{role}: {text.strip()}")
        if reply and reply.strip():
            lines.append(f"ai: {reply.strip()}")
        conversation = "\n".join(lines)

        if not conversation.strip():
            return

        submit_command(
            "open_notebook",
            "extract_profile",
            {"conversation": conversation, "session_id": str(session_id)},
        )
    except Exception as e:  # noqa: BLE001 - never break chat
        logger.warning(f"Failed to submit profile extraction: {e}")


conn = sqlite3.connect(
    LANGGRAPH_CHECKPOINT_FILE,
    check_same_thread=False,
)
memory = SqliteSaver(conn)

agent_state = StateGraph(ThreadState)
agent_state.add_node("agent", call_model_with_messages)
agent_state.add_edge(START, "agent")
agent_state.add_edge("agent", END)
graph = agent_state.compile(checkpointer=memory)
