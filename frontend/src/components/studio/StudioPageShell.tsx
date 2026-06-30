'use client'

import { useState } from 'react'
import { Sparkles, LayoutTemplate } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell'
import { Button } from '@/components/ui/button'
import { ArtifactsTab } from './ArtifactsTab'
import { StudioTemplatesTab } from './StudioTemplatesTab'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'

interface StudioPageShellProps {
  resourceType: ResourceType
  titleKey: string
  descKey: string
}

/** Shared shell for studio resource pages with two-container layout:
 * top fixed header + view toggle, bottom scrollable card grid. */
export function StudioPageShell({
  resourceType,
  titleKey,
  descKey,
}: StudioPageShellProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'artifacts' | 'templates'>('artifacts')

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto min-h-0">
        <div className="h-full flex flex-col">
          {/* Top container: fixed header + view toggle */}
          <div className="flex-shrink-0 px-6 py-6 pb-0 space-y-4">
            <header className="space-y-1">
              <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
              <p className="text-muted-foreground">{t(descKey)}</p>
            </header>

            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('studio.chooseAView')}</p>
              <div className="flex items-center gap-2">
                <Button
                  variant={activeTab === 'artifacts' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('artifacts')}
                  className="cursor-pointer"
                >
                  <Sparkles className="h-4 w-4 mr-2" />
                  {t('studio.tabArtifacts')}
                </Button>
                <Button
                  variant={activeTab === 'templates' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveTab('templates')}
                  className="cursor-pointer"
                >
                  <LayoutTemplate className="h-4 w-4 mr-2" />
                  {t('studio.tabTemplates')}
                </Button>
              </div>
            </div>
          </div>

          {/* Bottom container: fills remaining height, scrollable */}
          <div className="flex-1 overflow-y-auto px-6 py-4">
            {activeTab === 'artifacts' ? (
              <ArtifactsTab resourceType={resourceType} />
            ) : (
              <StudioTemplatesTab resourceType={resourceType} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
