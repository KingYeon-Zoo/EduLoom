'use client'

import { StudioPageShell } from '@/components/studio/StudioPageShell'

export default function MindmapsPage() {
  return (
    <StudioPageShell
      resourceType="mindmap"
      titleKey="studio.types.mindmap"
      descKey="studio.mindmapDesc"
    />
  )
}
