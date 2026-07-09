'use client'

import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArtifactCard } from './ArtifactCard'
import {
  useArtifacts,
  useDeleteArtifact,
  useRetryArtifact,
} from '@/lib/hooks/use-studio'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'

export function ArtifactsTab({ resourceType }: { resourceType: ResourceType }) {
  const { t } = useTranslation()
  const { artifacts, isLoading } = useArtifacts(resourceType)
  const deleteArtifact = useDeleteArtifact(resourceType)
  const retryArtifact = useRetryArtifact(resourceType)

  return (
    <div className="space-y-5">
      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : artifacts.length === 0 ? (
        <div className="rounded-xl border border-dashed py-16 text-center text-muted-foreground">
          <p className="text-sm">{t('studio.emptyArtifacts')}</p>
        </div>
      ) : (
        <div className="grid gap-5 md:grid-cols-2">
          {artifacts.map((artifact) => (
            <ArtifactCard
              key={artifact.id}
              artifact={artifact}
              onDelete={(id) => deleteArtifact.mutate(id)}
              onRetry={(id) => retryArtifact.mutate(id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}
