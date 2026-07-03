'use client'

import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { useTranslation } from '@/lib/hooks/use-translation'
import { AppSidebar } from './AppSidebar'
import { SetupBanner } from './SetupBanner'

interface AppShellProps {
  children: React.ReactNode
}

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { overlayOpen, forcedCollapse, setOverlayOpen } = useSidebarStore()

  const showScrim = forcedCollapse && overlayOpen

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:no-underline"
      >
        {t('common.skipToContent')}
      </a>
      <AppSidebar />
      {/* Scrim overlay — dims content when sidebar expands on small screens */}
      {showScrim && (
        <div
          className="sidebar-overlay-scrim active"
          onClick={() => setOverlayOpen(false)}
        />
      )}
      <main
        id="main-content"
        className="flex-1 flex flex-col min-h-0 overflow-hidden"
        style={!isDesktop ? { paddingLeft: '4rem' } : undefined}
      >
        <SetupBanner />
        {children}
      </main>
    </div>
  )
}
