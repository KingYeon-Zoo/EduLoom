'use client'

import { useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Sparkles, LayoutTemplate, RefreshCw, Plus } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { SummaryStatusBar } from '@/components/common/SummaryStatusBar'
import { ArtifactsTab } from './ArtifactsTab'
import { StudioTemplatesTab } from './StudioTemplatesTab'
import { GenerateArtifactDialog } from './GenerateArtifactDialog'
import { useArtifacts } from '@/lib/hooks/use-studio'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'
import { DemoGenerationProgress } from '@/components/demo/DemoGenerationProgress'

interface StudioPageShellProps {
  resourceType: ResourceType
  titleKey: string
  descKey: string
}

export function StudioPageShell({
  resourceType,
  titleKey,
  descKey,
}: StudioPageShellProps) {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [activeTab, setActiveTab] = useState<'workspace' | 'templates'>('workspace')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)
  const [prefillInstructions, setPrefillInstructions] = useState<string | undefined>()
  const [prefillNotebookId, setPrefillNotebookId] = useState<string | undefined>()
  const { artifacts, statusGroups, refetch } = useArtifacts(resourceType)

  // Handle sessionStorage handoff from notebook context menu
  useEffect(() => {
    if (searchParams.get('prefill') !== '1') return
    try {
      const raw = sessionStorage.getItem('studio_prefill')
      if (raw) {
        const data = JSON.parse(raw) as {
          resourceType: ResourceType
          notebookId: string
          instructions: string
        }
        if (data.resourceType === resourceType) {
          setPrefillNotebookId(data.notebookId)
          setPrefillInstructions(data.instructions)
          setShowGenerateDialog(true)
        }
        sessionStorage.removeItem('studio_prefill')
      }
    } catch {
      // ignore malformed handoff
    }
    router.replace(window.location.pathname)
  }, [searchParams, resourceType, router])

  const statusCounts = {
    total: artifacts.length,
    running: statusGroups.running.length,
    completed: statusGroups.completed.length,
    failed: statusGroups.failed.length,
    pending: statusGroups.pending.length,
  }

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full flex flex-col">
          {/* Header — glass panel */}
          <div className="flex-shrink-0 sticky top-0 z-10 px-6 pt-6 pb-4 bg-background/80 backdrop-blur-sm shadow-sm rounded-b-xl">
            <header className="space-y-1 mb-3">
              <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
              <p className="text-muted-foreground">{t(descKey)}</p>
            </header>

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={activeTab === 'workspace' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('workspace')}
                className="cursor-pointer rounded-full"
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t('common.workspace')}
              </Button>
              <Button
                variant={activeTab === 'templates' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('templates')}
                className="cursor-pointer rounded-full"
              >
                <LayoutTemplate className="h-4 w-4 mr-2" />
                {t('common.templates')}
              </Button>

              <SummaryStatusBar
                total={statusCounts.total}
                running={statusCounts.running}
                completed={statusCounts.completed}
                failed={statusCounts.failed}
                pending={statusCounts.pending}
              />

              <div className="flex-1" />

              <Button variant="outline" size="sm" onClick={() => refetch()}>
                <RefreshCw className="mr-2 h-4 w-4" />
                {t('common.refresh')}
              </Button>
              <Button
                size="sm"
                onClick={() => {
                  setPrefillInstructions(undefined)
                  setPrefillNotebookId(undefined)
                  setShowGenerateDialog(true)
                }}
              >
                <Plus className="mr-2 h-4 w-4" />
                {t('studio.generate')}
              </Button>
            </div>
          </div>

          {/* Content — scrolls behind the glass header */}
          <div className="flex-1 px-6 pt-4 pb-6">
            {resourceType === 'video' && (
              <div className="mb-5">
                <DemoGenerationProgress type="video" />
              </div>
            )}
            {activeTab === 'templates' ? (
              <StudioTemplatesTab resourceType={resourceType} />
            ) : (
              <ArtifactsTab resourceType={resourceType} />
            )}
          </div>
        </div>
      </div>

      <GenerateArtifactDialog
        resourceType={resourceType}
        open={showGenerateDialog}
        onOpenChange={(open) => {
          setShowGenerateDialog(open)
          if (!open) {
            setPrefillInstructions(undefined)
            setPrefillNotebookId(undefined)
          }
        }}
        initialInstructions={prefillInstructions}
        initialNotebookId={prefillNotebookId}
      />
    </AppShell>
  )
}
