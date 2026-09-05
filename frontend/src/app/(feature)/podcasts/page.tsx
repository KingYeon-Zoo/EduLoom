'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle, Mic, LayoutTemplate, RefreshCcw, Loader2, Plus } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { SummaryStatusBar } from '@/components/common/SummaryStatusBar'
import { EpisodesTab } from '@/components/podcasts/EpisodesTab'
import { TemplatesTab } from '@/components/podcasts/TemplatesTab'
import { GeneratePodcastDialog } from '@/components/podcasts/GeneratePodcastDialog'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useEpisodeProfiles, useSpeakerProfiles, usePodcastEpisodes } from '@/lib/hooks/use-podcasts'
import { needsModelSetup } from '@/lib/types/podcasts'
import { DemoGenerationProgress } from '@/components/demo/DemoGenerationProgress'

export default function PodcastsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'workspace' | 'templates'>('workspace')
  const [showGenerateDialog, setShowGenerateDialog] = useState(false)

  const { episodeProfiles } = useEpisodeProfiles()
  const { speakerProfiles } = useSpeakerProfiles(episodeProfiles)
  const { statusCounts, refetch, isFetching } = usePodcastEpisodes()

  const hasUnconfiguredProfiles = useMemo(() => {
    return episodeProfiles.some(needsModelSetup) || speakerProfiles.some(needsModelSetup)
  }, [episodeProfiles, speakerProfiles])

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full flex flex-col">
          {/* Header — glass panel */}
          <div className="flex-shrink-0 sticky top-0 z-10 px-6 pt-6 pb-4 bg-background/80 backdrop-blur-sm shadow-sm rounded-b-xl">
            <header className="space-y-1 mb-3">
              <h1 className="text-2xl font-semibold tracking-tight">{t('podcasts.listTitle')}</h1>
              <p className="text-muted-foreground">{t('podcasts.listDesc')}</p>
            </header>

            {hasUnconfiguredProfiles && (
              <Alert className="bg-amber-50 text-amber-900 border-amber-200 mb-3">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('podcasts.setupRequired')}</AlertTitle>
                <AlertDescription>
                  {t('podcasts.setupRequiredDesc')}
                </AlertDescription>
              </Alert>
            )}

            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant={activeTab === 'workspace' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setActiveTab('workspace')}
                className="cursor-pointer rounded-full"
              >
                <Mic className="h-4 w-4 mr-2" />
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

              <Button
                variant="outline"
                size="sm"
                onClick={() => refetch()}
                disabled={isFetching}
              >
                {isFetching ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <RefreshCcw className="mr-2 h-4 w-4" />
                )}
                {t('common.refresh')}
              </Button>
              <Button size="sm" onClick={() => setShowGenerateDialog(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t('podcasts.generateBtn')}
              </Button>
            </div>
          </div>

          {/* Content — scrolls behind the glass header */}
          <div className="flex-1 px-6 pt-4 pb-6">
            <div className="mb-5">
              <DemoGenerationProgress type="podcast" />
            </div>
            {activeTab === 'templates' ? (
              <TemplatesTab />
            ) : (
              <EpisodesTab />
            )}
          </div>
        </div>
      </div>

      <GeneratePodcastDialog
        open={showGenerateDialog}
        onOpenChange={setShowGenerateDialog}
      />
    </AppShell>
  )
}
