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
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
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
    ).rejects.toThrow('演示模式不调用真实播客生成服务')

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

describe('正常模式生成', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '')
  })
  it('默认将视频和播客请求发送到后端并返回任务', async () => {
    const post = vi.spyOn(apiClient, 'post').mockResolvedValue({ data: { job_id: '真实任务' } } as never)
    const video = { resource_type: 'video' as const, profile_name: '视频', name: '测试', content: '学习资料' }
    const podcast = { episode_profile: '播客', speaker_profile: '主播', episode_name: '测试', content: '学习资料' }
    await expect(studioApi.generate(video)).resolves.toEqual({ job_id: '真实任务' })
    await expect(podcastsApi.generatePodcast(podcast)).resolves.toEqual({ job_id: '真实任务' })
    expect(post).toHaveBeenCalledWith('/studio/generate', video)
    expect(post).toHaveBeenCalledWith('/podcasts/generate', podcast)
  })
})
