'use client'

import { useEffect, useState } from 'react'
import { Check, Mic2, Video, X } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { getDemoMediaProgress, type DemoMediaType } from '@/lib/demo-media'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useDemoMediaStore } from '@/lib/stores/demo-media-store'

const STAGE_KEYS = [
  'demoGeneration.stageAnalyze',
  'demoGeneration.stageArrange',
  'demoGeneration.stageSynthesize',
] as const

function formatRemaining(milliseconds: number) {
  const seconds = Math.ceil(milliseconds / 1_000)
  const minutes = Math.floor(seconds / 60)
  return `${minutes}:${String(seconds % 60).padStart(2, '0')}`
}

export function DemoGenerationProgress({ type }: { type: DemoMediaType }) {
  const { t } = useTranslation()
  const task = useDemoMediaStore((state) => state.tasks[type])
  const dismissedTaskId = useDemoMediaStore(
    (state) => state.dismissedTaskIds[type],
  )
  const dismissProgress = useDemoMediaStore((state) => state.dismissProgress)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!task) return

    const updateNow = () => setNow(Date.now())
    const intervalId = window.setInterval(updateNow, 500)
    document.addEventListener('visibilitychange', updateNow)
    return () => {
      window.clearInterval(intervalId)
      document.removeEventListener('visibilitychange', updateNow)
    }
  }, [task])

  if (!task || dismissedTaskId === task.id) return null

  const progress = getDemoMediaProgress(task, now)
  if (progress.completed) return null

  const progressPercent = Math.round(progress.progress * 100)
  const currentStage = Math.min(2, Math.floor(progress.progress * 3))
  const Icon = type === 'video' ? Video : Mic2
  const titleKey =
    type === 'video'
      ? 'demoGeneration.videoTitle'
      : 'demoGeneration.podcastTitle'

  return (
    <section className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-amber-400/[0.08] p-5 shadow-[0_18px_50px_-30px_rgba(47,71,180,0.65)]">
      <div className="pointer-events-none absolute -left-14 -top-20 h-48 w-48 animate-pulse rounded-full bg-primary/15 blur-3xl motion-reduce:animate-none" />
      <div className="pointer-events-none absolute -bottom-24 right-0 h-48 w-48 animate-pulse rounded-full bg-amber-400/15 blur-3xl [animation-delay:700ms] motion-reduce:animate-none" />

      <div className="relative flex items-start gap-4">
        <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/25">
          <span className="absolute inset-0 animate-ping rounded-2xl bg-primary/25 motion-reduce:animate-none" />
          <Icon className="relative h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1 space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                {t(titleKey)}
              </p>
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {task.title}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="-mr-2 -mt-2 h-8 w-8 shrink-0 rounded-full"
              aria-label={t('demoGeneration.close')}
              onClick={() => dismissProgress(type)}
            >
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-medium text-foreground">
                {t(STAGE_KEYS[currentStage])}
              </span>
              <span className="tabular-nums text-muted-foreground">
                {t('demoGeneration.remaining').replace(
                  '{time}',
                  formatRemaining(progress.remainingMs),
                )}
              </span>
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={progressPercent}
              className="h-2 overflow-hidden rounded-full bg-primary/10"
            >
              <div
                className="h-full rounded-full bg-gradient-to-r from-primary via-violet-500 to-amber-400 transition-[width] duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {STAGE_KEYS.map((stageKey, index) => {
              const reached = index <= currentStage
              return (
                <div
                  key={stageKey}
                  className="flex min-w-0 items-center gap-2 text-[11px] text-muted-foreground"
                >
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition-colors ${
                      reached
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card'
                    }`}
                  >
                    {index < currentStage ? (
                      <Check className="h-3 w-3" />
                    ) : (
                      <span
                        className={
                          reached
                            ? 'h-1.5 w-1.5 animate-pulse rounded-full bg-current motion-reduce:animate-none'
                            : 'h-1.5 w-1.5 rounded-full bg-muted-foreground/30'
                        }
                      />
                    )}
                  </span>
                  <span className="truncate">{t(stageKey)}</span>
                </div>
              )
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            {t('demoGeneration.backgroundHint')}
          </p>
        </div>
      </div>
    </section>
  )
}
