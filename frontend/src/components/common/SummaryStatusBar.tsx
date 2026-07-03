'use client'

import { Badge } from '@/components/ui/badge'
import { useTranslation } from '@/lib/hooks/use-translation'

export interface SummaryStatusBarProps {
  total: number
  running: number
  completed: number
  failed: number
  pending: number
}

/**
 * Shared status-count badge bar.
 *
 * Used by every generation page (podcasts + studio 5 types) to show a
 * consistent row of summary counts.
 */
export function SummaryStatusBar({
  total,
  running,
  completed,
  failed,
  pending,
}: SummaryStatusBarProps) {
  const { t } = useTranslation()

  return (
    <div className="flex flex-wrap gap-2">
      <Badge variant="outline" className="font-medium">
        <span className="text-muted-foreground mr-1.5">{t('podcasts.total')}</span>
        <span className="text-foreground">{total}</span>
      </Badge>
      <Badge variant="outline" className="font-medium">
        <span className="text-muted-foreground mr-1.5">{t('podcasts.processingLabel')}</span>
        <span className="text-foreground">{running}</span>
      </Badge>
      <Badge variant="outline" className="font-medium">
        <span className="text-muted-foreground mr-1.5">{t('podcasts.completedLabel')}</span>
        <span className="text-foreground">{completed}</span>
      </Badge>
      <Badge variant="outline" className="font-medium">
        <span className="text-muted-foreground mr-1.5">{t('podcasts.failedLabel')}</span>
        <span className="text-foreground">{failed}</span>
      </Badge>
      <Badge variant="outline" className="font-medium">
        <span className="text-muted-foreground mr-1.5">{t('podcasts.pendingLabel')}</span>
        <span className="text-foreground">{pending}</span>
      </Badge>
    </div>
  )
}
