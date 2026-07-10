'use client'

import { useCallback } from 'react'
import { AlertCircle, Loader2, Mic } from 'lucide-react'

import { useDeletePodcastEpisode, usePodcastEpisodes, useRetryPodcastEpisode } from '@/lib/hooks/use-podcasts'
import { EpisodeCard } from '@/components/podcasts/EpisodeCard'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EmptyState } from '@/components/common/EmptyState'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useDemoMediaStore } from '@/lib/stores/demo-media-store'

export function EpisodesTab() {
  const { t } = useTranslation()
  const { episodes, isLoading, isError } = usePodcastEpisodes()
  const deleteEpisode = useDeletePodcastEpisode()
  const retryEpisode = useRetryPodcastEpisode()
  const clearDemoTask = useDemoMediaStore((state) => state.clearTask)

  const handleDelete = useCallback(
    (episodeId: string) => {
      if (episodeId.startsWith('demo-podcast-')) {
        clearDemoTask('podcast')
        return Promise.resolve()
      }
      return deleteEpisode.mutateAsync(episodeId)
    },
    [clearDemoTask, deleteEpisode]
  )

  const handleRetry = useCallback(
    async (episodeId: string) => { await retryEpisode.mutateAsync(episodeId) },
    [retryEpisode]
  )

  const emptyState = !isLoading && episodes.length === 0

  return (
    <div className="space-y-5">
      {isError ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('podcasts.loadErrorTitle')}</AlertTitle>
          <AlertDescription>
            {t('podcasts.loadErrorDesc')}
          </AlertDescription>
        </Alert>
      ) : null}

      {isLoading ? (
        <div className="flex items-center gap-3 rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t('podcasts.loadingEpisodes')}
        </div>
      ) : null}

      {emptyState ? (
        <EmptyState
          icon={Mic}
          title={t('podcasts.noEpisodesYet')}
          description={t('podcasts.createFirst')}
        />
      ) : null}

      {!isLoading && episodes.length > 0 && (
        <div className="grid gap-5 md:grid-cols-2">
          {episodes.map((episode) => (
            <EpisodeCard
              key={episode.id}
              episode={episode}
              onDelete={handleDelete}
              deleting={deleteEpisode.isPending}
              onRetry={handleRetry}
              retrying={retryEpisode.isPending}
            />
          ))}
        </div>
      )}
    </div>
  )
}
