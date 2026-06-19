'use client'

import { StudioPageShell } from '@/components/studio/StudioPageShell'

export default function QuizPage() {
  return (
    <StudioPageShell
      resourceType="quiz"
      titleKey="studio.types.quiz"
      descKey="studio.quizDesc"
    />
  )
}
