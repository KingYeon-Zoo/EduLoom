'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Sparkles, Loader2 } from 'lucide-react'
import { useQueries, useQueryClient } from '@tanstack/react-query'

import { GenerationDialogShell } from '@/components/studio/GenerationDialogShell'
import {
  ContentSelectionPanel,
  getSourceDefaultMode,
  hasSelections,
  type SourceMode,
  type NotebookSelection,
} from '@/components/studio/ContentSelectionPanel'
import { useNotebooks } from '@/lib/hooks/use-notebooks'
import {
  useStudioProfiles,
  useGenerateArtifact,
  useRecommendProfile,
} from '@/lib/hooks/use-studio'
import { chatApi } from '@/lib/api/chat'
import { sourcesApi } from '@/lib/api/sources'
import { notesApi } from '@/lib/api/notes'
import {
  NoteResponse,
  SourceListResponse,
} from '@/lib/types/api'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { ResourceType } from '@/lib/types/studio'
import { useDemoMediaStore } from '@/lib/stores/demo-media-store'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'

interface GenerateArtifactDialogProps {
  resourceType: ResourceType
  open: boolean
  onOpenChange: (open: boolean) => void
  initialInstructions?: string
  initialNotebookId?: string
}

export function GenerateArtifactDialog({
  resourceType,
  open,
  onOpenChange,
  initialInstructions,
  initialNotebookId,
}: GenerateArtifactDialogProps) {
  const { t } = useTranslation()
  const { success, error } = useToast()
  const queryClient = useQueryClient()
  const startDemoTask = useDemoMediaStore((state) => state.startTask)

  // ---- content selection state -------------------------------------------
  const [expandedNotebooks, setExpandedNotebooks] = useState<string[]>([])
  const [selections, setSelections] = useState<
    Record<string, NotebookSelection>
  >({})
  const [isBuildingContext, setIsBuildingContext] = useState(false)
  const [tokenCount, setTokenCount] = useState<number>(0)
  const [charCount, setCharCount] = useState<number>(0)

  // ---- artifact form state -----------------------------------------------
  const [name, setName] = useState('')
  const [profileName, setProfileName] = useState('')
  const [instructions, setInstructions] = useState('')
  const [recommendReason, setRecommendReason] = useState('')

  // ---- queries -----------------------------------------------------------
  const notebooksQuery = useNotebooks()
  const { profiles } = useStudioProfiles(resourceType)
  const generate = useGenerateArtifact(resourceType)
  const recommend = useRecommendProfile(resourceType)

  const notebooks = useMemo(
    () => notebooksQuery.data ?? [],
    [notebooksQuery.data],
  )

  // Fetch sources and notes for notebooks using useQueries
  const sourcesQueries = useQueries({
    queries: notebooks.map((notebook) => ({
      queryKey: QUERY_KEYS.sources(notebook.id),
      queryFn: () => sourcesApi.list({ notebook_id: notebook.id }),
      enabled:
        open &&
        (expandedNotebooks.includes(notebook.id) ||
          hasSelections(selections[notebook.id])),
    })),
  })

  const notesQueries = useQueries({
    queries: notebooks.map((notebook) => ({
      queryKey: QUERY_KEYS.notes(notebook.id),
      queryFn: () => notesApi.list({ notebook_id: notebook.id }),
      enabled:
        open &&
        (expandedNotebooks.includes(notebook.id) ||
          hasSelections(selections[notebook.id])),
    })),
  })

  // ---- derived -----------------------------------------------------------
  const sourcesByNotebook = useMemo<Record<string, SourceListResponse[]>>(
    () => {
      const map: Record<string, SourceListResponse[]> = {}
      notebooks.forEach((notebook, index) => {
        map[notebook.id] = sourcesQueries[index]?.data ?? []
      })
      return map
    },
    [notebooks, sourcesQueries],
  )

  const notesByNotebook = useMemo<Record<string, NoteResponse[]>>(() => {
    const map: Record<string, NoteResponse[]> = {}
    notebooks.forEach((notebook, index) => {
      map[notebook.id] = notesQueries[index]?.data ?? []
    })
    return map
  }, [notebooks, notesQueries])

  const fetchingNotebookIds = useMemo(() => {
    const ids = new Set<string>()
    notebooks.forEach((notebook, index) => {
      if (sourcesQueries[index]?.isFetching) {
        ids.add(notebook.id)
      }
    })
    return ids
  }, [notebooks, sourcesQueries])

  const dataKey = useMemo(() => {
    const sourceIds = sourcesQueries
      .map((q) => q.data?.map((s) => s.id)?.join(',') ?? '')
      .join('|')
    const noteIds = notesQueries
      .map((q) => q.data?.map((n) => n.id)?.join(',') ?? '')
      .join('|')
    return `${sourceIds}::${noteIds}`
  }, [sourcesQueries, notesQueries])

  const selectedProfile = profiles.find((p) => p.name === profileName)

  const selectedNotebookSummaries = useMemo(() => {
    return notebooks.map((notebook) => {
      const selection = selections[notebook.id]
      if (!selection) {
        return { notebookId: notebook.id, sources: 0, notes: 0 }
      }
      const sourcesCount = Object.values(selection.sources).filter(
        (mode) => mode !== 'off',
      ).length
      const notesCount = Object.values(selection.notes).filter(
        (mode) => mode !== 'off',
      ).length
      return { notebookId: notebook.id, sources: sourcesCount, notes: notesCount }
    })
  }, [notebooks, selections])

  // ---- effects -----------------------------------------------------------
  // Initialise selection defaults when content loads
  useEffect(() => {
    if (!open) return

    setSelections((prev) => {
      let changed = false
      const next = { ...prev }

      notebooks.forEach((notebook, index) => {
        const sources = sourcesQueries[index]?.data
        const notes = notesQueries[index]?.data

        if (!sources && !notes) return

        if (!next[notebook.id]) {
          next[notebook.id] = { sources: {}, notes: {} }
          changed = true
        }

        if (sources) {
          const currentSources = next[notebook.id].sources
          sources.forEach((source) => {
            if (!(source.id in currentSources)) {
              currentSources[source.id] = getSourceDefaultMode(source)
              changed = true
            }
          })
        }

        if (notes) {
          const currentNotes = next[notebook.id].notes
          notes.forEach((note) => {
            if (!(note.id in currentNotes)) {
              currentNotes[note.id] = 'full'
              changed = true
            }
          })
        }
      })

      return changed ? next : prev
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, notebooks, dataKey])

  const resetState = useCallback(() => {
    setExpandedNotebooks([])
    setSelections({})
    setName('')
    setProfileName('')
    setInstructions('')
    setRecommendReason('')
    setTokenCount(0)
    setCharCount(0)
  }, [])

  useEffect(() => {
    if (!open) resetState()
  }, [open, resetState])

  // Pre-fill initial notebook when provided
  useEffect(() => {
    if (!open) return
    if (initialNotebookId) {
      // Expand and select the initial notebook
      setExpandedNotebooks((prev) =>
        prev.includes(initialNotebookId) ? prev : [...prev, initialNotebookId],
      )
    }
    if (initialInstructions) setInstructions(initialInstructions)
  }, [open, initialNotebookId, initialInstructions])

  // Update token/char counts when selections change
  useEffect(() => {
    if (!open) return

    const updateContextCounts = async () => {
      const hasAnySelections = Object.values(selections).some(
        (selection) =>
          Object.values(selection.sources).some((mode) => mode !== 'off') ||
          Object.values(selection.notes).some((mode) => mode !== 'off'),
      )

      if (!hasAnySelections) {
        setTokenCount(0)
        setCharCount(0)
        return
      }

      try {
        let totalTokens = 0
        let totalChars = 0

        for (const [notebookId, selection] of Object.entries(selections)) {
          const sourcesConfig = Object.entries(selection.sources)
            .filter(([, mode]) => mode !== 'off')
            .reduce<Record<string, string>>((acc, [sourceId, mode]) => {
              const normalizedId = sourceId.replace(/^source:/, '')
              acc[normalizedId] =
                mode === 'insights' ? 'insights' : 'full content'
              return acc
            }, {})

          const notesConfig = Object.entries(selection.notes)
            .filter(([, mode]) => mode !== 'off')
            .reduce<Record<string, string>>((acc, [noteId]) => {
              const normalizedId = noteId.replace(/^note:/, '')
              acc[normalizedId] = 'full content'
              return acc
            }, {})

          if (
            Object.keys(sourcesConfig).length === 0 &&
            Object.keys(notesConfig).length === 0
          ) {
            continue
          }

          const response = await chatApi.buildContext({
            notebook_id: notebookId,
            context_config: {
              sources: sourcesConfig,
              notes: notesConfig,
            },
          })

          totalTokens += response.token_count
          totalChars += response.char_count
        }

        setTokenCount(totalTokens)
        setCharCount(totalChars)
      } catch (err) {
        console.error('Error updating context counts:', err)
      }
    }

    updateContextCounts()
  }, [open, selections])

  // ---- handlers ----------------------------------------------------------
  const handleNotebookToggle = useCallback(
    (notebookId: string, checked: boolean | 'indeterminate') => {
      const shouldCheck = checked === 'indeterminate' ? true : checked
      const sources = sourcesByNotebook[notebookId] ?? []
      const notes = notesByNotebook[notebookId] ?? []
      setSelections((prev) => {
        if (shouldCheck) {
          const nextSources: Record<string, SourceMode> = {}
          sources.forEach((source) => {
            nextSources[source.id] = getSourceDefaultMode(source)
          })
          const nextNotes: Record<string, SourceMode> = {}
          notes.forEach((note) => {
            nextNotes[note.id] = 'full'
          })
          return {
            ...prev,
            [notebookId]: { sources: nextSources, notes: nextNotes },
          }
        }

        const clearedSources: Record<string, SourceMode> = {}
        sources.forEach((source) => {
          clearedSources[source.id] = 'off'
        })
        const clearedNotes: Record<string, SourceMode> = {}
        notes.forEach((note) => {
          clearedNotes[note.id] = 'off'
        })
        return {
          ...prev,
          [notebookId]: { sources: clearedSources, notes: clearedNotes },
        }
      })
    },
    [notesByNotebook, sourcesByNotebook],
  )

  const handleSourceModeChange = useCallback(
    (notebookId: string, sourceId: string, mode: SourceMode) => {
      setSelections((prev) => ({
        ...prev,
        [notebookId]: {
          sources: {
            ...(prev[notebookId]?.sources ?? {}),
            [sourceId]: mode,
          },
          notes: prev[notebookId]?.notes ?? {},
        },
      }))
    },
    [],
  )

  const handleNoteToggle = useCallback(
    (
      notebookId: string,
      noteId: string,
      checked: boolean | 'indeterminate',
    ) => {
      setSelections((prev) => ({
        ...prev,
        [notebookId]: {
          sources: prev[notebookId]?.sources ?? {},
          notes: {
            ...(prev[notebookId]?.notes ?? {}),
            [noteId]: checked ? 'full' : 'off',
          },
        },
      }))
    },
    [],
  )

  const buildContentFromSelections = useCallback(async () => {
    const parts: string[] = []

    for (const [notebookId, selection] of Object.entries(selections)) {
      const sourcesConfig = Object.entries(selection.sources)
        .filter(([, mode]) => mode !== 'off')
        .reduce<Record<string, string>>((acc, [sourceId, mode]) => {
          const normalizedId = sourceId.replace(/^source:/, '')
          acc[normalizedId] =
            mode === 'insights' ? 'insights' : 'full content'
          return acc
        }, {})

      const notesConfig = Object.entries(selection.notes)
        .filter(([, mode]) => mode !== 'off')
        .reduce<Record<string, string>>((acc, [noteId]) => {
          const normalizedId = noteId.replace(/^note:/, '')
          acc[normalizedId] = 'full content'
          return acc
        }, {})

      if (
        Object.keys(sourcesConfig).length === 0 &&
        Object.keys(notesConfig).length === 0
      ) {
        continue
      }

      try {
        const response = await chatApi.buildContext({
          notebook_id: notebookId,
          context_config: { sources: sourcesConfig, notes: notesConfig },
        })
        const notebookName =
          notebooks.find((nb) => nb.id === notebookId)?.name ?? notebookId
        const contextString = JSON.stringify(response.context, null, 2)
        const snippet = `${t('common.notebookLabel').replace('{name}', notebookName)}\n${contextString}`
        parts.push(snippet)
      } catch (err) {
        console.error(
          'Failed to build context for notebook',
          notebookId,
          err,
        )
        throw new Error(t('studio.buildContextFailed'))
      }
    }

    return parts.join('\n\n')
  }, [notebooks, selections, t])

  const handleRecommend = async () => {
    try {
      const result = await recommend.mutateAsync()
      if (result.recommended_profile_name) {
        setProfileName(result.recommended_profile_name)
      }
      if (result.suggested_instructions) {
        setInstructions(result.suggested_instructions)
      }
      setRecommendReason(result.reason || '')
      success(t('studio.recommendApplied'))
    } catch {
      error(t('studio.recommendFailed'))
    }
  }

  const handleSubmit = useCallback(async () => {
    if (resourceType === 'video') {
      startDemoTask('video', Date.now(), name.trim() || undefined)
      success(t('common.success'), t('demoGeneration.backgroundHint'))
      resetState()
      onOpenChange(false)
      return
    }

    if (!name.trim()) {
      error(t('studio.nameRequired'), t('studio.nameRequiredDesc'))
      return
    }

    if (!profileName) {
      error(t('studio.profileRequired'), t('studio.profileRequiredDesc'))
      return
    }

    setIsBuildingContext(true)
    try {
      const content = await buildContentFromSelections()
      if (!content.trim()) {
        error(t('studio.noContent'), t('studio.noContentDesc'))
        return
      }

      await generate.mutateAsync({
        resource_type: resourceType,
        profile_name: profileName,
        name: name.trim(),
        content,
        instructions: instructions.trim() || null,
      })

      success(t('common.success'), t('studio.generationStartedDesc'))
      resetState()
      onOpenChange(false)
    } catch (err) {
      console.error('Failed to generate artifact', err)
      error(
        t('studio.failedToStartGeneration'),
        err instanceof Error ? err.message : t('common.refreshPage'),
      )
    } finally {
      setIsBuildingContext(false)
    }
  }, [
    name,
    startDemoTask,
    profileName,
    buildContentFromSelections,
    generate,
    resourceType,
    instructions,
    onOpenChange,
    resetState,
    success,
    error,
    t,
  ])

  const isSubmitting = generate.isPending || isBuildingContext

  const handleOpenChange = (value: boolean) => {
    onOpenChange(value)
    if (!value) resetState()
  }

  const canSubmit =
    resourceType === 'video'
      ? !isSubmitting
      : !!name.trim() && !!profileName && !isSubmitting

  // ---- right panel JSX ---------------------------------------------------
  const rightPanel = (
    <>
      <div className="space-y-3">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {t('studio.settingsSection')}
        </h3>

        <div className="space-y-4">
          {/* Name */}
          <div className="space-y-2">
            <Label htmlFor="artifact-name">{t('studio.nameLabel')}</Label>
            <Input
              id="artifact-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t('studio.namePlaceholder')}
              autoComplete="off"
            />
          </div>

          {/* Preset */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>{t('studio.presetLabel')}</Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 gap-1.5 px-2 text-xs text-primary hover:text-primary"
                onClick={handleRecommend}
                disabled={recommend.isPending}
                title={t('studio.recommend')}
              >
                {recommend.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {recommend.isPending
                  ? t('studio.recommending')
                  : t('studio.recommend')}
              </Button>
            </div>
            <Select value={profileName} onValueChange={setProfileName}>
              <SelectTrigger>
                <SelectValue placeholder={t('studio.presetPlaceholder')} />
              </SelectTrigger>
              <SelectContent>
                {profiles.map((p) => (
                  <SelectItem key={p.id} value={p.name}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedProfile?.description && (
              <p className="text-xs text-muted-foreground">
                {selectedProfile.description}
              </p>
            )}
            {recommendReason && (
              <div className="flex items-start gap-1.5 rounded-md bg-primary/5 px-2.5 py-2 text-xs text-muted-foreground">
                <Sparkles className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-primary" />
                <span>
                  <span className="font-medium text-foreground">
                    {t('studio.recommendReasonLabel')}：
                  </span>
                  {recommendReason}
                </span>
              </div>
            )}
          </div>

          {/* Instructions */}
          <div className="space-y-2">
            <Label htmlFor="artifact-instructions">
              {t('studio.instructionsLabel')}
            </Label>
            <Textarea
              id="artifact-instructions"
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              onKeyDown={(e) => {
                if (
                  (e.metaKey || e.ctrlKey) &&
                  e.key === 'Enter' &&
                  canSubmit
                ) {
                  e.preventDefault()
                  handleSubmit()
                }
              }}
              placeholder={t('studio.instructionsPlaceholder')}
              className="min-h-[100px] text-xs"
              autoComplete="off"
            />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-col gap-3">
        <Button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="w-full"
        >
          {isSubmitting && (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          )}
          {isSubmitting ? t('studio.generating') : t('studio.generate')}
        </Button>
        <Button
          variant="outline"
          onClick={() => handleOpenChange(false)}
          disabled={isSubmitting}
          className="w-full"
        >
          {t('common.cancel')}
        </Button>
      </div>
    </>
  )

  // ---- render ------------------------------------------------------------
  return (
    <GenerationDialogShell
      open={open}
      onOpenChange={handleOpenChange}
      title={t(`studio.generateTitle_${resourceType}`)}
      description={t(`studio.generateDesc_${resourceType}`)}
      left={
        <ContentSelectionPanel
          notebooks={notebooks}
          isLoading={notebooksQuery.isLoading}
          selectedNotebookSummaries={selectedNotebookSummaries}
          tokenCount={tokenCount}
          charCount={charCount}
          expandedNotebooks={expandedNotebooks}
          setExpandedNotebooks={setExpandedNotebooks}
          selections={selections}
          sourcesByNotebook={sourcesByNotebook}
          notesByNotebook={notesByNotebook}
          fetchingNotebookIds={fetchingNotebookIds}
          handleNotebookToggle={handleNotebookToggle}
          handleSourceModeChange={handleSourceModeChange}
          handleNoteToggle={handleNoteToggle}
          queryClient={queryClient}
        />
      }
      right={rightPanel}
    />
  )
}
