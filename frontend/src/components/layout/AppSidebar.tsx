'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/lib/hooks/use-auth'
import { useSidebarStore } from '@/lib/stores/sidebar-store'
import { useCreateDialogs } from '@/lib/hooks/use-create-dialogs'
import { useMediaQuery } from '@/lib/hooks/use-media-query'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import type { TFunction } from 'i18next'
import { useTranslation } from '@/lib/hooks/use-translation'
import { Separator } from '@/components/ui/separator'
import type { AppMode } from '@/lib/stores/mode-store'
import {
  Book,
  Search,
  Mic,
  Bot,
  Shuffle,
  Settings,
  LogOut,
  ChevronLeft,
  Menu,
  FileText,
  Plus,
  Wrench,
  Command,
  UserCog,
  FileBarChart,
  Video,
  Network,
  Presentation,
  FileQuestion,
  Compass,
  ArrowLeftRight,
} from 'lucide-react'

// ── Helpers ──

const ADMIN_PREFIXES = ['/settings', '/transformations', '/advanced']

function deriveMode(pathname: string | null): AppMode {
  if (!pathname) return 'feature'
  return ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) ? 'admin' : 'feature'
}

const getFeatureNav = (t: TFunction) => [
  {
    title: t('navigation.learn'),
    items: [
      { name: t('navigation.notebooks'), href: '/notebooks', icon: Book },
      { name: t('navigation.sources'), href: '/sources', icon: FileText },
      { name: t('navigation.askAndSearch'), href: '/search', icon: Search },
    ],
  },
  {
    title: t('navigation.create'),
    items: [
      { name: t('navigation.podcasts'), href: '/podcasts', icon: Mic },
      { name: t('navigation.reports'), href: '/reports', icon: FileBarChart },
      { name: t('navigation.quiz'), href: '/quiz', icon: FileQuestion },
      { name: t('navigation.videos'), href: '/videos', icon: Video },
      { name: t('navigation.mindmaps'), href: '/mindmaps', icon: Network },
      { name: t('navigation.ppt'), href: '/ppt', icon: Presentation },
    ],
  },
  {
    title: t('navigation.personal'),
    items: [
      { name: t('navigation.learnerProfile'), href: '/profile', icon: UserCog },
      { name: t('navigation.learning'), href: '/learning', icon: Compass },
    ],
  },
] as const

const getAdminNav = (t: TFunction) => [
  {
    title: t('navigation.manage'),
    items: [
      { name: t('navigation.models'), href: '/settings/api-keys', icon: Bot },
      { name: t('navigation.transformations'), href: '/transformations', icon: Shuffle },
      { name: t('navigation.settings'), href: '/settings', icon: Settings },
      { name: t('navigation.advanced'), href: '/advanced', icon: Wrench },
    ],
  },
] as const

type CreateTarget = 'source' | 'notebook' | 'podcast' | 'report' | 'quiz' | 'video' | 'mindmap' | 'ppt'
type CreateMenuPanel = 'collapsed' | 'expanded'

// ── Collapsed panel ──

