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
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: LearnerProfileUpdate) => learnerProfileApi.update(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.learnerProfile })
      success(t('common.success'), t('common.saveSuccess'))
    },
    onError: (err: unknown) => {
      error(t('common.error'), getApiErrorMessage(err, (key) => t(key), 'common.error'))
    },
  })
}

export function useExtractLearnerProfile() {
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (data: ProfileExtractRequest) => learnerProfileApi.extract(data),
    onSuccess: () => {
      success(t('common.success'), t('learnerProfile.extractSubmitted'))
    },
    onError: (err: unknown) => {
      error(t('common.error'), getApiErrorMessage(err, (key) => t(key), 'common.error'))
    },
  })
}

export function useResetLearnerProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: () => learnerProfileApi.reset(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.learnerProfile })
      success(t('common.success'), t('learnerProfile.resetSuccess'))
    },
    onError: (err: unknown) => {
      error(t('common.error'), getApiErrorMessage(err, (key) => t(key), 'common.error'))
    },
  })
}
