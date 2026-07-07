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
  const { overlayOpen, forcedCollapse, setOverlayOpen } = useSidebarStore()
  const { effectiveTheme } = useTheme()
  const isDark = effectiveTheme === 'dark'

  const showScrim = forcedCollapse && overlayOpen

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* ── FloatingLines overlay — subtle wave lines over main content ── */}
      <div className="absolute inset-0 z-[5] pointer-events-none opacity-[0.12]">
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
        className="flex-1 flex flex-col min-h-0 overflow-hidden bg-background"
        style={!isDesktop ? { paddingLeft: '4rem' } : undefined}
      >
        <SetupBanner />
        {children}
      </main>
    </div>
  )
}
