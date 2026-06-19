import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { learningApi } from '@/lib/api/learning'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import {
  ACTIVE_PATH_STATUSES,
  LearningPath,
  StepStatus,
} from '@/lib/types/learning'

export function useLearningPath(notebookId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.learningPath(notebookId),
    queryFn: () => learningApi.getPath(notebookId),
    enabled: !!notebookId,
    refetchInterval: (current) => {
      const data = current.state.data as LearningPath | null | undefined
      if (!data) return false
      return ACTIVE_PATH_STATUSES.includes(data.job_status ?? 'unknown')
        ? 5_000
        : false
    },
  })
  return { ...query, path: query.data ?? null }
}

export function useGeneratePath(notebookId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: () => learningApi.generatePath(notebookId),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: QUERY_KEYS.learningPath(notebookId),
      })
      toast({
        title: t('learning.planStarted'),
        description: t('learning.planStartedDesc'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('learning.planFailed'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateStep(notebookId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({ order, status }: { order: number; status: StepStatus }) =>
      learningApi.updateStep(notebookId, order, status),
    onSuccess: (data) => {
      queryClient.setQueryData(QUERY_KEYS.learningPath(notebookId), data)
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}

export function useAssessments(notebookId: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.learningAssessments(notebookId),
    queryFn: () => learningApi.getAssessments(notebookId),
    enabled: !!notebookId,
  })
  const assessments = useMemo(() => query.data ?? [], [query.data])
  return { ...query, assessments }
}

export function useGenerateAssessment(notebookId: string) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: () => learningApi.generateAssessment(notebookId),
    onSuccess: async () => {
      toast({
        title: t('learning.assessStarted'),
        description: t('learning.assessStartedDesc'),
      })
      // Poll the assessment list a few times until the new snapshot lands.
      const refetch = () =>
        queryClient.invalidateQueries({
          queryKey: QUERY_KEYS.learningAssessments(notebookId),
        })
      setTimeout(refetch, 4_000)
      setTimeout(refetch, 10_000)
      setTimeout(refetch, 20_000)
    },
    onError: (error: unknown) => {
      toast({
        title: t('learning.assessFailed'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}

export function useAgentRoster() {
  const query = useQuery({
    queryKey: QUERY_KEYS.agentRoster,
    queryFn: () => learningApi.getAgents(),
    staleTime: 60 * 60 * 1000, // roster is effectively static
  })
  return { ...query, agents: query.data ?? [] }
}
