export type ResourceType = 'report' | 'quiz' | 'video' | 'mindmap' | 'ppt'

export type ArtifactStatus =
  | 'running'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'error'
  | 'pending'
  | 'submitted'
  | 'unknown'

export interface StudioProfile {
  id: string
  name: string
  resource_type: ResourceType
  description?: string | null
  default_prompt: string
  config: Record<string, unknown>
  builtin: boolean
}

export interface StudioArtifact {
  id: string
  name: string
  resource_type: ResourceType
  notebook_id?: string | null
  profile_snapshot: Record<string, unknown>
  instructions?: string | null
  content?: string | null
  file_urls: string[]
  created?: string | null
  job_status?: ArtifactStatus | null
  error_message?: string | null
}

export interface StudioGenerationRequest {
  resource_type: ResourceType
  profile_name: string
  name: string
  notebook_id?: string
  content?: string
  instructions?: string | null
}

export interface StudioGenerationResponse {
  job_id: string
  artifact_id: string
  status: string
  message: string
}

export interface StudioProfileInput {
  name: string
  resource_type: ResourceType
  description?: string | null
  default_prompt: string
  config: Record<string, unknown>
}

export interface StudioRecommendResponse {
  recommended_profile_name: string
  reason: string
  suggested_instructions: string
  profile_empty: boolean
}

export type ArtifactStatusGroup = 'running' | 'completed' | 'failed' | 'pending'
export type ArtifactStatusGroups = Record<ArtifactStatusGroup, StudioArtifact[]>

export const ACTIVE_ARTIFACT_STATUSES: ArtifactStatus[] = [
  'running',
  'processing',
  'pending',
  'submitted',
]

export const FAILED_ARTIFACT_STATUSES: ArtifactStatus[] = ['failed', 'error']

export function groupArtifactsByStatus(
  artifacts: StudioArtifact[]
): ArtifactStatusGroups {
  return artifacts.reduce<ArtifactStatusGroups>(
    (groups, artifact) => {
      const status = artifact.job_status || 'unknown'
      if (status === 'running' || status === 'processing') {
        groups.running.push(artifact)
      } else if (status === 'completed') {
        groups.completed.push(artifact)
      } else if (FAILED_ARTIFACT_STATUSES.includes(status)) {
        groups.failed.push(artifact)
      } else {
        groups.pending.push(artifact)
      }
      return groups
    },
    { running: [], completed: [], failed: [], pending: [] }
  )
}

/** Display metadata for each resource type, used across studio pages. */
export const RESOURCE_TYPE_META: Record<
  ResourceType,
  { labelKey: string; route: string }
> = {
  report: { labelKey: 'studio.types.report', route: '/reports' },
  quiz: { labelKey: 'studio.types.quiz', route: '/quiz' },
  video: { labelKey: 'studio.types.video', route: '/videos' },
  mindmap: { labelKey: 'studio.types.mindmap', route: '/mindmaps' },
  ppt: { labelKey: 'studio.types.ppt', route: '/ppt' },
}
