'use client'

import { Loader2, ChevronDown } from 'lucide-react'
import type { QueryClient } from '@tanstack/react-query'

import {
  BuildContextRequest,
  NoteResponse,
  NotebookResponse,
  SourceListResponse,
} from '@/lib/types/api'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { sourcesApi } from '@/lib/api/sources'
import { notesApi } from '@/lib/api/notes'
import { useTranslation } from '@/lib/hooks/use-translation'
import { NotebookListShell } from './NotebookListShell'
import { Checkbox } from '@/components/ui/checkbox'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceMode = 'off' | 'insights' | 'full'

export interface NotebookSelection {
  sources: Record<string, SourceMode>
  notes: Record<string, SourceMode>
}

export interface NotebookSummary {
  notebookId: string
  sources: number
  notes: number
}

export interface ContentSelectionPanelProps {
  notebooks: NotebookResponse[]
  isLoading: boolean
  selectedNotebookSummaries: NotebookSummary[]
  tokenCount: number
  charCount: number
  expandedNotebooks: string[]
  setExpandedNotebooks: (notebooks: string[]) => void
  selections: Record<string, NotebookSelection>
  sourcesByNotebook: Record<string, SourceListResponse[]>
  notesByNotebook: Record<string, NoteResponse[]>
  fetchingNotebookIds: Set<string>
  handleNotebookToggle: (
    notebookId: string,
    checked: boolean | 'indeterminate',
  ) => void
  handleSourceModeChange: (
    notebookId: string,
    sourceId: string,
    mode: SourceMode,
  ) => void
  handleNoteToggle: (
    notebookId: string,
    noteId: string,
    checked: boolean | 'indeterminate',
  ) => void
  queryClient: QueryClient
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

export function hasSelections(selection?: NotebookSelection): boolean {
  if (!selection) {
    return false
  }
  return (
    Object.values(selection.sources).some((mode) => mode !== 'off') ||
    Object.values(selection.notes).some((mode) => mode !== 'off')
  )
}

export function getSourceDefaultMode(source: SourceListResponse): SourceMode {
  return source.insights_count && source.insights_count > 0 ? 'insights' : 'full'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ContentSelectionPanel({
  notebooks,
  isLoading,
  selectedNotebookSummaries,
  tokenCount,
  charCount,
  expandedNotebooks,
  setExpandedNotebooks,
  selections,
  sourcesByNotebook,
  notesByNotebook,
  fetchingNotebookIds,
  handleNotebookToggle,
  handleSourceModeChange,
  handleNoteToggle,
  queryClient,
}: ContentSelectionPanelProps) {
  const { t, language } = useTranslation()

  // Cache all translation strings at render time to avoid repeated Proxy
  // accesses in loops — prevents infinite loop detection from triggering.
  const tr = {
    loadingNotebooks: t('podcasts.loadingNotebooks'),
    noNotebooksFoundInPodcasts: t('podcasts.noNotebooksFoundInPodcasts'),
    sources: t('podcasts.sources'),
    notes: t('podcasts.notes'),
    noContentSelected: t('podcasts.noContentSelected'),
    noContentSelectedStatus: t('podcasts.noContentSelectedStatus'),
    contentSelectedStatus: t('podcasts.contentSelectedStatus'),
    noSources: t('podcasts.noSources'),
    untitledSource: t('podcasts.untitledSource'),
    link: t('podcasts.link'),
    file: t('podcasts.file'),
    embedded: t('podcasts.embedded'),
    notEmbedded: t('podcasts.notEmbedded'),
    selectMode: t('podcasts.selectMode'),
    noNotes: t('podcasts.noNotes'),
    untitledNote: t('podcasts.untitledNote'),
    commonUpdated: t('common.updated'),
    summary: t('podcasts.summary'),
    fullContent: t('podcasts.fullContent'),
  }

  // Pre-compute source modes once to avoid repeated t.podcasts access in
  // loops.
  const sourceModes = [
    { value: 'insights', label: tr.summary },
    { value: 'full', label: tr.fullContent },
  ] as const

  return (
    <NotebookListShell
      isLoading={isLoading}
      isEmpty={notebooks.length === 0}
      loadingMessage={tr.loadingNotebooks}
      emptyMessage={tr.noNotebooksFoundInPodcasts}
    >
      <div className="p-3">
        <Accordion
                type="multiple"
                value={expandedNotebooks}
                onValueChange={(value) =>
                  setExpandedNotebooks(value as string[])
                }
                className="w-full space-y-2"
              >
              {notebooks.map(
                (notebook: NotebookResponse, index: number) => {
                  const sources = sourcesByNotebook[notebook.id] ?? []
                  const notes = notesByNotebook[notebook.id] ?? []
                  const selection = selections[notebook.id]
                  const summary = selectedNotebookSummaries[index]
                  const notebookChecked =
                    summary.sources + summary.notes > 0
                  const totalItems = sources.length + notes.length
                  const isIndeterminate =
                    notebookChecked &&
                    summary.sources + summary.notes > 0 &&
                    summary.sources + summary.notes < totalItems

                  return (
                    <AccordionItem
                      key={notebook.id}
                      value={notebook.id}
                      className="border rounded-md overflow-hidden"
                    >
                      <AccordionTrigger className="group flex items-center gap-3 px-4 py-3 hover:no-underline w-full [&>svg]:hidden">
                        {/* Div 1: Checkbox — rendered as <div> (not <button>)
                            to avoid nested-button DOM violation inside
                            AccordionTrigger which itself is a <button>. */}
                        <div
                          role="checkbox"
                          aria-checked={
                            isIndeterminate ? 'mixed' : notebookChecked
                          }
                          aria-labelledby={`notebook-label-${notebook.id}`}
                          data-state={
                            isIndeterminate
                              ? 'indeterminate'
                              : notebookChecked
                                ? 'checked'
                                : 'unchecked'
                          }
                          tabIndex={0}
                          className="peer border-input dark:bg-input/30 data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground dark:data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground dark:data-[state=indeterminate]:bg-primary data-[state=indeterminate]:border-primary focus-visible:border-ring focus-visible:ring-ring/50 size-4 shrink-0 rounded-[4px] border shadow-xs transition-shadow outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50 flex items-center justify-center cursor-pointer"
                          onClick={(event) => {
                            event.stopPropagation()
                            const nextChecked = isIndeterminate
                              ? true
                              : !notebookChecked
                            handleNotebookToggle(
                              notebook.id,
                              nextChecked,
                            )
                            queryClient.prefetchQuery({
                              queryKey: QUERY_KEYS.sources(
                                notebook.id,
                              ),
                              queryFn: () =>
                                sourcesApi.list({
                                  notebook_id: notebook.id,
                                }),
                            })
                            queryClient.prefetchQuery({
                              queryKey: QUERY_KEYS.notes(
                                notebook.id,
                              ),
                              queryFn: () =>
                                notesApi.list({
                                  notebook_id: notebook.id,
                                }),
                            })
                          }}
                          onKeyDown={(event) => {
                            if (event.key === ' ' || event.key === 'Enter') {
                              event.preventDefault()
                              event.stopPropagation()
                              const nextChecked = isIndeterminate
                                ? true
                                : !notebookChecked
                              handleNotebookToggle(
                                notebook.id,
                                nextChecked,
                              )
                              queryClient.prefetchQuery({
                                queryKey: QUERY_KEYS.sources(
                                  notebook.id,
                                ),
                                queryFn: () =>
                                  sourcesApi.list({
                                    notebook_id: notebook.id,
                                  }),
                              })
                              queryClient.prefetchQuery({
                                queryKey: QUERY_KEYS.notes(
                                  notebook.id,
                                ),
                                queryFn: () =>
                                  notesApi.list({
                                    notebook_id: notebook.id,
                                  }),
                              })
                            }
                          }}
                        >
                          {(notebookChecked || isIndeterminate) && (
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth={isIndeterminate ? 3 : 2}
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              className="size-3.5 text-current"
                            >
                              {isIndeterminate ? (
                                <line x1="8" y1="12" x2="16" y2="12" />
                              ) : (
                                <polyline points="6 12 10 16 18 8" />
                              )}
                            </svg>
                          )}
                        </div>

                        {/* Div 2: Notebook info — two rows, left-aligned */}
                        <div className="flex-1 flex flex-col items-start min-w-0 text-left">
                          <Label
                            id={`notebook-label-${notebook.id}`}
                            className="font-medium text-sm text-foreground truncate cursor-pointer"
                            onClick={(event) => event.stopPropagation()}
                          >
                            {notebook.name}
                          </Label>
                          <p className="text-xs text-muted-foreground text-left">
                            {summary.sources + summary.notes > 0
                              ? tr.contentSelectedStatus
                                  .replace('{sourceCount}', String(summary.sources))
                                  .replace('{noteCount}', String(summary.notes))
                              : tr.noContentSelectedStatus}
                          </p>
                        </div>

                        {/* Div 3: Badge + chevron — same row, centred */}
                        <div className="flex items-center justify-center gap-1 shrink-0">
                          <Badge variant="outline" className="text-xs">
                            {notebook.source_count} {tr.sources} · {notebook.note_count} {tr.notes}
                          </Badge>
                          <ChevronDown className="h-4 w-4 shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                        </div>
                      </AccordionTrigger>
                      <AccordionContent>
                        <div className="space-y-4 px-4 pb-4">
                          {/* ---- Sources ---- */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                                {tr.sources}
                              </h4>
                              {fetchingNotebookIds.has(
                                notebook.id,
                              ) && (
                                <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
                              )}
                            </div>
                            {sources.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {tr.noSources}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {sources.map(
                                  (
                                    source: SourceListResponse,
                                  ) => {
                                    const mode =
                                      selection?.sources?.[
                                        source.id
                                      ] ?? 'off'
                                    return (
                                      <div
                                        key={source.id}
                                        className="flex items-center gap-3 rounded border bg-background px-3 py-2"
                                      >
                                        <Checkbox
                                          id={`source-selection-${source.id}`}
                                          checked={
                                            mode !== 'off'
                                          }
                                          onCheckedChange={(
                                            checked,
                                          ) =>
                                            handleSourceModeChange(
                                              notebook.id,
                                              source.id,
                                              checked
                                                ? getSourceDefaultMode(
                                                    source,
                                                  )
                                                : 'off',
                                            )
                                          }
                                        />
                                        <Label
                                          htmlFor={`source-selection-${source.id}`}
                                          className="flex flex-1 flex-col gap-1 cursor-pointer"
                                        >
                                          <span className="text-sm font-medium text-foreground">
                                            {source.title ||
                                              tr.untitledSource}
                                          </span>
                                          <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                            <span>
                                              {source.asset
                                                ?.url
                                                ? tr.link
                                                : tr.file}
                                            </span>
                                            <span>•</span>
                                            <span>
                                              {source.embedded
                                                ? tr.embedded
                                                : tr.notEmbedded}
                                            </span>
                                          </div>
                                        </Label>
                                        <Select
                                          value={
                                            mode === 'off'
                                              ? 'off'
                                              : mode
                                          }
                                          onValueChange={(
                                            value,
                                          ) =>
                                            handleSourceModeChange(
                                              notebook.id,
                                              source.id,
                                              value as SourceMode,
                                            )
                                          }
                                          disabled={
                                            mode === 'off'
                                          }
                                        >
                                          <SelectTrigger className="w-[140px]">
                                            <SelectValue
                                              placeholder={
                                                tr.selectMode
                                              }
                                            />
                                          </SelectTrigger>
                                          <SelectContent>
                                            {sourceModes.map(
                                              (option) => (
                                                <SelectItem
                                                  key={
                                                    option.value
                                                  }
                                                  value={
                                                    option.value
                                                  }
                                                  disabled={
                                                    option.value ===
                                                      'insights' &&
                                                    (!source.insights_count ||
                                                      source
                                                        .insights_count ===
                                                        0)
                                                  }
                                                >
                                                  {
                                                    option.label
                                                  }
                                                </SelectItem>
                                              ),
                                            )}
                                          </SelectContent>
                                        </Select>
                                      </div>
                                    )
                                  },
                                )}
                              </div>
                            )}
                          </div>

                          <Separator />

                          {/* ---- Notes ---- */}
                          <div className="space-y-2">
                            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                              {tr.notes}
                            </h4>
                            {notes.length === 0 ? (
                              <p className="text-xs text-muted-foreground">
                                {tr.noNotes}
                              </p>
                            ) : (
                              <div className="space-y-2">
                                {notes.map(
                                  (note: NoteResponse) => {
                                    const mode =
                                      selection?.notes?.[
                                        note.id
                                      ] ?? 'off'
                                    return (
                                      <div
                                        key={note.id}
                                        className="flex items-center gap-3 rounded border bg-background px-3 py-2"
                                      >
                                        <Checkbox
                                          id={`note-selection-${note.id}`}
                                          checked={
                                            mode !== 'off'
                                          }
                                          onCheckedChange={(
                                            checked,
                                          ) =>
                                            handleNoteToggle(
                                              notebook.id,
                                              note.id,
                                              Boolean(
                                                checked,
                                              ),
                                            )
                                          }
                                        />
                                        <Label
                                          htmlFor={`note-selection-${note.id}`}
                                          className="flex flex-1 flex-col cursor-pointer"
                                        >
                                          <span className="text-sm font-medium text-foreground">
                                            {note.title ||
                                              tr.untitledNote}
                                          </span>
                                          <span className="text-xs text-muted-foreground">
                                            {
                                              tr.commonUpdated
                                            }{' '}
                                            {new Date(
                                              note.updated,
                                            ).toLocaleString(
                                              language.startsWith(
                                                'zh',
                                              )
                                                ? language
                                                : 'en-US',
                                            )}
                                          </span>
                                        </Label>
                                      </div>
                                    )
                                  },
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  )
                },
              )}
            </Accordion>
      </div>
    </NotebookListShell>
  )
}
