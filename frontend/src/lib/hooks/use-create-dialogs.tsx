'use client'

import { createContext, useContext, useState, useCallback, ReactNode } from 'react'
import { AddSourceDialog } from '@/components/sources/AddSourceDialog'
import { CreateNotebookDialog } from '@/components/notebooks/CreateNotebookDialog'
import { GeneratePodcastDialog } from '@/components/podcasts/GeneratePodcastDialog'
import { GenerateArtifactDialog } from '@/components/studio/GenerateArtifactDialog'

interface CreateDialogsContextType {
  openSourceDialog: () => void
  openNotebookDialog: () => void
  openPodcastDialog: () => void
  openReportDialog: () => void
  openQuizDialog: () => void
  openVideoDialog: () => void
  openMindmapDialog: () => void
  openPptDialog: () => void
}

const CreateDialogsContext = createContext<CreateDialogsContextType | null>(null)

export function CreateDialogsProvider({ children }: { children: ReactNode }) {
  const [sourceDialogOpen, setSourceDialogOpen] = useState(false)
  const [notebookDialogOpen, setNotebookDialogOpen] = useState(false)
  const [podcastDialogOpen, setPodcastDialogOpen] = useState(false)
  const [reportDialogOpen, setReportDialogOpen] = useState(false)
  const [quizDialogOpen, setQuizDialogOpen] = useState(false)
  const [videoDialogOpen, setVideoDialogOpen] = useState(false)
  const [mindmapDialogOpen, setMindmapDialogOpen] = useState(false)
  const [pptDialogOpen, setPptDialogOpen] = useState(false)

  const openSourceDialog = useCallback(() => setSourceDialogOpen(true), [])
  const openNotebookDialog = useCallback(() => setNotebookDialogOpen(true), [])
  const openPodcastDialog = useCallback(() => setPodcastDialogOpen(true), [])
  const openReportDialog = useCallback(() => setReportDialogOpen(true), [])
  const openQuizDialog = useCallback(() => setQuizDialogOpen(true), [])
  const openVideoDialog = useCallback(() => setVideoDialogOpen(true), [])
  const openMindmapDialog = useCallback(() => setMindmapDialogOpen(true), [])
  const openPptDialog = useCallback(() => setPptDialogOpen(true), [])

  return (
    <CreateDialogsContext.Provider
      value={{
        openSourceDialog,
        openNotebookDialog,
        openPodcastDialog,
        openReportDialog,
        openQuizDialog,
        openVideoDialog,
        openMindmapDialog,
        openPptDialog,
      }}
    >
      {children}
      <AddSourceDialog open={sourceDialogOpen} onOpenChange={setSourceDialogOpen} />
      <CreateNotebookDialog open={notebookDialogOpen} onOpenChange={setNotebookDialogOpen} />
      <GeneratePodcastDialog open={podcastDialogOpen} onOpenChange={setPodcastDialogOpen} />
      <GenerateArtifactDialog resourceType="report" open={reportDialogOpen} onOpenChange={setReportDialogOpen} />
      <GenerateArtifactDialog resourceType="quiz" open={quizDialogOpen} onOpenChange={setQuizDialogOpen} />
      <GenerateArtifactDialog resourceType="video" open={videoDialogOpen} onOpenChange={setVideoDialogOpen} />
      <GenerateArtifactDialog resourceType="mindmap" open={mindmapDialogOpen} onOpenChange={setMindmapDialogOpen} />
      <GenerateArtifactDialog resourceType="ppt" open={pptDialogOpen} onOpenChange={setPptDialogOpen} />
    </CreateDialogsContext.Provider>
  )
}

export function useCreateDialogs() {
  const context = useContext(CreateDialogsContext)
  if (!context) {
    throw new Error('useCreateDialogs must be used within a CreateDialogsProvider')
  }
  return context
}
