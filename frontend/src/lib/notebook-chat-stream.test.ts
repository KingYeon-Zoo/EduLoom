import { describe, expect, it } from 'vitest'

import { mergeNotebookChatStreamMessages } from '@/lib/notebook-chat-stream'
import type { NotebookChatMessage } from '@/lib/types/api'

const historicMessage: NotebookChatMessage = {
  id: 'historic-ai',
  type: 'ai',
  content: '历史回答',
}

const streamedMessages: NotebookChatMessage[] = [
  {
    id: 'ai-stream-turn-1-0',
    type: 'ai',
    content: '本轮第一段',
  },
  {
    id: 'ai-stream-turn-1-1',
    type: 'ai',
    content: '本轮第二段',
  },
]

describe('mergeNotebookChatStreamMessages', () => {
  it('replaces the current turn instead of appending duplicate message ids', () => {
    const firstRender = mergeNotebookChatStreamMessages(
      [
        historicMessage,
        { id: 'temp-user', type: 'human', content: '临时问题' },
      ],
      streamedMessages,
      'ai-stream-turn-1',
    )

    const batchedRender = mergeNotebookChatStreamMessages(
      firstRender,
      streamedMessages,
      'ai-stream-turn-1',
    )

    expect(batchedRender.map((message) => message.id)).toEqual([
      'historic-ai',
      'ai-stream-turn-1-0',
      'ai-stream-turn-1-1',
    ])
    expect(new Set(batchedRender.map((message) => message.id)).size).toBe(
      batchedRender.length,
    )
  })

  it('does not remove messages from another stream turn', () => {
    const result = mergeNotebookChatStreamMessages(
      [
        historicMessage,
        {
          id: 'ai-stream-older-turn-0',
          type: 'ai',
          content: '上一轮流式消息',
        },
      ],
      streamedMessages,
      'ai-stream-turn-1',
    )

    expect(result.map((message) => message.id)).toContain(
      'ai-stream-older-turn-0',
    )
  })
})
