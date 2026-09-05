import type { NotebookChatMessage } from '@/lib/types/api'

export function mergeNotebookChatStreamMessages(
  currentMessages: NotebookChatMessage[],
  streamedMessages: NotebookChatMessage[],
  streamMessagePrefix: string,
): NotebookChatMessage[] {
  const streamIdPrefix = `${streamMessagePrefix}-`
  const preservedMessages = currentMessages.filter(
    (message) =>
      !message.id.startsWith('temp-') &&
      !message.id.startsWith(streamIdPrefix),
  )

  return [...preservedMessages, ...streamedMessages]
}
