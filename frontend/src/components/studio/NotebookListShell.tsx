'use client'

import { Loader2 } from 'lucide-react'
import type { ReactNode } from 'react'

import { ScrollArea } from '@/components/ui/scroll-area'

export interface NotebookListShellProps {
  isLoading: boolean
  isEmpty: boolean
  loadingMessage: string
  emptyMessage: string
  /** Default: h-[calc(60vh+4.5rem)] — matches podcast dialog height */
  scrollHeight?: string
  children: ReactNode
}

/**
 * Shared outer wrapper for notebook lists in generation dialogs.
 *
 * Handles the three standard states (loading / empty / list) and the
 * consistent border + ScrollArea container so every dialog panel looks
 * the same regardless of which feature (podcast or studio) is using it.
 */
export function NotebookListShell({
  isLoading,
  isEmpty,
  loadingMessage,
  emptyMessage,
  scrollHeight = 'h-[calc(60vh+4.5rem)]',
  children,
}: NotebookListShellProps) {
  return (
    <div className="rounded-lg border bg-muted/30">
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />{' '}
          {loadingMessage}
        </div>
      ) : isEmpty ? (
        <div className="p-6 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : (
        <ScrollArea className={scrollHeight}>{children}</ScrollArea>
      )}
    </div>
  )
}
