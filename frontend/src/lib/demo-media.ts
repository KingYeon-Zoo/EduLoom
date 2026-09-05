import type { PodcastEpisode } from '@/lib/types/podcasts'
import type { StudioArtifact } from '@/lib/types/studio'
import demoPodcastOutline from '@/lib/demo-podcast-outline.json'
import demoPodcastTranscript from '@/lib/demo-podcast-transcript.json'

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
      outline_provider: 'doubao',
      outline_model: 'doubao-seed-2-0-lite-260428',
      transcript_provider: 'doubao',
      transcript_model: 'doubao-seed-2-0-lite-260428',
      default_briefing: '从梯度下降、反向传播到 Transformer 的完整学习主线。',
      num_segments: 5,
    },
    speaker_profile: {
      id: 'demo-speakers',
      name: '教学主持人与算法专家',
      description: '一问一答的中文教学对谈。',
      tts_provider: 'doubao',
      tts_model: 'seed-tts-2.0',
      speakers: [
        {
          name: '晓明',
          voice_id: 'zh_male_qingshuangnanda_uranus_bigtts',
          backstory: '全栈工程师与技术创业者，热爱实际应用和工程落地。',
          personality: '热情务实，擅长讲解实现细节与工程权衡。',
        },
        {
          name: '陈博士',
          voice_id: 'zh_female_zhixingnv_uranus_bigtts',
          backstory: '资深 AI 研究员，擅长把复杂的技术概念讲得通俗易懂。',
          personality: '分析力强、表达清晰，善于层层追问深入技术细节。',
        },
      ],
    },
    briefing: '系统讲解机器学习与深度学习的关键知识。',
    audio_file: task.assetUrl,
    audio_url: null,
    transcript: { transcript: demoPodcastTranscript },
    outline: demoPodcastOutline,
    created: new Date(task.startedAt).toISOString(),
    job_status: completed ? 'completed' : 'running',
  }
}
