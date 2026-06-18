import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { learnerProfileApi } from '@/lib/api/learner-profile'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorMessage } from '@/lib/utils/error-handler'
import {
  LearnerProfileUpdate,
  ProfileExtractRequest,
} from '@/lib/types/learner-profile'

export function useLearnerProfile() {
  return useQuery({
    queryKey: QUERY_KEYS.learnerProfile,
    queryFn: () => learnerProfileApi.get(),
  })
}

export function useUpdateLearnerProfile() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: LearnerProfileUpdate) => learnerProfileApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.learnerProfile })
      toast({
        title: t('common.success'),
        description: t('common.saveSuccess'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorMessage(error, (key) => t(key), 'common.error'),
        variant: 'destructive',
      })
    },
  })
}

export function useExtractLearnerProfile() {
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: ProfileExtractRequest) => learnerProfileApi.extract(data),
    onSuccess: () => {
      toast({
        title: t('common.success'),
        description: t('learnerProfile.extractSubmitted'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorMessage(error, (key) => t(key), 'common.error'),
        variant: 'destructive',
      })
    },
  })
}

export function useResetLearnerProfile() {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: () => learnerProfileApi.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.learnerProfile })
      toast({
        title: t('common.success'),
        description: t('learnerProfile.resetSuccess'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('common.error'),
        description: getApiErrorMessage(error, (key) => t(key), 'common.error'),
        variant: 'destructive',
      })
    },
  })
}
