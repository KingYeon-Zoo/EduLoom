'use client'

import { StudioPageShell } from '@/components/studio/StudioPageShell'

export default function VideosPage() {
  return (
    <StudioPageShell
      resourceType="video"
      titleKey="studio.types.video"
      descKey="studio.videoDesc"
    />
  )
}
