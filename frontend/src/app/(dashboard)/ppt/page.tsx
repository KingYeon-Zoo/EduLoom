'use client'

import { StudioPageShell } from '@/components/studio/StudioPageShell'

export default function PptPage() {
  return (
    <StudioPageShell
      resourceType="ppt"
      titleKey="studio.types.ppt"
      descKey="studio.pptDesc"
    />
  )
}
