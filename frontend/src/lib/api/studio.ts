import apiClient from './client'
import { getApiUrl } from '@/lib/config'
import {
  ResourceType,
  StudioArtifact,
  StudioGenerationRequest,
  StudioGenerationResponse,
  StudioProfile,
  StudioProfileInput,
  StudioRecommendResponse,
} from '@/lib/types/studio'

/** Resolve a relative artifact file URL to an absolute one. */
export async function resolveStudioAssetUrl(
  path?: string | null
): Promise<string | undefined> {
  if (!path) return undefined
  if (/^https?:\/\//i.test(path)) return path
  const base = await getApiUrl()
  return path.startsWith('/') ? `${base}${path}` : `${base}/${path}`
}

export const studioApi = {
  listArtifacts: async (resourceType: ResourceType) => {
    const response = await apiClient.get<StudioArtifact[]>('/studio/artifacts', {
      params: { resource_type: resourceType },
    })
    return response.data
  },

  getArtifact: async (artifactId: string) => {
    const response = await apiClient.get<StudioArtifact>(
      `/studio/artifacts/${artifactId}`
    )
    return response.data
  },

  generate: async (payload: StudioGenerationRequest) => {
    const response = await apiClient.post<StudioGenerationResponse>(
      '/studio/generate',
      payload
    )
    return response.data
  },

  recommend: async (resourceType: ResourceType) => {
    const response = await apiClient.post<StudioRecommendResponse>(
      '/studio/recommend',
      { resource_type: resourceType }
    )
    return response.data
  },

  deleteArtifact: async (artifactId: string) => {
    await apiClient.delete(`/studio/artifacts/${artifactId}`)
  },

  retryArtifact: async (artifactId: string) => {
    const response = await apiClient.post<{ job_id: string; message: string }>(
      `/studio/artifacts/${artifactId}/retry`
    )
    return response.data
  },

  listProfiles: async (resourceType: ResourceType) => {
    const response = await apiClient.get<StudioProfile[]>('/studio/profiles', {
      params: { resource_type: resourceType },
    })
    return response.data
  },

  createProfile: async (payload: StudioProfileInput) => {
    const response = await apiClient.post<StudioProfile>('/studio/profiles', payload)
    return response.data
  },

  updateProfile: async (profileId: string, payload: StudioProfileInput) => {
    const response = await apiClient.put<StudioProfile>(
      `/studio/profiles/${profileId}`,
      payload
    )
    return response.data
  },

  deleteProfile: async (profileId: string) => {
    await apiClient.delete(`/studio/profiles/${profileId}`)
  },
}
