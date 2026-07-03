import { useMemo } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { studioApi } from '@/lib/api/studio'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import {
  ACTIVE_ARTIFACT_STATUSES,
  ArtifactStatusGroups,
  ResourceType,
  StudioArtifact,
  StudioGenerationRequest,
  StudioProfileInput,
  groupArtifactsByStatus,
} from '@/lib/types/studio'

function hasActiveArtifacts(artifacts: StudioArtifact[]) {
  return artifacts.some((a) =>
    ACTIVE_ARTIFACT_STATUSES.includes(a.job_status ?? 'unknown')
  )
}

export function useArtifacts(resourceType: ResourceType) {
  const query = useQuery({
    queryKey: QUERY_KEYS.studioArtifacts(resourceType),
    queryFn: () => studioApi.listArtifacts(resourceType),
    refetchInterval: (current) => {
      const data = current.state.data as StudioArtifact[] | undefined
      if (!data || data.length === 0) return false
      return hasActiveArtifacts(data) ? 10_000 : false
    },
  })

  const artifacts = useMemo(() => query.data ?? [], [query.data])
  const statusGroups = useMemo<ArtifactStatusGroups>(
    () => groupArtifactsByStatus(artifacts),
    [artifacts]
  )

  return { ...query, artifacts, statusGroups }
}

export function useGenerateArtifact(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (payload: StudioGenerationRequest) => studioApi.generate(payload),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: QUERY_KEYS.studioArtifacts(resourceType),
      })
      success(
        t('studio.generationStarted'),
        t('studio.generationStartedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('studio.failedToStartGeneration'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useDeleteArtifact(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (artifactId: string) => studioApi.deleteArtifact(artifactId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studioArtifacts(resourceType),
      })
      success(t('studio.artifactDeleted'))
    },
    onError: (err: unknown) => {
      error(
        t('studio.failedToDelete'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useRetryArtifact(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (artifactId: string) => studioApi.retryArtifact(artifactId),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: QUERY_KEYS.studioArtifacts(resourceType),
      })
      success(t('studio.retryStarted'))
    },
    onError: (err: unknown) => {
      error(
        t('studio.failedToRetry'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useRecommendProfile(resourceType: ResourceType) {
  return useMutation({
    mutationFn: () => studioApi.recommend(resourceType),
  })
}

export function useStudioProfiles(resourceType: ResourceType) {
  const query = useQuery({
    queryKey: QUERY_KEYS.studioProfiles(resourceType),
    queryFn: () => studioApi.listProfiles(resourceType),
  })
  return { ...query, profiles: query.data ?? [] }
}

export function useCreateStudioProfile(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (payload: StudioProfileInput) => studioApi.createProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studioProfiles(resourceType),
      })
      success(t('studio.profileCreated'))
    },
    onError: (err: unknown) => {
      error(
        t('studio.failedToSaveProfile'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useUpdateStudioProfile(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({
      profileId,
      payload,
    }: {
      profileId: string
      payload: StudioProfileInput
    }) => studioApi.updateProfile(profileId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studioProfiles(resourceType),
      })
      success(t('studio.profileUpdated'))
    },
    onError: (err: unknown) => {
      error(
        t('studio.failedToSaveProfile'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useDeleteStudioProfile(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (profileId: string) => studioApi.deleteProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studioProfiles(resourceType),
      })
      success(t('studio.profileDeleted'))
    },
    onError: (err: unknown) => {
      error(
        t('studio.failedToDeleteProfile'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}
