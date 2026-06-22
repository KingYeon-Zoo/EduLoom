'use client'

import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { AppSidebar } from './AppSidebar'
import { SetupBanner } from './SetupBanner'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { overlayOpen, forcedCollapse, setOverlayOpen } = useSidebarStore()

  const showScrim = forcedCollapse && overlayOpen

  return (
    <div className="flex h-screen overflow-hidden">
      <AppSidebar />
      {/* Scrim overlay — dims content when sidebar expands on small screens */}
      {showScrim && (
        <div
          className="sidebar-overlay-scrim active"
          onClick={() => setOverlayOpen(false)}
        />
      )}
      <main
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        style={!isDesktop ? { paddingLeft: '4rem' } : undefined}
      >
        <SetupBanner />
        {children}
      </main>
    </div>
  )
}
