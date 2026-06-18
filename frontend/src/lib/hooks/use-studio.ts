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
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (payload: StudioGenerationRequest) => studioApi.generate(payload),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: QUERY_KEYS.studioArtifacts(resourceType),
      })
      toast({
        title: t('studio.generationStarted'),
        description: t('studio.generationStartedDesc'),
      })
    },
    onError: (error: unknown) => {
      toast({
        title: t('studio.failedToStartGeneration'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteArtifact(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (artifactId: string) => studioApi.deleteArtifact(artifactId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studioArtifacts(resourceType),
      })
      toast({ title: t('studio.artifactDeleted') })
    },
    onError: (error: unknown) => {
      toast({
        title: t('studio.failedToDelete'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}

export function useRetryArtifact(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (artifactId: string) => studioApi.retryArtifact(artifactId),
    onSuccess: async () => {
      await queryClient.refetchQueries({
        queryKey: QUERY_KEYS.studioArtifacts(resourceType),
      })
      toast({ title: t('studio.retryStarted') })
    },
    onError: (error: unknown) => {
      toast({
        title: t('studio.failedToRetry'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
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
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (payload: StudioProfileInput) => studioApi.createProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studioProfiles(resourceType),
      })
      toast({ title: t('studio.profileCreated') })
    },
    onError: (error: unknown) => {
      toast({
        title: t('studio.failedToSaveProfile'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}

export function useUpdateStudioProfile(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
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
      toast({ title: t('studio.profileUpdated') })
    },
    onError: (error: unknown) => {
      toast({
        title: t('studio.failedToSaveProfile'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}

export function useDeleteStudioProfile(resourceType: ResourceType) {
  const queryClient = useQueryClient()
  const { toast } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (profileId: string) => studioApi.deleteProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: QUERY_KEYS.studioProfiles(resourceType),
      })
      toast({ title: t('studio.profileDeleted') })
    },
    onError: (error: unknown) => {
      toast({
        title: t('studio.failedToDeleteProfile'),
        description: getApiErrorKey(error, t('common.error')),
        variant: 'destructive',
      })
    },
  })
}
