'use client'

import { StudioPageShell } from '@/components/studio/StudioPageShell'

export default function ReportsPage() {
  return (
    <StudioPageShell
      resourceType="report"
      titleKey="studio.types.report"
      descKey="studio.reportDesc"
    />
  )
}
