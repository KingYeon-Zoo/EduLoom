'use client'

import { useState } from 'react'
import { Plus, RefreshCw } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { ArtifactCard } from './ArtifactCard'
import { GenerateArtifactDialog } from './GenerateArtifactDialog'
import {
  useArtifacts,
  useDeleteArtifact,
  useRetryArtifact,
} from '@/lib/hooks/use-studio'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'

export function ArtifactsTab({ resourceType }: { resourceType: ResourceType }) {
  const { t } = useTranslation()
  const { artifacts, isLoading, refetch } = useArtifacts(resourceType)
  const deleteArtifact = useDeleteArtifact(resourceType)
  const retryArtifact = useRetryArtifact(resourceType)
  const [showDialog, setShowDialog] = useState(false)

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {t('studio.artifactCount').replace('{count}', String(artifacts.length))}
        </p>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('common.refresh')}
          </Button>
          <Button size="sm" onClick={() => setShowDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t('studio.generate')}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <LoadingSpinner />
        </div>
      ) : artifacts.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center text-muted-foreground">
          {t('studio.emptyArtifacts')}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
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

      <GenerateArtifactDialog
        resourceType={resourceType}
        open={showDialog}
        onOpenChange={setShowDialog}
      />
    </div>
  )
}
