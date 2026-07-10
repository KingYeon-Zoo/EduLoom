import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GeneratePodcastDialog } from '@/components/podcasts/GeneratePodcastDialog'
import { useDemoMediaStore } from '@/lib/stores/demo-media-store'

const mocks = vi.hoisted(() => ({
  generateMutateAsync: vi.fn(),
  onOpenChange: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@tanstack/react-query', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tanstack/react-query')>()
  return {
    ...actual,
    useQueries: () => [],
    useQueryClient: () => ({}),
  }
})

vi.mock('@/components/studio/GenerationDialogShell', () => ({
  GenerationDialogShell: ({ right }: { right: ReactNode }) => <div>{right}</div>,
}))

vi.mock('@/components/studio/ContentSelectionPanel', () => ({
  ContentSelectionPanel: () => null,
  getSourceDefaultMode: () => 'full',
  hasSelections: () => false,
}))

vi.mock('@/lib/hooks/use-notebooks', () => ({
  useNotebooks: () => ({ data: [], isLoading: false }),
}))

vi.mock('@/lib/hooks/use-podcasts', () => ({
  useEpisodeProfiles: () => ({ episodeProfiles: [], isLoading: false }),
  useGeneratePodcast: () => ({
    isPending: false,
    mutateAsync: mocks.generateMutateAsync,
  }),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}))

describe('demo podcast confirmation flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useDemoMediaStore.getState().reset()
    vi.clearAllMocks()
  })

  it('creates a local task without invoking podcast generation', () => {
    render(
      <GeneratePodcastDialog open onOpenChange={mocks.onOpenChange} />,
    )

    fireEvent.click(
      screen.getByRole('button', { name: 'podcasts.generate' }),
    )

    expect(mocks.generateMutateAsync).not.toHaveBeenCalled()
    expect(useDemoMediaStore.getState().tasks.podcast).toMatchObject({
      type: 'podcast',
      durationMs: 100_000,
    })
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false)
  })
})
