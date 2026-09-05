import { create } from 'zustand'
import { persist } from 'zustand/middleware'

import {
  createDemoMediaTask,
  type DemoMediaTask,
  type DemoMediaType,
} from '@/lib/demo-media'

type DemoTaskMap = Partial<Record<DemoMediaType, DemoMediaTask>>
type DismissedTaskMap = Partial<Record<DemoMediaType, string>>

interface DemoMediaState {
  tasks: DemoTaskMap
  dismissedTaskIds: DismissedTaskMap
  startTask: (type: DemoMediaType, now?: number, title?: string) => void
  dismissProgress: (type: DemoMediaType) => void
  clearTask: (type: DemoMediaType) => void
  reset: () => void
}

export const useDemoMediaStore = create<DemoMediaState>()(
  persist(
    (set) => ({
      tasks: {},
      dismissedTaskIds: {},
      startTask: (type, now = Date.now(), title) =>
        set((state) => ({
          tasks: {
            ...state.tasks,
            [type]: createDemoMediaTask(type, now, title),
          },
          dismissedTaskIds: {
            ...state.dismissedTaskIds,
            [type]: undefined,
          },
        })),
      dismissProgress: (type) =>
        set((state) => ({
          dismissedTaskIds: {
            ...state.dismissedTaskIds,
            [type]: state.tasks[type]?.id,
          },
        })),
      clearTask: (type) =>
        set((state) => ({
          tasks: { ...state.tasks, [type]: undefined },
          dismissedTaskIds: {
            ...state.dismissedTaskIds,
            [type]: undefined,
          },
        })),
      reset: () => set({ tasks: {}, dismissedTaskIds: {} }),
    }),
    {
      name: 'eduloom-demo-media-v1',
      partialize: (state) => ({
        tasks: state.tasks,
        dismissedTaskIds: state.dismissedTaskIds,
      }),
    },
  ),
)
