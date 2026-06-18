// Learner profile types (Project B - 对话式学习画像)

export interface ProfileEntry {
  content: string
  confidence: number
  provenance: string
  created?: string | null
  updated?: string | null
}

// dimension key -> entries
export type ProfileDimensions = Record<string, ProfileEntry[]>

export interface LearnerProfileResponse {
  dimensions: ProfileDimensions
  labels: Record<string, string>
}

export interface LearnerProfileUpdate {
  dimensions: ProfileDimensions
}

export interface ProfileExtractRequest {
  conversation: string
  session_id?: string
}

export interface ProfileExtractResponse {
  command_id: string
}

// Fixed dimension order for display (mirrors backend PROFILE_DIMENSIONS).
export const PROFILE_DIMENSION_ORDER: string[] = [
  'knowledge_base',
  'cognitive_style',
  'error_prone',
  'learning_goals',
  'learning_progress',
  'learning_interests',
]
