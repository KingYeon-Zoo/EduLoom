'use client'

import { FileText, Lightbulb, StickyNote } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip'
import { cn } from '@/lib/utils'
import { useTranslation } from '@/lib/hooks/use-translation'

// Helper to format a numeric count into a translated string.
// Uses i18next pluralization then substitutes the raw count.
function formatCount(t: ReturnType<typeof useTranslation>['t'], baseKey: string, rawCount: number): string {
  return t(baseKey, { count: rawCount })
}

// Format counts like tokens/chars with K/M suffix; uses simple replace since counts are strings.
function formatSuffixed(t: ReturnType<typeof useTranslation>['t'], key: string, raw: number): string {
  return t(key).replace('{count}', formatNumber(raw))
}

interface ContextIndicatorProps {
  sourcesInsights: number
  sourcesFull: number
  notesCount: number
  tokenCount?: number
  charCount?: number
  className?: string
}

// Helper function to format large numbers with K/M suffixes
function formatNumber(num: number): string {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`
  }
  return num.toString()
}

export function ContextIndicator({
  sourcesInsights,
  sourcesFull,
  notesCount,
  tokenCount,
  charCount,
  className
}: ContextIndicatorProps) {
  const { t } = useTranslation()
  const hasContext = (sourcesInsights + sourcesFull) > 0 || notesCount > 0

  if (!hasContext) {
    return (
      <div className={cn('flex-shrink-0 text-xs text-muted-foreground py-2 px-3 border-t', className)}>
        {t('common.noContextMessage')}
      </div>
    )
  }

  return (
    <div className={cn('flex-shrink-0 flex items-center justify-between gap-2 py-2 px-3 border-t bg-muted/30', className)}>
      <div className="flex items-center gap-2">
        <span className="text-xs font-medium text-muted-foreground">{t('common.context')}:</span>

        <div className="flex items-center gap-1.5">
          {sourcesInsights > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-amber-600 border-amber-600/50 cursor-default">
                  <Lightbulb className="h-3 w-3" />
                  <span>{sourcesInsights}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatCount(t, 'common.insightsFor', sourcesInsights)}</p>
              </TooltipContent>
            </Tooltip>
          )}

          {sourcesFull > 0 && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50 cursor-default">
                  <FileText className="h-3 w-3" />
                  <span>{sourcesFull}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatCount(t, 'common.fullSource', sourcesFull)}</p>
              </TooltipContent>
            </Tooltip>
          )}
        </div>

        {notesCount > 0 && (
          <>
            {(sourcesInsights > 0 || sourcesFull > 0) && (
              <span className="text-muted-foreground">•</span>
            )}
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className="text-xs flex items-center gap-1 px-1.5 py-0.5 text-primary border-primary/50 cursor-default">
                  <StickyNote className="h-3 w-3" />
                  <span>{notesCount}</span>
                </Badge>
              </TooltipTrigger>
              <TooltipContent>
                <p>{formatCount(t, 'common.fullNote', notesCount)}</p>
              </TooltipContent>
            </Tooltip>
          </>
        )}
      </div>

      {(tokenCount !== undefined || charCount !== undefined) && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          {tokenCount !== undefined && tokenCount > 0 && (
            <span>{formatSuffixed(t, 'common.tokensCount', tokenCount)}</span>
          )}
          {tokenCount !== undefined && charCount !== undefined && tokenCount > 0 && charCount > 0 && (
            <span>/</span>
          )}
          {charCount !== undefined && charCount > 0 && (
            <span>{formatSuffixed(t, 'common.charsCount', charCount)}</span>
          )}
        </div>
      )}
    </div>
  )
}
