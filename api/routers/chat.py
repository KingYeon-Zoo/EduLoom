import asyncio
import json
import traceback
from typing import Any, AsyncGenerator, Dict, List, Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage
from langchain_core.runnables import RunnableConfig
from loguru import logger
from pydantic import BaseModel, Field

from open_notebook.database.repository import ensure_record_id, repo_query
from open_notebook.domain.notebook import ChatSession, Note, Notebook, Source
from edu_loom.ai.doubao.esperanto_llm import normalize_reasoning_effort
from open_notebook.exceptions import (
    NotFoundError,
)
from open_notebook.graphs.chat import graph as chat_graph
from open_notebook.utils.graph_utils import get_session_message_count

router = APIRouter()


# Lock system to serialize LangGraph state writes per session_id
_session_locks: Dict[str, asyncio.Lock] = {}
_session_locks_lock = asyncio.Lock()

async def get_session_lock(session_id: str) -> asyncio.Lock:
    async with _session_locks_lock:
        if session_id not in _session_locks:
            _session_locks[session_id] = asyncio.Lock()
        return _session_locks[session_id]



# Request/Response models
class CreateSessionRequest(BaseModel):
    notebook_id: str = Field(..., description="Notebook ID to create session for")
    title: Optional[str] = Field(None, description="Optional session title")
    model_override: Optional[str] = Field(
        None, description="Optional model override for this session"
    )
    reasoning_effort: Optional[str] = Field(
        None, description="Thinking strength: minimal|low|medium|high (default medium)"
    )


class UpdateSessionRequest(BaseModel):
    title: Optional[str] = Field(None, description="New session title")
    model_override: Optional[str] = Field(
        None, description="Model override for this session"
    )
    reasoning_effort: Optional[str] = Field(
        None, description="Thinking strength: minimal|low|medium|high"
    )


class ChatMessage(BaseModel):
    id: str = Field(..., description="Message ID")
    type: str = Field(..., description="Message type (human|ai)")
    content: str = Field(..., description="Message content")
    timestamp: Optional[str] = Field(None, description="Message timestamp")


class ChatSessionResponse(BaseModel):
    id: str = Field(..., description="Session ID")
    title: str = Field(..., description="Session title")
    notebook_id: Optional[str] = Field(None, description="Notebook ID")
    created: str = Field(..., description="Creation timestamp")
    updated: str = Field(..., description="Last update timestamp")
    message_count: Optional[int] = Field(
        None, description="Number of messages in session"
    )
    model_override: Optional[str] = Field(
        None, description="Model override for this session"
    )
    reasoning_effort: Optional[str] = Field(
        None, description="Thinking strength for this session"
    )


class ChatSessionWithMessagesResponse(ChatSessionResponse):
    messages: List[ChatMessage] = Field(
        default_factory=list, description="Session messages"
    )


class ExecuteChatRequest(BaseModel):
    session_id: str = Field(..., description="Chat session ID")
    message: str = Field(..., max_length=50000, description="User message content")
    context: Dict[str, Any] = Field(
        ..., description="Chat context with sources and notes"
    )
    model_override: Optional[str] = Field(
        None, description="Optional model override for this message"
    )
    reasoning_effort: Optional[str] = Field(
        None, description="Thinking strength: minimal|low|medium|high for this message"
    )


class ExecuteChatResponse(BaseModel):
    session_id: str = Field(..., description="Session ID")
    messages: List[ChatMessage] = Field(..., description="Updated message list")
    generation_suggestion: Optional[Dict[str, str]] = Field(
        None,
        description="Tutoring resource-generation suggestion {type, prompt}, if any",
    )


class BuildContextRequest(BaseModel):
    notebook_id: str = Field(..., description="Notebook ID")
    context_config: Dict[str, Any] = Field(..., description="Context configuration")


class BuildContextResponse(BaseModel):
    context: Dict[str, Any] = Field(..., description="Built context data")
    token_count: int = Field(..., description="Estimated token count")
    char_count: int = Field(..., description="Character count")


class SuccessResponse(BaseModel):
    success: bool = Field(True, description="Operation success status")
    message: str = Field(..., description="Success message")


