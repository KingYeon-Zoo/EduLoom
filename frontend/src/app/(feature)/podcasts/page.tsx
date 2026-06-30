'use client'

import { useMemo, useState } from 'react'
import { AlertTriangle } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { EpisodesTab } from '@/components/podcasts/EpisodesTab'
import { TemplatesTab } from '@/components/podcasts/TemplatesTab'
import { Mic, LayoutTemplate } from 'lucide-react'
import { useTranslation } from '@/lib/hooks/use-translation'
import { useEpisodeProfiles, useSpeakerProfiles } from '@/lib/hooks/use-podcasts'
import { needsModelSetup } from '@/lib/types/podcasts'

export default function PodcastsPage() {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'episodes' | 'templates'>('episodes')

  const { episodeProfiles } = useEpisodeProfiles()
  const { speakerProfiles } = useSpeakerProfiles(episodeProfiles)

  const hasUnconfiguredProfiles = useMemo(() => {
    return episodeProfiles.some(needsModelSetup) || speakerProfiles.some(needsModelSetup)
  }, [episodeProfiles, speakerProfiles])

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full flex flex-col">
          {/* Top container: fixed header + view toggle */}
          <div className="flex-shrink-0 px-6 py-6 pb-0 space-y-4">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{t('podcasts.listTitle')}</h1>
              <p className="text-muted-foreground">
                {t('podcasts.listDesc')}
              </p>
            </header>

            {hasUnconfiguredProfiles ? (
              <Alert className="bg-amber-50 text-amber-900 border-amber-200">
                <AlertTriangle className="h-4 w-4" />
                <AlertTitle>{t('podcasts.setupRequired')}</AlertTitle>
                <AlertDescription>
                  {t('podcasts.setupRequiredDesc')}
                </AlertDescription>
              </Alert>
            ) : null}

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('podcasts.chooseAView')}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant={activeTab === 'episodes' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('episodes')}
                  className="cursor-pointer"
                >
                  <Mic className="h-4 w-4 mr-2" />
                  {t('podcasts.episodesTab')}
                </Button>
                <Button
                  variant={activeTab === 'templates' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('templates')}
                  className="cursor-pointer"
                >
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  {t('podcasts.templatesTab')}
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom container: fills remaining height, scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === 'episodes' ? (
              <EpisodesTab />
            ) : (
              <TemplatesTab />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
