import apiClient from './client'
import {
  LearnerProfileResponse,
  LearnerProfileUpdate,
  ProfileExtractRequest,
  ProfileExtractResponse,
} from '@/lib/types/learner-profile'

export const learnerProfileApi = {
  get: async () => {
    const response = await apiClient.get<LearnerProfileResponse>('/learner-profile')
    return response.data
  },

  update: async (data: LearnerProfileUpdate) => {
    const response = await apiClient.put<LearnerProfileResponse>('/learner-profile', data)
    return response.data
  },

  extract: async (data: ProfileExtractRequest) => {
    const response = await apiClient.post<ProfileExtractResponse>(
      '/learner-profile/extract',
      data
    )
    return response.data
  },

  reset: async () => {
    const response = await apiClient.delete<LearnerProfileResponse>('/learner-profile')
    return response.data
  },
}
