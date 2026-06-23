import apiClient from './client'
import {
  NotebookChatSession,
  NotebookChatSessionWithMessages,
  CreateNotebookChatSessionRequest,
  UpdateNotebookChatSessionRequest,
  SendNotebookChatMessageRequest,
  NotebookChatMessage,
  ChatGenerationSuggestion,
  BuildContextRequest,
  BuildContextResponse,
} from '@/lib/types/api'

export const chatApi = {
  // Session management
  listSessions: async (notebookId: string) => {
    const response = await apiClient.get<NotebookChatSession[]>(
      `/chat/sessions`,
      { params: { notebook_id: notebookId } }
    )
    return response.data
  },

  createSession: async (data: CreateNotebookChatSessionRequest) => {
    const response = await apiClient.post<NotebookChatSession>(
      `/chat/sessions`,
      data
    )
    return response.data
  },

  getSession: async (sessionId: string) => {
    const response = await apiClient.get<NotebookChatSessionWithMessages>(
      `/chat/sessions/${sessionId}`
    )
    return response.data
  },

  updateSession: async (sessionId: string, data: UpdateNotebookChatSessionRequest) => {
    const response = await apiClient.put<NotebookChatSession>(
      `/chat/sessions/${sessionId}`,
      data
    )
    return response.data
  },

  deleteSession: async (sessionId: string) => {
    await apiClient.delete(`/chat/sessions/${sessionId}`)
  },

  // Messaging (synchronous, no streaming)
  sendMessage: async (data: SendNotebookChatMessageRequest) => {
    const response = await apiClient.post<{
      session_id: string
      messages: NotebookChatMessage[]
      generation_suggestion?: ChatGenerationSuggestion | null
    }>(
      `/chat/execute`,
      data
    )
    return response.data
  },

  /**
   * Send a message and receive streaming SSE response.
   * Yields parsed events: { type: 'user_message' | 'ai_message' | 'generation_suggestion' | 'complete' | 'error', ... }
   */
  sendMessageStream: async function* (data: SendNotebookChatMessageRequest) {
    const { getApiUrl } = await import('@/lib/config')
    const baseUrl = await getApiUrl()

    // Extract auth token (same logic as apiClient interceptor)
    let token = ''
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem('auth-storage')
      if (raw) {
        try {
          const parsed = JSON.parse(raw)
          token = parsed?.state?.token ?? ''
        } catch { /* ignore */ }
      }
    }

    const response = await fetch(`${baseUrl}/chat/execute/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error')
      throw new Error(errorText || `HTTP ${response.status}`)
    }

    const reader = response.body?.getReader()
    if (!reader) throw new Error('No response body')

    const decoder = new TextDecoder()
    let buffer = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed || !trimmed.startsWith('data: ')) continue

          try {
            const data = JSON.parse(trimmed.slice(6))
            yield data
          } catch {
            // Skip malformed JSON lines
          }
        }
      }
    } finally {
      reader.releaseLock()
    }
  },

  buildContext: async (data: BuildContextRequest) => {
    const response = await apiClient.post<BuildContextResponse>(
      `/chat/context`,
      data
    )
    return response.data
  },
}

export default chatApi