function CollapsedBar({
  t, pathname, mode, handleToggle, navigation, createMenuOpen, setCreateMenuOpen,
  handleCreateSelection, logout,
}: {
  t: ReturnType<typeof useTranslation>['t']
  pathname: string | null
  mode: AppMode
  handleToggle: () => void
  navigation: ReturnType<typeof getFeatureNav>
  createMenuOpen: boolean
  setCreateMenuOpen: (v: boolean) => void
  handleCreateSelection: (target: CreateTarget) => void
  logout: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Header — hamburger toggle */}
      <div className="flex h-16 items-center justify-center px-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
            >
              <Menu className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t('sidebar.expand')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 py-2 overflow-y-auto px-2">
        {/* Create button */}
        {mode === 'feature' && (
          <div className="mb-4 px-0">
            <DropdownMenu open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
              <Tooltip>
                <TooltipTrigger asChild>
                  <DropdownMenuTrigger asChild>
                    <Button
                      onClick={() => setCreateMenuOpen(true)}
                      variant="default"
                      size="sm"
                      className="w-full justify-center px-2 bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                      aria-label={t('common.create')}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                </TooltipTrigger>
                <TooltipContent side="right">{t('common.create')}</TooltipContent>
              </Tooltip>
              <DropdownMenuContent align="end" side="right" className="w-48">
                <DropdownMenuItem onSelect={() => handleCreateSelection('source')} className="gap-2"><FileText className="h-4 w-4" />{t('navigation.sources')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('notebook')} className="gap-2"><Book className="h-4 w-4" />{t('navigation.notebooks')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleCreateSelection('podcast')} className="gap-2"><Mic className="h-4 w-4" />{t('navigation.podcasts')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleCreateSelection('report')} className="gap-2"><FileBarChart className="h-4 w-4" />{t('navigation.reports')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('quiz')} className="gap-2"><FileQuestion className="h-4 w-4" />{t('navigation.quiz')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('video')} className="gap-2"><Video className="h-4 w-4" />{t('navigation.videos')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('mindmap')} className="gap-2"><Network className="h-4 w-4" />{t('navigation.mindmaps')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('ppt')} className="gap-2"><Presentation className="h-4 w-4" />{t('navigation.ppt')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {/* Nav items — icons with tooltips */}
        {navigation.map((section, idx) => (
          <div key={section.title} className="space-y-1">
            {idx > 0 && <Separator className="my-3" />}
            {section.items.map((item) => {
              const isActive = item.href === '/settings'
                ? pathname === '/settings'
                : (pathname?.startsWith(item.href) || false)
              return (
                <Tooltip key={item.name}>
                  <TooltipTrigger asChild>
                    <Link href={item.href}>
                      <Button
                        variant={isActive ? 'secondary' : 'ghost'}
                        className={cn(
                          'w-full justify-center px-2 gap-3 text-sidebar-foreground sidebar-menu-item',
                          isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                        )}
                      >
                        <item.icon className="h-4 w-4" />
                      </Button>
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent side="right">{item.name}</TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-3 px-2">
        <div className="flex flex-col gap-2 items-center">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="ghost" size="sm" className="w-full justify-center sidebar-menu-item" asChild>
                <Link href={mode === 'feature' ? '/settings/api-keys' : '/notebooks'}>
                  <ArrowLeftRight className="h-4 w-4" />
                </Link>
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{mode === 'feature' ? t('navigation.switchToAdmin') : t('navigation.switchToFeature')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild><div><ThemeToggle iconOnly /></div></TooltipTrigger>
            <TooltipContent side="right">{t('common.theme')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild><div><LanguageToggle iconOnly /></div></TooltipTrigger>
            <TooltipContent side="right">{t('common.language')}</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button variant="outline" className="w-full justify-center sidebar-menu-item" onClick={logout} aria-label={t('common.signOut')}>
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">{t('common.signOut')}</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </div>
  )
}

// ── Expanded panel ──

function ExpandedBar({
  t, pathname, mode, handleToggle, navigation, createMenuOpen, setCreateMenuOpen,
  handleCreateSelection, isMac, logout,
}: {
  t: ReturnType<typeof useTranslation>['t']
  pathname: string | null
  mode: AppMode
  handleToggle: () => void
  navigation: ReturnType<typeof getFeatureNav>
  createMenuOpen: boolean
  setCreateMenuOpen: (v: boolean) => void
  handleCreateSelection: (target: CreateTarget) => void
  isMac: boolean
  logout: () => void
}) {
  return (
    <div className="flex h-full flex-col bg-sidebar border-r border-sidebar-border">
      {/* Header — logo + collapse toggle */}
      <div className="flex h-16 items-center justify-between px-4">
        <div className="flex-1 flex items-center px-1">
          <Image
            src="/EduLoom_logo.png"
            alt={t('common.appName')}
            width={1499}
            height={363}
            className="w-full h-auto max-h-14"
            priority
          />
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleToggle}
              className="text-sidebar-foreground hover:bg-sidebar-accent"
              data-testid="sidebar-toggle"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {t('sidebar.collapse')}
          </TooltipContent>
        </Tooltip>
      </div>

      {/* Brand accent */}
      <div className="sidebar-brand-accent mb-1" />

      {/* Mode badge */}
      <div className="text-xs font-semibold uppercase tracking-wider p-0.5 rounded text-center bg-transparent text-sidebar-foreground/60 mx-3 mb-1">
        {mode === 'feature' ? t('navigation.featureMode') : t('navigation.adminMode')}
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 py-2 overflow-y-auto px-3">
        {mode === 'feature' && (
          <div className="mb-4 px-3">
            <DropdownMenu open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
              <DropdownMenuTrigger asChild>
                <Button
                  onClick={() => setCreateMenuOpen(true)}
                  variant="default"
                  size="sm"
                  className="w-full justify-start bg-primary hover:bg-primary/90 text-primary-foreground border-0"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  {t('common.create')}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" side="bottom" className="w-48">
                <DropdownMenuItem onSelect={() => handleCreateSelection('source')} className="gap-2"><FileText className="h-4 w-4" />{t('navigation.sources')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('notebook')} className="gap-2"><Book className="h-4 w-4" />{t('navigation.notebooks')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleCreateSelection('podcast')} className="gap-2"><Mic className="h-4 w-4" />{t('navigation.podcasts')}</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => handleCreateSelection('report')} className="gap-2"><FileBarChart className="h-4 w-4" />{t('navigation.reports')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('quiz')} className="gap-2"><FileQuestion className="h-4 w-4" />{t('navigation.quiz')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('video')} className="gap-2"><Video className="h-4 w-4" />{t('navigation.videos')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('mindmap')} className="gap-2"><Network className="h-4 w-4" />{t('navigation.mindmaps')}</DropdownMenuItem>
                <DropdownMenuItem onSelect={() => handleCreateSelection('ppt')} className="gap-2"><Presentation className="h-4 w-4" />{t('navigation.ppt')}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}

        {navigation.map((section, idx) => (
          <div key={section.title} className="space-y-1">
            {idx > 0 && <Separator className="my-3" />}
            <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
              {section.title}
            </h3>
            {section.items.map((item) => {
              const isActive = item.href === '/settings'
                ? pathname === '/settings'
                : (pathname?.startsWith(item.href) || false)
              return (
                <Link key={item.name} href={item.href}>
                  <Button
                    variant={isActive ? 'secondary' : 'ghost'}
                    className={cn(
                      'w-full justify-start gap-3 text-sidebar-foreground sidebar-menu-item',
                      isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                    <span>{item.name}</span>
                  </Button>
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-sidebar-border p-3 space-y-3">
        <div className="px-3 py-1.5 text-xs text-sidebar-foreground/60">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Command className="h-3 w-3" />
              {t('common.quickActions')}
            </span>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              {isMac ? <span className="text-xs">⌘</span> : <span>Ctrl+</span>}K
            </kbd>
          </div>
          <p className="mt-1 text-[10px] text-sidebar-foreground/40">
            {t('common.quickActionsDesc')}
          </p>
        </div>

        <div className="flex flex-col gap-2 items-stretch">
          <Button variant="outline" className="w-full justify-start gap-3 sidebar-menu-item" asChild>
            <Link href={mode === 'feature' ? '/settings/api-keys' : '/notebooks'}>
              <ArrowLeftRight className="h-4 w-4" />
              {mode === 'feature' ? t('navigation.switchToAdmin') : t('navigation.switchToFeature')}
            </Link>
          </Button>
          <ThemeToggle />
          <LanguageToggle />
          <Button
            variant="outline"
            className="w-full justify-start gap-3 sidebar-menu-item"
            onClick={logout}
            aria-label={t('common.signOut')}
          >
            <LogOut className="h-4 w-4" />
            {t('common.signOut')}
          </Button>
        </div>
      </div>
    </div>
  )
}

// ── Main AppSidebar ──

export function AppSidebar() {
  const { t } = useTranslation()
  const pathname = usePathname()
  const mode = deriveMode(pathname)

  const isDesktop = useMediaQuery('(min-width: 1024px)')
  const isXl = useMediaQuery('(min-width: 1280px)')

  const {
    isCollapsed,
    forcedCollapse,
    hasManuallyToggled,
    overlayOpen,
    toggleCollapse,
    setForcedCollapse,
    setHasManuallyToggled,
    setCollapsed,
    setOverlayOpen,
  } = useSidebarStore()

  // Sync forcedCollapse with breakpoint
  useEffect(() => {
    setForcedCollapse(!isDesktop)
  }, [isDesktop, setForcedCollapse])

  // Auto-collapse on medium screens, auto-expand on large screens
  useEffect(() => {
    if (isXl && !hasManuallyToggled) {
      setCollapsed(false)
    } else if (isDesktop && !isXl && !hasManuallyToggled) {
      setCollapsed(true)
    }
  }, [isDesktop, isXl, hasManuallyToggled, setCollapsed])

  // Reset manual toggle flag when crossing genuine breakpoints
  const [prevDesktop, setPrevDesktop] = useState(isDesktop)
  const [prevXl, setPrevXl] = useState(isXl)
  useEffect(() => {
    if (isDesktop !== prevDesktop || isXl !== prevXl) {
      setHasManuallyToggled(false)
      setPrevDesktop(isDesktop)
      setPrevXl(isXl)
    }
  }, [isDesktop, isXl, prevDesktop, prevXl, setHasManuallyToggled])

  // Close overlay on navigation
  useEffect(() => {
    setOverlayOpen(false)
  }, [pathname, setOverlayOpen])

  const { logout } = useAuth()
  const {
    openSourceDialog,
    openNotebookDialog,
    openPodcastDialog,
    openReportDialog,
    openQuizDialog,
    openVideoDialog,
    openMindmapDialog,
    openPptDialog,
  } = useCreateDialogs()

  const [activeCreateMenu, setActiveCreateMenu] = useState<CreateMenuPanel | null>(null)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'))
  }, [])

  useEffect(() => {
    setActiveCreateMenu(null)
  }, [pathname])

  const effectiveCollapsed = forcedCollapse ? !overlayOpen : isCollapsed

  // Freeze tooltips briefly on window restore to prevent focus-triggered popups
  const [tooltipDelay, setTooltipDelay] = useState(0)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        setTooltipDelay(999999)
        const t = setTimeout(() => setTooltipDelay(0), 500)
        return () => clearTimeout(t)
      }
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const handleToggle = () => {
    if (forcedCollapse) {
      setOverlayOpen(!overlayOpen)
    } else {
      toggleCollapse()
    }
  }

  const handleSidebarMouseEnter = () => {
    if (forcedCollapse) setOverlayOpen(true)
  }

  const handleSidebarMouseLeave = () => {
    if (forcedCollapse) setOverlayOpen(false)
  }

  const handleCreateSelection = (target: CreateTarget) => {
    setActiveCreateMenu(null)
    const openMap: Record<CreateTarget, () => void> = {
      source: openSourceDialog,
      notebook: openNotebookDialog,
      podcast: openPodcastDialog,
      report: openReportDialog,
      quiz: openQuizDialog,
      video: openVideoDialog,
      mindmap: openMindmapDialog,
      ppt: openPptDialog,
    }
    window.requestAnimationFrame(() => {
      openMap[target]?.()
    })
  }

  const navigation = useMemo(
    () => (mode === 'feature' ? getFeatureNav(t) : getAdminNav(t)),
    [mode, t],
  )

  const sharedProps = { t, pathname, mode, handleToggle, navigation, handleCreateSelection, logout }

  return (
    <TooltipProvider delayDuration={tooltipDelay}>
      <div
        className={cn(
          'app-sidebar h-full',
          forcedCollapse && 'absolute left-0 top-0 z-40',
          forcedCollapse && overlayOpen && 'shadow-2xl',
        )}
        style={forcedCollapse ? { width: overlayOpen ? '16rem' : '4rem' } : undefined}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {effectiveCollapsed ? (
          <div className="absolute inset-y-0 left-0 z-10 w-16">
            <CollapsedBar
              {...sharedProps}
              createMenuOpen={activeCreateMenu === 'collapsed'}
              setCreateMenuOpen={(open) =>
                setActiveCreateMenu(open ? 'collapsed' : null)
              }
            />
          </div>
        ) : (
          <div className="absolute inset-y-0 left-0 z-20 w-64">
            <ExpandedBar
              {...sharedProps}
              isMac={isMac}
              createMenuOpen={activeCreateMenu === 'expanded'}
              setCreateMenuOpen={(open) =>
                setActiveCreateMenu(open ? 'expanded' : null)
              }
            />
          </div>
        )}
      </div>
    </TooltipProvider>
  )
}
