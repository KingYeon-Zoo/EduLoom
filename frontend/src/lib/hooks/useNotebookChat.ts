'use client'

import { useRef, useState, useCallback, useEffect, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import { useTranslation } from '@/lib/hooks/use-translation'
import { chatApi } from '@/lib/api/chat'
import { QUERY_KEYS } from '@/lib/api/query-client'
import {
  NotebookChatMessage,
  ChatGenerationSuggestion,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SourceListResponse,
  NoteResponse,
  ReasoningEffort
} from '@/lib/types/api'
import { ContextSelections } from '@/app/(feature)/notebooks/[id]/page'

interface UseNotebookChatParams {
  notebookId: string
  sources: SourceListResponse[]
  notes: NoteResponse[]
  contextSelections: ContextSelections
}

export function useNotebookChat({ notebookId, sources, notes, contextSelections }: UseNotebookChatParams) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null)
  const [messages, setMessages] = useState<NotebookChatMessage[]>([])
  const [isSending, setIsSending] = useState(false)
  // Tutoring gate (Project E): suggestion from the latest AI reply, if any.
  const [generationSuggestion, setGenerationSuggestion] =
    useState<ChatGenerationSuggestion | null>(null)
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [charCount, setCharCount] = useState<number>(0)
  // Pending model override for when user changes model before a session exists
  const [pendingModelOverride, setPendingModelOverride] = useState<string | null>(null)
  // Pending reasoning effort for when user changes it before a session exists
  const [pendingReasoningEffort, setPendingReasoningEffort] = useState<ReasoningEffort | null>(null)
  // Track active stream to prevent concurrent sends
  const activeStreamRef = useRef<{ abort: () => void } | null>(null)

  // Memoize context selections to prevent unnecessary rerenders of buildContext
  const memoizedContextSelections = useMemo(() => contextSelections, [JSON.stringify(contextSelections)])


  // Fetch sessions for this notebook
  const {
    data: sessions = [],
    isLoading: loadingSessions,
    refetch: refetchSessions
  } = useQuery({
    queryKey: QUERY_KEYS.notebookChatSessions(notebookId),
    queryFn: () => chatApi.listSessions(notebookId),
    enabled: !!notebookId
  })

  // Fetch current session with messages
  const {
    data: currentSession,
    refetch: refetchCurrentSession
  } = useQuery({
    queryKey: QUERY_KEYS.notebookChatSession(currentSessionId!),
    queryFn: () => chatApi.getSession(currentSessionId!),
    enabled: !!notebookId && !!currentSessionId
  })

  // Update messages when current session changes
  useEffect(() => {
    if (currentSession?.messages) {
      setMessages(currentSession.messages)
    }
  }, [currentSession])

  // Auto-select most recent session when sessions are loaded
  useEffect(() => {
    if (sessions.length > 0 && !currentSessionId) {
      // Sessions are sorted by created date desc from API
      const mostRecentSession = sessions[0]
      setCurrentSessionId(mostRecentSession.id)
    }
  }, [sessions, currentSessionId])

  // Create session mutation
  const createSessionMutation = useMutation({
    mutationFn: (data: CreateNotebookChatSessionRequest) =>
      chatApi.createSession(data),
    onSuccess: (newSession) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      setCurrentSessionId(newSession.id)
      toast.success(t('chat.sessionCreated'))
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
    }
  })

  // Update session mutation
  const updateSessionMutation = useMutation({
    mutationFn: ({ sessionId, data }: {
      sessionId: string
      data: UpdateNotebookChatSessionRequest
    }) => chatApi.updateSession(sessionId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSession(currentSessionId!)
      })
      toast.success(t('chat.sessionUpdated'))
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToUpdateSession'))
    }
  })

  // Delete session mutation
  const deleteSessionMutation = useMutation({
    mutationFn: (sessionId: string) =>
      chatApi.deleteSession(sessionId),
    onSuccess: (_, deletedId) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
      })
      if (currentSessionId === deletedId) {
        setCurrentSessionId(null)
        setMessages([])
      }
      toast.success(t('chat.sessionDeleted'))
    },
    onError: (err: unknown) => {
      const error = err as { response?: { data?: { detail?: string } }, message?: string };
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToDeleteSession'))
    }
  })

  // Build context from sources and notes based on user selections
  const buildContext = useCallback(async () => {
    // Build context_config mapping IDs to selection modes
    const context_config: { sources: Record<string, string>, notes: Record<string, string> } = {
      sources: {},
      notes: {}
    }

    // Map source selections
    sources.forEach(source => {
      const mode = memoizedContextSelections.sources[source.id]
      if (mode === 'insights') {
        context_config.sources[source.id] = 'insights'
      } else if (mode === 'full') {
        context_config.sources[source.id] = 'full content'
      } else {
        context_config.sources[source.id] = 'not in'
      }
    })

    // Map note selections
    notes.forEach(note => {
      const mode = memoizedContextSelections.notes[note.id]
      if (mode === 'full') {
        context_config.notes[note.id] = 'full content'
      } else {
        context_config.notes[note.id] = 'not in'
      }
    })

    // Call API to build context with actual content
    const response = await chatApi.buildContext({
      notebook_id: notebookId,
      context_config
    })

    // Store token and char counts
    setTokenCount(response.token_count)
    setCharCount(response.char_count)

    return response.context
  }, [notebookId, sources, notes, memoizedContextSelections])

  // Send message with SSE streaming
  const sendMessage = useCallback(async (message: string, modelOverride?: string) => {
    // Guard against concurrent sends — must set BEFORE any await
    if (activeStreamRef.current) {
      toast.error(t('apiErrors.alreadySending') || 'A message is already being sent')
      return
    }
    let aborted = false
    activeStreamRef.current = { abort: () => { aborted = true } }

    let sessionId = currentSessionId

    // Auto-create session if none exists
    if (!sessionId) {
      try {
        const defaultTitle = message.length > 30
          ? `${message.substring(0, 30)}...`
          : message
        const newSession = await chatApi.createSession({
          notebook_id: notebookId,
          title: defaultTitle,
          // Include pending model override when creating session
          model_override: pendingModelOverride ?? undefined,
          reasoning_effort: pendingReasoningEffort ?? undefined
        })
        sessionId = newSession.id
        setCurrentSessionId(sessionId)
        // Clear pending model override now that it's applied to the session
        setPendingModelOverride(null)
        setPendingReasoningEffort(null)
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.notebookChatSessions(notebookId)
        })
      } catch (err: unknown) {
        const error = err as { response?: { data?: { detail?: string } }, message?: string };
        toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToCreateSession'))
        return
      }
    }

    // Add user message optimistically
    const userMessage: NotebookChatMessage = {
      id: `temp-${Date.now()}`,
      type: 'human',
      content: message,
      timestamp: new Date().toISOString()
    }
    setMessages(prev => [...prev, userMessage])
    setIsSending(true)
    // Clear any prior tutoring suggestion when a new turn starts.
    setGenerationSuggestion(null)

    try {
      // Build context and set up streaming
      const context = await buildContext()
      const eventStream = chatApi.sendMessageStream({
        session_id: sessionId,
        message,
        context,
        model_override: modelOverride ?? (currentSession?.model_override ?? undefined),
        reasoning_effort:
          currentSession?.reasoning_effort ?? pendingReasoningEffort ?? undefined
      })

      // Accumulate AI messages as they stream in
      const aiMessages: NotebookChatMessage[] = []
      let complete = false

      for await (const event of eventStream) {
        switch (event.type) {
          case 'user_message':
            // User message already added optimistically — confirm it
            break

          case 'ai_message': {
            const aiMsg: NotebookChatMessage = {
              id: `ai-${Date.now()}-${aiMessages.length}`,
              type: 'ai',
              content: event.content ?? '',
              timestamp: event.timestamp ?? new Date().toISOString(),
            }
            aiMessages.push(aiMsg)

            // Update UI incrementally — replace optimistic user msg + previous AI with full list
            setMessages(prev => {
              const nonTemp = prev.filter(msg => !msg.id.startsWith('temp-'))
              // Remove any previously streamed AI messages from this turn
              const cleaned = nonTemp.filter(m => !m.id.startsWith('ai-stream-'))
              // Tag AI messages with stream marker so they can be replaced on next event
              const tagged = aiMessages.map((m, i) => ({
                ...m,
                id: i === aiMessages.length - 1 ? m.id : `ai-stream-${i}`,
              }))
              return [...cleaned, ...tagged]
            })
            break
          }

          case 'generation_suggestion':
            setGenerationSuggestion(event.data ?? null)
            break

          case 'complete':
            complete = true
            break

          case 'error':
            toast.error(event.message || t('apiErrors.failedToSendMessage'))
            setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
            break
        }
      }

      // On completion, remove stream markers and refetch session
      if (complete && aiMessages.length > 0) {
        setMessages(prev =>
          prev.map(m => ({ ...m, id: m.id.startsWith('ai-stream-') ? `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}` : m.id }))
        )
        await refetchCurrentSession()
      }
    } catch (err: unknown) {
      if (aborted) return // Silently exit if aborted
      const error = err as { response?: { data?: { detail?: string } }, message?: string }
      console.error('Error sending message:', error)
      toast.error(getApiErrorMessage(error.response?.data?.detail || error.message, (key) => t(key), 'apiErrors.failedToSendMessage'))
      // Remove optimistic message on error
      setMessages(prev => prev.filter(msg => !msg.id.startsWith('temp-')))
    } finally {
      activeStreamRef.current = null
      setIsSending(false)
    }
  }, [
    notebookId,
    currentSessionId,
    currentSession,
    pendingModelOverride,
    pendingReasoningEffort,
    buildContext,
    refetchCurrentSession,
    queryClient,
    t
  ])

  // Switch session
  const switchSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId)
  }, [])

  // Create session
  const createSession = useCallback((title?: string) => {
    return createSessionMutation.mutate({
      notebook_id: notebookId,
      title
    })
  }, [createSessionMutation, notebookId])

  // Update session
  const updateSession = useCallback((sessionId: string, data: UpdateNotebookChatSessionRequest) => {
    return updateSessionMutation.mutate({
      sessionId,
      data
    })
  }, [updateSessionMutation])

  // Delete session
  const deleteSession = useCallback((sessionId: string) => {
    return deleteSessionMutation.mutate(sessionId)
  }, [deleteSessionMutation])

  // Set model override - handles both existing sessions and pending state
  const setModelOverride = useCallback((model: string | null) => {
    if (currentSessionId) {
      // Session exists - update it directly
      updateSessionMutation.mutate({
        sessionId: currentSessionId,
        data: { model_override: model }
      })
    } else {
      // No session yet - store as pending
      setPendingModelOverride(model)
    }
  }, [currentSessionId, updateSessionMutation])

  // Set reasoning effort - handles both existing sessions and pending state
  const setReasoningEffort = useCallback((effort: ReasoningEffort) => {
    if (currentSessionId) {
      updateSessionMutation.mutate({
        sessionId: currentSessionId,
        data: { reasoning_effort: effort }
      })
    } else {
      setPendingReasoningEffort(effort)
    }
  }, [currentSessionId, updateSessionMutation])

  // Update token/char counts when context selections change
  useEffect(() => {
    const updateContextCounts = async () => {
      try {
        await buildContext()
      } catch (error) {
        console.error('Error updating context counts:', error)
      }
    }
    updateContextCounts()
  }, [buildContext])

  return {
    // State
    sessions,
    currentSession: currentSession || sessions.find(s => s.id === currentSessionId),
    currentSessionId,
    messages,
    isSending,
    generationSuggestion,
    clearGenerationSuggestion: () => setGenerationSuggestion(null),
    loadingSessions,
    tokenCount,
    charCount,
    pendingModelOverride,
    pendingReasoningEffort,

    // Actions
    createSession,
    updateSession,
    deleteSession,
    switchSession,
    sendMessage,
    setModelOverride,
    setReasoningEffort,
    refetchSessions
  }
}
