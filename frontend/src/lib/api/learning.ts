import apiClient from './client'
import {
  AgentInfo,
  GenerateResponse,
  LearningAssessment,
  LearningPath,
  StepStatus,
} from '@/lib/types/learning'

export const learningApi = {
  getPath: async (notebookId: string) => {
    const response = await apiClient.get<LearningPath | null>('/learning/path', {
      params: { notebook_id: notebookId },
    })
    return response.data
  },

  generatePath: async (notebookId: string) => {
    const response = await apiClient.post<GenerateResponse>(
      '/learning/path/generate',
      { notebook_id: notebookId }
    )
    return response.data
  },

  updateStep: async (notebookId: string, order: number, status: StepStatus) => {
    const response = await apiClient.patch<LearningPath>('/learning/path/steps', {
      notebook_id: notebookId,
      order,
      status,
    })
    return response.data
  },

  getAssessments: async (notebookId: string) => {
    const response = await apiClient.get<LearningAssessment[]>(
      '/learning/assessments',
      { params: { notebook_id: notebookId } }
    )
    return response.data
  },

  generateAssessment: async (notebookId: string) => {
    const response = await apiClient.post<GenerateResponse>(
      '/learning/assessment/generate',
      { notebook_id: notebookId }
    )
    return response.data
  },

  getAgents: async () => {
    const response = await apiClient.get<AgentInfo[]>('/learning/agents')
    return response.data
  },
}
