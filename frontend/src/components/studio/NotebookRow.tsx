'use client'

import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/hooks/use-translation'
import { cn } from '@/lib/utils'
import type { NotebookResponse } from '@/lib/types/api'

export interface NotebookRowProps {
  notebook: NotebookResponse
  /** Optional secondary text below the name (description or selection summary) */
  secondaryText?: string
  /** Forwarded to the root div for layout control */
  className?: string
}

/**
 * Shared notebook row used by every generation dialog.
 *
 * Guarantees visual consistency across all six modules:
 * - Same name typography (`font-medium text-sm text-foreground`)
 * - Same source / note count badge
 * - Same secondary-text style (`text-xs text-muted-foreground line-clamp-2`)
 */
export function NotebookRow({
  notebook,
  secondaryText,
  className,
}: NotebookRowProps) {
  const { t } = useTranslation()

  return (
    <div className={cn(className)}>
      <div className="flex items-center justify-between gap-2">
        <p className="font-medium text-sm text-foreground">
          {notebook.name}
        </p>
        <Badge variant="outline" className="text-xs shrink-0">
          {notebook.source_count} {t('podcasts.sources')} ·{' '}
          {notebook.note_count} {t('podcasts.notes')}
        </Badge>
      </div>
      {secondaryText && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
          {secondaryText}
        </p>
      )}
    </div>
  )
}
