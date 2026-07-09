import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { notesApi } from '@/lib/api/notes'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import { CreateNoteRequest, UpdateNoteRequest } from '@/lib/types/api'

export function useNotes(notebookId?: string) {
  return useQuery({
    queryKey: QUERY_KEYS.notes(notebookId),
    queryFn: () => notesApi.list({ notebook_id: notebookId }),
    enabled: !!notebookId,
  })
}

export function useNote(id?: string, options?: { enabled?: boolean }) {
  const noteId = id ?? ''
  return useQuery({
    queryKey: QUERY_KEYS.note(noteId),
    queryFn: () => notesApi.get(noteId),
    enabled: !!noteId && (options?.enabled ?? true),
  })
}

export function useCreateNote() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: CreateNoteRequest) => notesApi.create(data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.notes(variables.notebook_id)
      })
      success(
        t('common.success'),
        t('notebooks.noteCreatedSuccess'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorKey(err, t('notebooks.failedToCreateNote')),
      )
    },
  })
}

export function useUpdateNote() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateNoteRequest }) =>
      notesApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.notes() })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.note(id) })
      success(
        t('common.success'),
        t('notebooks.noteUpdatedSuccess'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorKey(err, t('notebooks.failedToUpdateNote')),
      )
    },
  })
}

export function useDeleteNote() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (id: string) => notesApi.delete(id),
    onSuccess: () => {
      // Invalidate all notes queries (with and without notebook IDs)
      queryClient.invalidateQueries({ queryKey: ['notes'] })
      success(
        t('common.success'),
        t('notebooks.noteDeletedSuccess'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorKey(err, t('notebooks.failedToDeleteNote')),
      )
    },
  })
}
