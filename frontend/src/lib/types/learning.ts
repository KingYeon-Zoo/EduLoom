// Learning loop types (Projects D / E - 学习路径规划/推送 + 评估/辅导)

import { ResourceType } from '@/lib/types/studio'

export type StepStatus = 'todo' | 'in_progress' | 'done'

export interface PathStep {
  title: string
  description: string
  order: number
  status: StepStatus
  objectives: string[]
  recommended_artifacts: string[]
  resource_gap?: string | null
  gap_resource_type?: ResourceType | null
  gap_prompt?: string | null
}

export type PathJobStatus =
  | 'running'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'error'
  | 'pending'
  | 'submitted'
  | 'unknown'

export interface LearningPath {
  id: string
  name: string
  notebook_id?: string | null
  summary?: string | null
  steps: PathStep[]
  profile_snapshot: Record<string, unknown>
  created?: string | null
  updated?: string | null
  job_status?: PathJobStatus | null
  error_message?: string | null
}

export interface AssessmentDimension {
  name: string
  label: string
  score: number
  comment: string
  evidence: string
}

export interface LearningAssessment {
  id: string
  notebook_id?: string | null
  dimensions: AssessmentDimension[]
  overall_comment?: string | null
  suggestions: string[]
  created?: string | null
}

export interface AgentInfo {
  key: string
  name: string
  project: string
  responsibility: string
}

export interface GenerateResponse {
  job_id: string
  status: string
  message: string
}

export const ACTIVE_PATH_STATUSES: PathJobStatus[] = [
  'running',
  'processing',
  'pending',
  'submitted',
]
