import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { transformationsApi } from '@/lib/api/transformations'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import {
  CreateTransformationRequest,
  UpdateTransformationRequest,
  ExecuteTransformationRequest
} from '@/lib/types/transformations'

// Add to QUERY_KEYS in query-client.ts
export const TRANSFORMATION_QUERY_KEYS = {
  transformations: ['transformations'] as const,
  transformation: (id: string) => ['transformations', id] as const,
  defaultPrompt: ['transformations', 'default-prompt'] as const,
}

export function useTransformations() {
  return useQuery({
    queryKey: TRANSFORMATION_QUERY_KEYS.transformations,
    queryFn: () => transformationsApi.list(),
  })
}

export function useTransformation(id?: string, options?: { enabled?: boolean }) {
  const transformationId = id ?? ''
  return useQuery({
    queryKey: TRANSFORMATION_QUERY_KEYS.transformation(transformationId),
    queryFn: () => transformationsApi.get(transformationId),
    enabled: !!transformationId && (options?.enabled ?? true),
  })
}

export function useCreateTransformation() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: CreateTransformationRequest) => transformationsApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFORMATION_QUERY_KEYS.transformations })
      success(
        t('common.success'),
        t('transformations.createSuccess'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorMessage(err, (key) => t(key)),
      )
    },
  })
}

export function useUpdateTransformation() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateTransformationRequest }) =>
      transformationsApi.update(id, data),
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: TRANSFORMATION_QUERY_KEYS.transformations })
      queryClient.invalidateQueries({ queryKey: TRANSFORMATION_QUERY_KEYS.transformation(id) })
      success(
        t('common.success'),
        t('transformations.updateSuccess'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorMessage(err, (key) => t(key)),
      )
    },
  })
}

export function useDeleteTransformation() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (id: string) => transformationsApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFORMATION_QUERY_KEYS.transformations })
      success(
        t('common.success'),
        t('transformations.deleteSuccess'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorMessage(err, (key) => t(key)),
      )
    },
  })
}

export function useExecuteTransformation() {
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: ExecuteTransformationRequest) => transformationsApi.execute(data),
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorMessage(err, (key) => t(key)),
      )
    },
  })
}

export function useDefaultPrompt() {
  return useQuery({
    queryKey: TRANSFORMATION_QUERY_KEYS.defaultPrompt,
    queryFn: () => transformationsApi.getDefaultPrompt(),
  })
}

export function useUpdateDefaultPrompt() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (prompt: { transformation_instructions: string }) => transformationsApi.updateDefaultPrompt(prompt),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRANSFORMATION_QUERY_KEYS.defaultPrompt })
      success(
        t('common.success'),
        t('transformations.updateSuccess'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('common.error'),
        getApiErrorMessage(err, (key) => t(key)),
      )
    },
  })
}
