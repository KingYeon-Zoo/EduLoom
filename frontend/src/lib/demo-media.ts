import type { PodcastEpisode } from '@/lib/types/podcasts'
import type { StudioArtifact } from '@/lib/types/studio'

export type DemoMediaType = 'video' | 'podcast'

export interface DemoMediaTask {
  id: string
  type: DemoMediaType
  title: string
  startedAt: number
  durationMs: number
  assetUrl: string
}

export interface DemoMediaProgress {
  completed: boolean
  remainingMs: number
  progress: number
}

export const DEMO_MEDIA_CONFIG = {
  video: {
    durationMs: 40_000,
    assetUrl: '/demo-assets/梯度下降.mp4',
    defaultTitle: '机器学习与深度学习 · 梯度下降动画讲解',
  },
  podcast: {
    durationMs: 100_000,
    assetUrl: '/demo-assets/机器学习与深度学习深度漫谈.mp3',
    defaultTitle: '机器学习与深度学习 · 深度漫谈',
  },
} as const satisfies Record<
  DemoMediaType,
  { durationMs: number; assetUrl: string; defaultTitle: string }
>

export function createDemoMediaTask(
  type: DemoMediaType,
  now = Date.now(),
  title?: string,
): DemoMediaTask {
  const config = DEMO_MEDIA_CONFIG[type]
  return {
    id: `demo-${type}-${now}`,
    type,
    title: title?.trim() || config.defaultTitle,
    startedAt: now,
    durationMs: config.durationMs,
    assetUrl: config.assetUrl,
  }
}

export function getDemoMediaProgress(
  task: DemoMediaTask,
  now = Date.now(),
): DemoMediaProgress {
  const elapsedMs = Math.max(0, now - task.startedAt)
  const remainingMs = Math.max(0, task.durationMs - elapsedMs)
  return {
    completed: remainingMs === 0,
    remainingMs,
    progress: Math.min(1, elapsedMs / task.durationMs),
  }
}

export function toDemoStudioArtifact(
  task: DemoMediaTask,
  now = Date.now(),
): StudioArtifact {
  const { completed } = getDemoMediaProgress(task, now)
  return {
    id: task.id,
    name: task.title,
    resource_type: 'video',
    profile_snapshot: {
      name: '机器学习知识点动画',
      source: 'demo',
    },
    instructions: '使用动画讲解梯度下降的核心过程。',
    content: '梯度下降通过沿损失函数负梯度方向迭代更新参数。',
    file_urls: [task.assetUrl],
    created: new Date(task.startedAt).toISOString(),
    job_status: completed ? 'completed' : 'running',
  }
}

export function toDemoPodcastEpisode(
  task: DemoMediaTask,
  now = Date.now(),
): PodcastEpisode {
  const { completed } = getDemoMediaProgress(task, now)
  return {
    id: task.id,
    name: task.title,
    episode_profile: {
      id: 'demo-episode-profile',
      name: '深度学习双人漫谈',
      description: '围绕机器学习核心概念展开的双人教学播客。',
      speaker_config: 'demo-speakers',
      language: 'zh-CN',
      default_briefing: '从梯度下降、反向传播到 Transformer 的完整学习主线。',
      num_segments: 5,
    },
    speaker_profile: {
      id: 'demo-speakers',
      name: '教学主持人与算法专家',
      description: '一问一答的中文教学对谈。',
      speakers: [
        {
          name: '晓明',
          voice_id: 'demo-host',
          backstory: '关注实践问题的学习者与主持人。',
          personality: '好奇、清晰、善于追问。',
        },
        {
          name: '陈博士',
          voice_id: 'demo-expert',
          backstory: '机器学习与深度学习方向专家。',
          personality: '严谨、耐心、善于类比。',
        },
      ],
    },
    briefing: '系统讲解机器学习与深度学习的关键知识。',
    audio_file: task.assetUrl,
    audio_url: null,
    transcript: null,
    outline: null,
    created: new Date(task.startedAt).toISOString(),
    job_status: completed ? 'completed' : 'running',
  }
}
