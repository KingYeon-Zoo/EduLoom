'use client'

import { useState } from 'react'
import { Sparkles, LayoutTemplate } from 'lucide-react'

import { AppShell } from '@/components/layout/AppShell'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ArtifactsTab } from './ArtifactsTab'
import { StudioTemplatesTab } from './StudioTemplatesTab'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'

interface StudioPageShellProps {
  resourceType: ResourceType
  titleKey: string
  descKey: string
}

/** Shared shell for the four studio resource pages: an Artifacts tab + a
 * Templates (presets) tab, parameterized by resource type. */
export function StudioPageShell({
  resourceType,
  titleKey,
  descKey,
}: StudioPageShellProps) {
  const { t } = useTranslation()
  const [activeTab, setActiveTab] = useState<'artifacts' | 'templates'>('artifacts')

  return (
    <AppShell>
      <div className="flex-1 overflow-y-auto">
        <div className="px-6 py-6 space-y-6">
          <header className="space-y-1">
            <h1 className="text-2xl font-semibold tracking-tight">{t(titleKey)}</h1>
            <p className="text-muted-foreground">{t(descKey)}</p>
          </header>

          <Tabs
            value={activeTab}
            onValueChange={(v) => setActiveTab(v as 'artifacts' | 'templates')}
            className="space-y-6"
          >
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('studio.chooseAView')}</p>
              <TabsList aria-label={t('common.accessibility.transformationViews')} className="w-full max-w-md">
                <TabsTrigger value="artifacts">
                  <Sparkles className="h-4 w-4" />
                  {t('studio.tabArtifacts')}
                </TabsTrigger>
                <TabsTrigger value="templates">
                  <LayoutTemplate className="h-4 w-4" />
                  {t('studio.tabTemplates')}
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent value="artifacts">
              <ArtifactsTab resourceType={resourceType} />
            </TabsContent>
            <TabsContent value="templates">
              <StudioTemplatesTab resourceType={resourceType} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  )
}
