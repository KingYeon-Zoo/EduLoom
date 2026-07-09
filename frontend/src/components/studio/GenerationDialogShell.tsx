'use client'

import type { ReactNode } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

/**
 * Shared 4:3 dialog shell for all generation features.
 *
 * Mirrors the Vue "named slots" pattern:
 * - `left`  → slot for content selection / notebook picker
 * - `right` → slot for generation settings / action buttons
 *
 * Each consumer (Podcast, Report, Quiz, Video, Mindmap, PPT) owns its
 * own state, hooks, and panel content — the shell only provides the
 * consistent frame, grid layout, and dialog chrome.
 */
export interface GenerationDialogShellProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  /** Left panel content (wider column — notebook / source selection) */
  left: ReactNode
  /** Right panel content (narrower column — settings + actions) */
  right: ReactNode
}

export function GenerationDialogShell({
  open,
  onOpenChange,
  title,
  description,
  left,
  right,
}: GenerationDialogShellProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[80vw] max-w-[1080px] max-h-[90vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription>{description}</DialogDescription>
          )}
        </DialogHeader>

        <div className="grid gap-6 md:grid-cols-[2fr_1fr] xl:grid-cols-[3fr_1fr]">
          {/* Left slot — typically content / notebook selection */}
          <div className="flex flex-col gap-4 min-h-0">{left}</div>
          {/* Right slot — typically settings / actions */}
          <div className="space-y-6">{right}</div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
