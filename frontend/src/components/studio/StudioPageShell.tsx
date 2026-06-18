'use client'

import { useState } from 'react'

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
          >
            <TabsList>
              <TabsTrigger value="artifacts">{t('studio.tabArtifacts')}</TabsTrigger>
              <TabsTrigger value="templates">{t('studio.tabTemplates')}</TabsTrigger>
            </TabsList>
            <TabsContent value="artifacts" className="mt-4">
              <ArtifactsTab resourceType={resourceType} />
            </TabsContent>
            <TabsContent value="templates" className="mt-4">
              <StudioTemplatesTab resourceType={resourceType} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  )
}
