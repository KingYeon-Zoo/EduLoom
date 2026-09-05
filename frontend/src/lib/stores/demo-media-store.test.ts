import { beforeEach, describe, expect, it } from 'vitest'

import { useDemoMediaStore } from '@/lib/stores/demo-media-store'

describe('demo media store', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useDemoMediaStore.getState().reset()
  })

  it('starts a task with the supplied timestamp and title', () => {
    useDemoMediaStore.getState().startTask('video', 1_000, '测试视频')

    expect(useDemoMediaStore.getState().tasks.video).toMatchObject({
      id: 'demo-video-1000',
      startedAt: 1_000,
      title: '测试视频',
      durationMs: 40_000,
    })
  })

  it('dismisses progress without deleting the task', () => {
    useDemoMediaStore.getState().startTask('podcast', 2_000)
    const task = useDemoMediaStore.getState().tasks.podcast

    useDemoMediaStore.getState().dismissProgress('podcast')

    expect(useDemoMediaStore.getState().dismissedTaskIds.podcast).toBe(task?.id)
    expect(useDemoMediaStore.getState().tasks.podcast).toEqual(task)
  })

  it('clears only the selected media task', () => {
    useDemoMediaStore.getState().startTask('video', 1_000)
    useDemoMediaStore.getState().startTask('podcast', 2_000)

    useDemoMediaStore.getState().clearTask('video')

    expect(useDemoMediaStore.getState().tasks.video).toBeUndefined()
    expect(useDemoMediaStore.getState().tasks.podcast).toBeDefined()
  })
})
