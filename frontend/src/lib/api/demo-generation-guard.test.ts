import { beforeEach, describe, expect, it, vi } from 'vitest'

import apiClient from '@/lib/api/client'
import {
  podcastsApi,
  resolvePodcastAssetUrl,
} from '@/lib/api/podcasts'
import { resolveStudioAssetUrl, studioApi } from '@/lib/api/studio'

vi.mock('@/lib/config', () => ({
  getApiUrl: vi.fn().mockResolvedValue('http://api.example.test'),
}))

describe('demo generation HTTP guard', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('blocks video generation before any HTTP request', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: {} } as never)

    await expect(
      studioApi.generate({
        resource_type: 'video',
        profile_name: '知识点快讲',
        name: '演示视频',
        content: '任意内容',
      }),
    ).rejects.toThrow('Demo video generation is disabled')

    expect(postSpy).not.toHaveBeenCalled()
  })

  it('keeps non-video studio generation available', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: { job_id: 'report-job' } } as never)

    await studioApi.generate({
      resource_type: 'report',
      profile_name: '综合摘要报告',
      name: '演示报告',
      content: '报告内容',
    })

    expect(postSpy).toHaveBeenCalledOnce()
  })

  it('blocks podcast generation before any HTTP request', async () => {
    const postSpy = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ data: {} } as never)

    await expect(
      podcastsApi.generatePodcast({
        episode_profile: '深度漫谈',
        speaker_profile: '双人主播',
        episode_name: '演示播客',
        content: '任意内容',
      }),
    ).rejects.toThrow('Demo podcast generation is disabled')

    expect(postSpy).not.toHaveBeenCalled()
  })

  it('serves demo media from the Next.js origin instead of the API origin', async () => {
    await expect(
      resolveStudioAssetUrl('/demo-assets/video.mp4'),
    ).resolves.toBe('/demo-assets/video.mp4')
    await expect(
      resolvePodcastAssetUrl('/demo-assets/audio.mp3'),
    ).resolves.toBe('/demo-assets/audio.mp3')
  })
})