@router.get("/chat/sessions", response_model=List[ChatSessionResponse])
async def get_sessions(notebook_id: str = Query(..., description="Notebook ID")):
    """Get all chat sessions for a notebook."""
    try:
        # Get notebook to verify it exists
        notebook = await Notebook.get(notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

        # Get sessions for this notebook
        sessions_list = await notebook.get_chat_sessions()

        results = []
        for session in sessions_list:
            session_id = str(session.id)

            # Get message count from LangGraph state
            msg_count = await get_session_message_count(chat_graph, session_id)

            results.append(
                ChatSessionResponse(
                    id=session.id or "",
                    title=session.title or "Untitled Session",
                    notebook_id=notebook_id,
                    created=str(session.created),
                    updated=str(session.updated),
                    message_count=msg_count,
                    model_override=getattr(session, "model_override", None),
                    reasoning_effort=getattr(session, "reasoning_effort", None),
                )
            )

        return results
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Notebook not found")
    except Exception as e:
        logger.error(f"Error fetching chat sessions: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to fetch chat sessions"
        )



@router.post("/chat/sessions", response_model=ChatSessionResponse)
async def create_session(request: CreateSessionRequest):
    """Create a new chat session."""
    try:
        # Verify notebook exists
        notebook = await Notebook.get(request.notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

        import time
        session = ChatSession(
            title=request.title
            or f"Chat Session {time.time():.0f}",
            model_override=request.model_override,
            reasoning_effort=normalize_reasoning_effort(request.reasoning_effort),
        )
        await session.save()

        # Relate session to notebook
        await session.relate_to_notebook(request.notebook_id)

        return ChatSessionResponse(
            id=session.id or "",
            title=session.title or "",
            notebook_id=request.notebook_id,
            created=str(session.created),
            updated=str(session.updated),
            message_count=0,
            model_override=session.model_override,
            reasoning_effort=session.reasoning_effort,
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Notebook not found")
    except Exception as e:
        logger.error(f"Error creating chat session: {str(e)}")
        raise HTTPException(
            status_code=500, detail="Failed to create chat session"
        )



@router.get(
    "/chat/sessions/{session_id}", response_model=ChatSessionWithMessagesResponse
)
async def get_session(session_id: str):
    """Get a specific session with its messages."""
    try:
        # Get session
        # Ensure session_id has proper table prefix
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )
        session = await ChatSession.get(full_session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Get session state from LangGraph to retrieve messages
        # Use sync get_state() in a thread since SqliteSaver doesn't support async
        thread_state = await asyncio.to_thread(
            chat_graph.get_state,
            config=RunnableConfig(configurable={"thread_id": full_session_id}),
        )

        # Extract messages from state
        messages: list[ChatMessage] = []
        if thread_state and thread_state.values and "messages" in thread_state.values:
            for msg in thread_state.values["messages"]:
                messages.append(
                    ChatMessage(
                        id=getattr(msg, "id", f"msg_{len(messages)}"),
                        type=msg.type if hasattr(msg, "type") else "unknown",
                        content=msg.content if hasattr(msg, "content") else str(msg),
                        timestamp=None,  # LangChain messages don't have timestamps by default
                    )
                )

        # Find notebook_id (we need to query the relationship)
        # Ensure session_id has proper table prefix
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )

        notebook_query = await repo_query(
            "SELECT out FROM refers_to WHERE in = $session_id",
            {"session_id": ensure_record_id(full_session_id)},
        )

        notebook_id = notebook_query[0]["out"] if notebook_query else None

        if not notebook_id:
            # This might be an old session created before API migration
            logger.warning(
                f"No notebook relationship found for session {session_id} - may be an orphaned session"
            )

        return ChatSessionWithMessagesResponse(
            id=session.id or "",
            title=session.title or "Untitled Session",
            notebook_id=notebook_id,
            created=str(session.created),
            updated=str(session.updated),
            message_count=len(messages),
            messages=messages,
            model_override=getattr(session, "model_override", None),
            reasoning_effort=getattr(session, "reasoning_effort", None),
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Error fetching session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to fetch session")


@router.put("/chat/sessions/{session_id}", response_model=ChatSessionResponse)
async def update_session(session_id: str, request: UpdateSessionRequest):
    """Update session title."""
    try:
        # Ensure session_id has proper table prefix
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )
        session = await ChatSession.get(full_session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        update_data = request.model_dump(exclude_unset=True)

        if "title" in update_data:
            session.title = update_data["title"]

        if "model_override" in update_data:
            session.model_override = update_data["model_override"]

        if "reasoning_effort" in update_data:
            session.reasoning_effort = normalize_reasoning_effort(
                update_data["reasoning_effort"]
            )

        await session.save()

        # Find notebook_id
        # Ensure session_id has proper table prefix
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )
        notebook_query = await repo_query(
            "SELECT out FROM refers_to WHERE in = $session_id",
            {"session_id": ensure_record_id(full_session_id)},
        )
        notebook_id = notebook_query[0]["out"] if notebook_query else None

        # Get message count from LangGraph state
        msg_count = await get_session_message_count(chat_graph, full_session_id)

        return ChatSessionResponse(
            id=session.id or "",
            title=session.title or "",
            notebook_id=notebook_id,
            created=str(session.created),
            updated=str(session.updated),
            message_count=msg_count,
            model_override=session.model_override,
            reasoning_effort=getattr(session, "reasoning_effort", None),
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Error updating session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to update session")


@router.delete("/chat/sessions/{session_id}", response_model=SuccessResponse)
async def delete_session(session_id: str):
    """Delete a chat session."""
    try:
        # Ensure session_id has proper table prefix
        full_session_id = (
            session_id
            if session_id.startswith("chat_session:")
            else f"chat_session:{session_id}"
        )
        session = await ChatSession.get(full_session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        await session.delete()

        return SuccessResponse(success=True, message="Session deleted successfully")
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(f"Error deleting session: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to delete session")


@router.post("/chat/execute", response_model=ExecuteChatResponse)
async def execute_chat(request: ExecuteChatRequest):
    """Execute a chat request and get AI response."""
    try:
        # Verify session exists
        # Ensure session_id has proper table prefix
        full_session_id = (
            request.session_id
            if request.session_id.startswith("chat_session:")
            else f"chat_session:{request.session_id}"
        )
        session = await ChatSession.get(full_session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        lock = await get_session_lock(full_session_id)
        async with lock:
            # Fetch notebook linked to this session
            notebook_query = await repo_query(
                "SELECT out FROM refers_to WHERE in = $session_id",
                {"session_id": ensure_record_id(full_session_id)},
            )
            notebook = None
            if notebook_query:
                notebook = await Notebook.get(notebook_query[0]["out"])

            # Determine model override (per-request override takes precedence over session-level)
            model_override = (
                request.model_override
                if request.model_override is not None
                else getattr(session, "model_override", None)
            )

            # Determine reasoning effort (per-request > session-level > default medium)
            reasoning_effort = normalize_reasoning_effort(
                request.reasoning_effort
                if request.reasoning_effort is not None
                else getattr(session, "reasoning_effort", None)
            )

            # Get current state
            # Use sync get_state() in a thread since SqliteSaver doesn't support async
            current_state = await asyncio.to_thread(
                chat_graph.get_state,
                config=RunnableConfig(configurable={"thread_id": full_session_id}),
            )

            # Prepare state for execution
            state_values = current_state.values if current_state else {}
            state_values["messages"] = state_values.get("messages", [])
            state_values["context"] = request.context
            state_values["notebook"] = notebook
            state_values["model_override"] = model_override
            state_values["reasoning_effort"] = reasoning_effort

            # Add user message to state
            user_message = HumanMessage(content=request.message)
            state_values["messages"].append(user_message)

            # Execute chat graph in a thread to avoid blocking the event loop
            result = await asyncio.to_thread(
                chat_graph.invoke,
                input=state_values,  # type: ignore[arg-type]
                config=RunnableConfig(
                    configurable={
                        "thread_id": full_session_id,
                        "model_id": model_override,
                        "reasoning_effort": reasoning_effort,
                    }
                ),
            )

            # Update session timestamp
            await session.save()

            # Convert messages to response format
            messages: list[ChatMessage] = []
            for msg in result.get("messages", []):
                messages.append(
                    ChatMessage(
                        id=getattr(msg, "id", f"msg_{len(messages)}"),
                        type=msg.type if hasattr(msg, "type") else "unknown",
                        content=msg.content if hasattr(msg, "content") else str(msg),
                        timestamp=None,
                    )
                )

            return ExecuteChatResponse(
                session_id=request.session_id,
                messages=messages,
                generation_suggestion=result.get("generation_suggestion"),
            )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        # Log detailed error with context for debugging
        logger.error(
            f"Error executing chat: {str(e)}\n"
            f"  Session ID: {request.session_id}\n"
            f"  Model override: {request.model_override}\n"
            f"  Traceback:\n{traceback.format_exc()}"
        )
        raise HTTPException(status_code=500, detail="Failed to execute chat")



async def stream_notebook_chat_response(
    session_id: str,
    full_session_id: str,
    message: str,
    notebook: Optional[Notebook],
    model_override: Optional[str],
    reasoning_effort: Optional[str],
    context: Optional[str] = None,
) -> AsyncGenerator[str, None]:
    """Stream the notebook chat response as Server-Sent Events."""
    lock = await get_session_lock(full_session_id)
    async with lock:
        try:
            # Get current state
            current_state = await asyncio.to_thread(
                chat_graph.get_state,
                config=RunnableConfig(configurable={"thread_id": full_session_id}),
            )

            # Prepare state for execution
            state_values = current_state.values if current_state else {}
            state_values["messages"] = state_values.get("messages", [])
            state_values["context"] = context
            state_values["notebook"] = notebook
            state_values["model_override"] = model_override
            state_values["reasoning_effort"] = reasoning_effort

            # Add user message to state
            user_message = HumanMessage(content=message)
            state_values["messages"].append(user_message)

            # Send user message event
            user_event = {"type": "user_message", "content": message, "timestamp": None}
            yield f"data: {json.dumps(user_event)}\n\n"

            # Execute chat graph (blocking, in thread to not block the async generator)
            result = await asyncio.to_thread(
                chat_graph.invoke,
                input=state_values,  # type: ignore[arg-type]
                config=RunnableConfig(
                    configurable={
                        "thread_id": full_session_id,
                        "model_id": model_override,
                        "reasoning_effort": reasoning_effort,
                    }
                ),
            )

            # Stream AI messages
            if "messages" in result:
                for msg in result["messages"]:
                    if hasattr(msg, "type") and msg.type == "ai":
                        ai_event = {
                            "type": "ai_message",
                            "content": msg.content if hasattr(msg, "content") else str(msg),
                            "timestamp": None,
                        }
                        yield f"data: {json.dumps(ai_event)}\n\n"

            # Send generation suggestion if present
            if result.get("generation_suggestion"):
                suggestion_event = {
                    "type": "generation_suggestion",
                    "data": result["generation_suggestion"],
                }
                yield f"data: {json.dumps(suggestion_event)}\n\n"

            # Send completion signal
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"

        except Exception as e:
            from open_notebook.utils.error_classifier import classify_error

            _, user_message = classify_error(e)
            logger.error(f"Error in notebook chat streaming: {str(e)}")
            error_event = {"type": "error", "message": user_message}
            yield f"data: {json.dumps(error_event)}\n\n"
            # Send complete after error so frontend knows stream is done
            yield f"data: {json.dumps({'type': 'complete'})}\n\n"



@router.post("/chat/execute/stream")
async def execute_chat_stream(request: ExecuteChatRequest):
    """Execute a chat request with SSE streaming response."""
    try:
        # Verify session exists
        full_session_id = (
            request.session_id
            if request.session_id.startswith("chat_session:")
            else f"chat_session:{request.session_id}"
        )
        session = await ChatSession.get(full_session_id)
        if not session:
            raise HTTPException(status_code=404, detail="Session not found")

        # Fetch notebook linked to this session
        notebook_query = await repo_query(
            "SELECT out FROM refers_to WHERE in = $session_id",
            {"session_id": ensure_record_id(full_session_id)},
        )
        notebook = None
        if notebook_query:
            notebook = await Notebook.get(notebook_query[0]["out"])

        # Determine model override
        model_override = (
            request.model_override
            if request.model_override is not None
            else getattr(session, "model_override", None)
        )

        # Determine reasoning effort
        reasoning_effort = normalize_reasoning_effort(
            request.reasoning_effort
            if request.reasoning_effort is not None
            else getattr(session, "reasoning_effort", None)
        )

        # Update session timestamp
        await session.save()

        return StreamingResponse(
            stream_notebook_chat_response(
                session_id=request.session_id,
                full_session_id=full_session_id,
                message=request.message,
                notebook=notebook,
                model_override=model_override,
                reasoning_effort=reasoning_effort,
                context=request.context,
            ),
            media_type="text/plain",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Type": "text/plain; charset=utf-8",
            },
        )
    except NotFoundError:
        raise HTTPException(status_code=404, detail="Session not found")
    except Exception as e:
        logger.error(
            f"Error executing chat stream: {str(e)}\n"
            f"  Session ID: {request.session_id}\n"
            f"  Model override: {request.model_override}\n"
            f"  Traceback:\n{traceback.format_exc()}"
        )
        raise HTTPException(status_code=500, detail="Failed to execute chat stream")



@router.post("/chat/context", response_model=BuildContextResponse)
async def build_context(request: BuildContextRequest):
    """Build context for a notebook based on context configuration."""
    try:
        # Verify notebook exists
        notebook = await Notebook.get(request.notebook_id)
        if not notebook:
            raise HTTPException(status_code=404, detail="Notebook not found")

        context_data: dict[str, list[dict[str, str]]] = {"sources": [], "notes": []}
        total_content = ""

        # Process context configuration if provided
        if request.context_config:
            # Process sources
            for source_id, status in request.context_config.get("sources", {}).items():
                if "not in" in status:
                    continue

                try:
                    # Add table prefix if not present
                    full_source_id = (
                        source_id
                        if source_id.startswith("source:")
                        else f"source:{source_id}"
                    )

                    try:
                        source = await Source.get(full_source_id)
                    except Exception:
                        continue

                    if "insights" in status:
                        source_context = await source.get_context(context_size="short")
                        context_data["sources"].append(source_context)
                        total_content += str(source_context)
                    elif "full content" in status:
                        source_context = await source.get_context(context_size="long")
                        context_data["sources"].append(source_context)
                        total_content += str(source_context)
                except Exception as e:
                    logger.warning(f"Error processing source {source_id}: {str(e)}")
                    continue

            # Process notes
            for note_id, status in request.context_config.get("notes", {}).items():
                if "not in" in status:
                    continue

                try:
                    # Add table prefix if not present
                    full_note_id = (
                        note_id if note_id.startswith("note:") else f"note:{note_id}"
                    )
                    note = await Note.get(full_note_id)
                    if not note:
                        continue

                    if "full content" in status:
                        note_context = note.get_context(context_size="long")
                        context_data["notes"].append(note_context)
                        total_content += str(note_context)
                except Exception as e:
                    logger.warning(f"Error processing note {note_id}: {str(e)}")
                    continue
        else:
            # Default behavior - include all sources and notes with short context
            sources = await notebook.get_sources()
            for source in sources:
                try:
                    source_context = await source.get_context(context_size="short")
                    context_data["sources"].append(source_context)
                    total_content += str(source_context)
                except Exception as e:
                    logger.warning(f"Error processing source {source.id}: {str(e)}")
                    continue

            notes = await notebook.get_notes()
            for note in notes:
                try:
                    note_context = note.get_context(context_size="short")
                    context_data["notes"].append(note_context)
                    total_content += str(note_context)
                except Exception as e:
                    logger.warning(f"Error processing note {note.id}: {str(e)}")
                    continue

        # Calculate character and token counts
        char_count = len(total_content)
        # Use token count utility if available
        try:
            from open_notebook.utils import token_count

            estimated_tokens = token_count(total_content) if total_content else 0
        except ImportError:
            # Fallback to simple estimation
            estimated_tokens = char_count // 4

        return BuildContextResponse(
            context=context_data, token_count=estimated_tokens, char_count=char_count
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error building context: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to build context")
