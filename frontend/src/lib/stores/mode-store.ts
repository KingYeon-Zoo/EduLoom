import { create } from 'zustand'

export type AppMode = 'feature' | 'admin'

interface ModeStore {
  mode: AppMode
  setMode: (mode: AppMode) => void
}

export const useModeStore = create<ModeStore>()((set) => ({
  mode: 'feature',
  setMode: (mode) => set({ mode }),
}))
