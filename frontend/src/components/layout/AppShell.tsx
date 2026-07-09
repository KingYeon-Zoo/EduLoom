'use client'

import { useMediaQuery } from '@/lib/hooks/use-media-query'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { useTheme } from '@/lib/stores/theme-store'
import { useTranslation } from '@/lib/hooks/use-translation'
import { AppSidebar } from './AppSidebar'
import { SetupBanner } from './SetupBanner'
import FloatingLines from '@/components/FloatingLines'

interface AppShellProps {
  children: React.ReactNode
}

const DARK_GRADIENT = ['#5d45f5', '#5227FF', '#A6C8FF']
const LIGHT_GRADIENT = ['#b91c1c', '#78350f', '#14532d']

export function AppShell({ children }: AppShellProps) {
  const { t } = useTranslation()
  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const { isCollapsed, overlayOpen, forcedCollapse, setOverlayOpen } = useSidebarStore()
  const { effectiveTheme } = useTheme()
  const isDark = effectiveTheme === 'dark'

  const showScrim = forcedCollapse && overlayOpen
  const effectiveCollapsed = forcedCollapse ? !overlayOpen : isCollapsed

  return (
    <div className="h-screen overflow-hidden">
      {/* ── FloatingLines overlay — subtle wave lines over main content ── */}
      <div className="fixed inset-0 z-[5] pointer-events-none opacity-[0.12]">
        <FloatingLines
          enabledWaves={['bottom', 'top', 'middle']}
          lineCount={8}
          lineDistance={27.5}
          bendRadius={7.5}
          bendStrength={-1.5}
          interactive={false}
          parallax={true}
          animationSpeed={0.6}
          linesGradient={isDark ? DARK_GRADIENT : LIGHT_GRADIENT}
          mixBlendMode="normal"
        />
      </div>

      {/* Skip-to-content link for keyboard users */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-primary focus:text-primary-foreground focus:rounded-md focus:outline-none focus:ring-2 focus:ring-ring focus:no-underline"
      >
        {t('common.skipToContent')}
      </a>

      {/* Sidebar container — fixed left, w-16; ExpandedBar overflows to w-64 when visible */}
      <div className="fixed left-0 top-0 h-full z-40 w-16">
        <AppSidebar />
      </div>

      {/* Scrim overlay — dims content when sidebar expands on small screens */}
      {showScrim && (
        <div
          className="sidebar-overlay-scrim active"
          onClick={() => setOverlayOpen(false)}
        />
      )}

      {/* Main content — margin-left follows sidebar width.
           Desktop: transitions between collapsed (4rem) and expanded (16rem).
           Mobile (overlay): always 4rem for the collapsed bar. */}
      <main
        id="main-content"
        className="flex flex-col min-h-0 overflow-hidden bg-background h-full transition-[margin-left] duration-300 ease-out"
        style={{
          marginLeft: isDesktop
            ? (effectiveCollapsed ? '4rem' : '16rem')
            : '4rem'
        }}
      >
        <SetupBanner />
        {children}
      </main>
    </div>
  )
}
