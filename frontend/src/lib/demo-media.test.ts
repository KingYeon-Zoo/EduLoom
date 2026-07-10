import { describe, expect, it } from 'vitest'

import {
  DEMO_MEDIA_CONFIG,
  createDemoMediaTask,
  getDemoMediaProgress,
  toDemoPodcastEpisode,
  toDemoStudioArtifact,
} from '@/lib/demo-media'

describe('demo media timing', () => {
  it('uses the approved video and podcast durations', () => {
    expect(DEMO_MEDIA_CONFIG.video.durationMs).toBe(40_000)
    expect(DEMO_MEDIA_CONFIG.podcast.durationMs).toBe(100_000)
  })

  it('derives progress from the persisted start time', () => {
    const task = createDemoMediaTask('video', 1_000, '测试视频')

    expect(getDemoMediaProgress(task, 21_000)).toEqual({
      completed: false,
      remainingMs: 20_000,
      progress: 0.5,
    })
  })

  it('clamps progress before start and after completion', () => {
    const task = createDemoMediaTask('video', 1_000)

    expect(getDemoMediaProgress(task, 0)).toEqual({
      completed: false,
      remainingMs: 40_000,
      progress: 0,
    })
    expect(getDemoMediaProgress(task, 100_000)).toEqual({
      completed: true,
      remainingMs: 0,
      progress: 1,
    })
  })
})

describe('demo media record mapping', () => {
  it('maps a video task from running to completed', () => {
    const task = createDemoMediaTask('video', 1_000, '梯度下降演示')

    expect(toDemoStudioArtifact(task, 1_000)).toMatchObject({
      id: 'demo-video-1000',
      name: '梯度下降演示',
      resource_type: 'video',
      job_status: 'running',
      file_urls: ['/demo-assets/梯度下降.mp4'],
    })
    expect(toDemoStudioArtifact(task, 41_000).job_status).toBe('completed')
  })

  it('maps a podcast task to a playable completed episode', () => {
    const task = createDemoMediaTask('podcast', 2_000)
    const episode = toDemoPodcastEpisode(task, 102_000)

    expect(episode).toMatchObject({
      id: 'demo-podcast-2000',
      job_status: 'completed',
      audio_file: '/demo-assets/机器学习与深度学习深度漫谈.mp3',
      audio_url: null,
    })
    expect(episode.episode_profile.name).toBe('深度学习双人漫谈')
  })
})
