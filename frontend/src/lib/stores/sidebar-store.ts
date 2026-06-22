import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SidebarState {
  isCollapsed: boolean
  forcedCollapse: boolean
  hasManuallyToggled: boolean
  overlayOpen: boolean
  toggleCollapse: () => void
  setCollapsed: (collapsed: boolean) => void
  setForcedCollapse: (forced: boolean) => void
  setHasManuallyToggled: (toggled: boolean) => void
  setOverlayOpen: (open: boolean) => void
}

export const useSidebarStore = create<SidebarState>()(
  persist(
    (set) => ({
      isCollapsed: false,
      forcedCollapse: false,
      hasManuallyToggled: false,
      overlayOpen: false,
      toggleCollapse: () =>
        set((state) => ({
          isCollapsed: !state.isCollapsed,
          hasManuallyToggled: true,
        })),
      setCollapsed: (collapsed) => set({ isCollapsed: collapsed }),
      setForcedCollapse: (forced) => set({ forcedCollapse: forced }),
      setHasManuallyToggled: (toggled) => set({ hasManuallyToggled: toggled }),
      setOverlayOpen: (open) => set({ overlayOpen: open }),
    }),
    {
      name: 'sidebar-storage',
      partialize: (state) => ({ isCollapsed: state.isCollapsed }),
    }
  )
)