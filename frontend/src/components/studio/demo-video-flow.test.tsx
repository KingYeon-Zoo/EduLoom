import type { ReactNode } from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { GenerateArtifactDialog } from '@/components/studio/GenerateArtifactDialog'
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

vi.mock('@/lib/hooks/use-studio', () => ({
  useStudioProfiles: () => ({ profiles: [] }),
  useGenerateArtifact: () => ({
    isPending: false,
    mutateAsync: mocks.generateMutateAsync,
  }),
  useRecommendProfile: () => ({ isPending: false, mutateAsync: vi.fn() }),
}))

vi.mock('@/lib/hooks/use-toast', () => ({
  useToast: () => ({ success: mocks.success, error: mocks.error }),
}))

describe('demo video confirmation flow', () => {
  beforeEach(() => {
    window.localStorage.clear()
    useDemoMediaStore.getState().reset()
    vi.clearAllMocks()
  })

  it('creates a local task without invoking studio generation', () => {
    render(
      <GenerateArtifactDialog
        resourceType="video"
        open
        onOpenChange={mocks.onOpenChange}
      />,
    )

    const generateButton = screen.getByRole('button', {
      name: 'studio.generate',
    })
    expect(generateButton).toBeEnabled()

    fireEvent.click(generateButton)

    expect(mocks.generateMutateAsync).not.toHaveBeenCalled()
    expect(useDemoMediaStore.getState().tasks.video).toMatchObject({
      type: 'video',
      durationMs: 40_000,
    })
    expect(mocks.onOpenChange).toHaveBeenCalledWith(false)
  })
})
