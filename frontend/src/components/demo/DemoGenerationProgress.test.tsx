import { vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it } from 'vitest'

import { DemoGenerationProgress } from '@/components/demo/DemoGenerationProgress'
import { useDemoMediaStore } from '@/lib/stores/demo-media-store'

describe('DemoGenerationProgress', () => {
  beforeEach(() => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', 'true')
    window.localStorage.clear()
    useDemoMediaStore.getState().reset()
  })

  it('shows progress and lets the user hide it without cancelling the task', () => {
    useDemoMediaStore.getState().startTask('video', Date.now(), '测试视频')
    const task = useDemoMediaStore.getState().tasks.video

    render(<DemoGenerationProgress type="video" />)

    expect(screen.getByText('demoGeneration.backgroundHint')).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0')

    fireEvent.click(
      screen.getByRole('button', { name: 'demoGeneration.close' }),
    )

    expect(useDemoMediaStore.getState().tasks.video).toEqual(task)
    expect(
      screen.queryByText('demoGeneration.backgroundHint'),
    ).not.toBeInTheDocument()
  })

  it('does not show the progress panel for a completed task', () => {
    useDemoMediaStore
      .getState()
      .startTask('podcast', Date.now() - 100_000, '已完成播客')

    render(<DemoGenerationProgress type="podcast" />)

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument()
  })
  it('关闭演示模式时不展示已持久化的任务', () => {
    vi.stubEnv('NEXT_PUBLIC_DEMO_MODE', '')
    useDemoMediaStore.getState().startTask('video', Date.now(), '旧演示')
    const { container } = render(<DemoGenerationProgress type="video" />)
    expect(container).toBeEmptyDOMElement()
  })

})
