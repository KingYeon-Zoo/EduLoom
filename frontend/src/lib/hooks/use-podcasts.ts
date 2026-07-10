import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { podcastsApi, EpisodeProfileInput, SpeakerProfileInput } from '@/lib/api/podcasts'
import { QUERY_KEYS } from '@/lib/api/query-client'
import { useToast } from '@/lib/hooks/use-toast'
import { useTranslation } from '@/lib/hooks/use-translation'
import { getApiErrorKey } from '@/lib/utils/error-handler'
import {
  ACTIVE_EPISODE_STATUSES,
  EpisodeProfile,
  EpisodeStatusGroups,
  PodcastEpisode,
  groupEpisodesByStatus,
  speakerUsageMap,
} from '@/lib/types/podcasts'
import { toDemoPodcastEpisode } from '@/lib/demo-media'
import { useDemoMediaStore } from '@/lib/stores/demo-media-store'

export function useLanguages() {
  return useQuery({
    queryKey: QUERY_KEYS.languages,
    queryFn: podcastsApi.listLanguages,
    staleTime: Infinity,
  })
}

export function useDoubaoVoices() {
  return useQuery({
    queryKey: QUERY_KEYS.doubaoVoices,
    queryFn: podcastsApi.listDoubaoVoices,
    staleTime: Infinity,
  })
}

interface EpisodeStatusCounts {
  total: number
  running: number
  completed: number
  failed: number
  pending: number
}

function hasActiveEpisodes(episodes: PodcastEpisode[]) {
  return episodes.some((episode) => {
    const status = episode.job_status ?? 'unknown'
    return ACTIVE_EPISODE_STATUSES.includes(status)
  })
}

export function usePodcastEpisodes(options?: { autoRefresh?: boolean }) {
  const { autoRefresh = true } = options ?? {}
  const demoTask = useDemoMediaStore((state) => state.tasks.podcast)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!demoTask) return
    const updateNow = () => setNow(Date.now())
    updateNow()
    const intervalId = window.setInterval(updateNow, 1_000)
    return () => window.clearInterval(intervalId)
  }, [demoTask])

  const query = useQuery({
    queryKey: QUERY_KEYS.podcastEpisodes,
    queryFn: podcastsApi.listEpisodes,
    refetchInterval: (current) => {
      if (!autoRefresh) {
        return false
      }

      const data = current.state.data as PodcastEpisode[] | undefined
      if (!data || data.length === 0) {
        return false
      }

      return hasActiveEpisodes(data) ? 15_000 : false
    },
  })

  const episodes = useMemo(() => {
    const apiEpisodes = query.data ?? []
    if (!demoTask) return apiEpisodes
    const demoEpisode = toDemoPodcastEpisode(demoTask, now)
    return [
      demoEpisode,
      ...apiEpisodes.filter((episode) => episode.id !== demoEpisode.id),
    ]
  }, [demoTask, now, query.data])

  const statusGroups = useMemo<EpisodeStatusGroups>(
    () => groupEpisodesByStatus(episodes),
    [episodes]
  )

  const statusCounts = useMemo<EpisodeStatusCounts>(
    () => ({
      total: episodes.length,
      running: statusGroups.running.length,
      completed: statusGroups.completed.length,
      failed: statusGroups.failed.length,
      pending: statusGroups.pending.length,
    }),
    [episodes.length, statusGroups]
  )

  const active = useMemo(() => hasActiveEpisodes(episodes), [episodes])

  return {
    ...query,
    episodes,
    statusGroups,
    statusCounts,
    hasActiveEpisodes: active,
  }
}

export function useRetryPodcastEpisode() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (episodeId: string) => podcastsApi.retryEpisode(episodeId),
    onSuccess: async () => {
      await queryClient.refetchQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.retryStarted'),
        t('podcasts.retryStartedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToRetry'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useDeletePodcastEpisode() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (episodeId: string) => podcastsApi.deleteEpisode(episodeId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.episodeDeleted'),
        t('podcasts.episodeDeletedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToDeleteEpisode'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useEpisodeProfiles() {
  const query = useQuery({
    queryKey: QUERY_KEYS.episodeProfiles,
    queryFn: podcastsApi.listEpisodeProfiles,
  })

  return {
    ...query,
    episodeProfiles: query.data ?? [],
  }
}

export function useCreateEpisodeProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (payload: EpisodeProfileInput) =>
      podcastsApi.createEpisodeProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.episodeProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.profileCreated'),
        t('podcasts.profileCreatedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToCreateProfile'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useUpdateEpisodeProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({
      profileId,
      payload,
    }: {
      profileId: string
      payload: EpisodeProfileInput
    }) => podcastsApi.updateEpisodeProfile(profileId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.episodeProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.profileUpdated'),
        t('podcasts.profileUpdatedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToUpdateProfile'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useDeleteEpisodeProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (profileId: string) => podcastsApi.deleteEpisodeProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.episodeProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.profileDeleted'),
        t('podcasts.profileDeletedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToDeleteProfile'),
        getApiErrorKey(err, t('podcasts.failedToDeleteProfileDesc')),
      )
    },
  })
}

export function useDuplicateEpisodeProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (profileId: string) =>
      podcastsApi.duplicateEpisodeProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.episodeProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.profileDuplicated'),
        t('podcasts.profileDuplicatedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToDuplicateProfile'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useSpeakerProfiles(episodeProfiles?: EpisodeProfile[]) {
  const query = useQuery({
    queryKey: QUERY_KEYS.speakerProfiles,
    queryFn: podcastsApi.listSpeakerProfiles,
  })

  const speakerProfiles = useMemo(() => query.data ?? [], [query.data])

  const usage = useMemo(
    () => speakerUsageMap(speakerProfiles, episodeProfiles),
    [speakerProfiles, episodeProfiles]
  )

  return {
    ...query,
    speakerProfiles,
    usage,
  }
}

export function useCreateSpeakerProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (payload: SpeakerProfileInput) =>
      podcastsApi.createSpeakerProfile(payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.speakerProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.episodeProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.speakerCreated'),
        t('podcasts.speakerCreatedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToCreateSpeaker'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useUpdateSpeakerProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: ({
      profileId,
      payload,
    }: {
      profileId: string
      payload: SpeakerProfileInput
    }) => podcastsApi.updateSpeakerProfile(profileId, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.speakerProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.episodeProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.speakerUpdated'),
        t('podcasts.speakerUpdatedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToUpdateSpeaker'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}

export function useDeleteSpeakerProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (profileId: string) => podcastsApi.deleteSpeakerProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.speakerProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.episodeProfiles })
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.podcastEpisodes })
      success(
        t('podcasts.speakerDeleted'),
        t('podcasts.speakerDeletedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToDeleteSpeaker'),
        getApiErrorKey(err, t('podcasts.failedToDeleteSpeakerDesc')),
      )
    },
  })
}

export function useDuplicateSpeakerProfile() {
  const queryClient = useQueryClient()
  const { success, error } = useToast()
  const { t } = useTranslation()

  return useMutation({
    mutationFn: (profileId: string) =>
      podcastsApi.duplicateSpeakerProfile(profileId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.speakerProfiles })
      success(
        t('podcasts.speakerDuplicated'),
        t('podcasts.speakerDuplicatedDesc'),
      )
    },
    onError: (err: unknown) => {
      error(
        t('podcasts.failedToDuplicateSpeaker'),
        getApiErrorKey(err, t('common.error')),
      )
    },
  })
}
