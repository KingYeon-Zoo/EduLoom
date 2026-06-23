'use client'

import { useState, useEffect } from 'react'
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

// Routes belonging to the management/admin side
const ADMIN_PREFIXES = ['/settings', '/transformations', '/advanced']

function deriveMode(pathname: string | null): AppMode {
  if (!pathname) return 'feature'
  return ADMIN_PREFIXES.some((p) => pathname.startsWith(p)) ? 'admin' : 'feature'
}

const getFeatureNav = (t: TFunction) => [
  {
    title: t('navigation.collect'),
    items: [
      { name: t('navigation.sources'), href: '/sources', icon: FileText },
    ],
  },
  {
    title: t('navigation.process'),
    items: [
      { name: t('navigation.notebooks'), href: '/notebooks', icon: Book },
      { name: t('navigation.askAndSearch'), href: '/search', icon: Search },
      { name: t('navigation.learnerProfile'), href: '/profile', icon: UserCog },
      { name: t('navigation.learning'), href: '/learning', icon: Compass },
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
  // Only applies when user hasn't manually toggled
  useEffect(() => {
    if (isXl && !hasManuallyToggled) {
      setCollapsed(false)
    } else if (isDesktop && !isXl && !hasManuallyToggled) {
      setCollapsed(true)
    }
  }, [isDesktop, isXl, hasManuallyToggled, setCollapsed])

  // Reset manual toggle flag when crossing breakpoints (so auto-behavior resumes)
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

  const featureNav = getFeatureNav(t)
  const adminNav = getAdminNav(t)
  const navigation = mode === 'feature' ? featureNav : adminNav

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

  const [createMenuOpen, setCreateMenuOpen] = useState(false)
  const [isMac, setIsMac] = useState(true)

  useEffect(() => {
    setIsMac(navigator.platform.toLowerCase().includes('mac'))
  }, [])

  // Effective collapsed state: overlay mode overrides manual collapse
  const effectiveCollapsed = forcedCollapse ? !overlayOpen : isCollapsed

  const handleToggle = () => {
    if (forcedCollapse) {
      setOverlayOpen(!overlayOpen)
    } else {
      toggleCollapse()
    }
  }

  const handleSidebarMouseEnter = () => {
    if (forcedCollapse) {
      setOverlayOpen(true)
    }
  }

  const handleSidebarMouseLeave = () => {
    if (forcedCollapse) {
      setOverlayOpen(false)
    }
  }

  const handleCreateSelection = (target: CreateTarget) => {
    setCreateMenuOpen(false)

    if (target === 'source') {
      openSourceDialog()
    } else if (target === 'notebook') {
      openNotebookDialog()
    } else if (target === 'podcast') {
      openPodcastDialog()
    } else if (target === 'report') {
      openReportDialog()
    } else if (target === 'quiz') {
      openQuizDialog()
    } else if (target === 'video') {
      openVideoDialog()
    } else if (target === 'mindmap') {
      openMindmapDialog()
    } else if (target === 'ppt') {
      openPptDialog()
    }
  }

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn(
          'app-sidebar flex h-full flex-col bg-sidebar border-sidebar-border border-r transition-all duration-300',
          forcedCollapse && 'absolute left-0 top-0 z-40',
          forcedCollapse && overlayOpen && 'shadow-2xl',
          effectiveCollapsed ? 'w-16' : 'w-64'
        )}
        onMouseEnter={handleSidebarMouseEnter}
        onMouseLeave={handleSidebarMouseLeave}
      >
        {/* Logo / Header */}
        <div
          className={cn(
            'flex h-16 items-center group',
            effectiveCollapsed ? 'justify-center px-2' : 'justify-between px-4'
          )}
        >
          {effectiveCollapsed ? (
            <div className="relative flex items-center justify-center w-full">
              <Image
                src="/logo.png"
                alt="EduLoom"
                width={28}
                height={28}
                className="transition-opacity group-hover:opacity-0"
              />
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                className="absolute text-sidebar-foreground hover:bg-sidebar-accent opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Menu className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <>
              <div className="flex-1 flex items-center px-1">
                <Image
                  src="/pure_logo.png"
                  alt={t('common.appName')}
                  width={1672}
                  height={554}
                  className="w-full h-auto max-h-14"
                  priority
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={handleToggle}
                className="text-sidebar-foreground hover:bg-sidebar-accent"
                data-testid="sidebar-toggle"
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
            </>
          )}
        </div>

        {/* Mode badge */}
        {!effectiveCollapsed && (
          <div
            className={cn(
              'text-xs font-semibold uppercase tracking-wider p-0.5 rounded text-center bg-transparent text-sidebar-foreground/60 mx-3 mb-1',
            )}
          >
            {mode === 'feature' ? '学习前台' : '管理后台'}
          </div>
        )}

        {/* Navigation */}
        <nav
          className={cn(
            'flex-1 space-y-1 py-2 overflow-y-auto',
            effectiveCollapsed ? 'px-2' : 'px-3'
          )}
        >
          {/* Create button — feature mode only */}
          {mode === 'feature' && (
            <div
              className={cn(
                'mb-4',
                effectiveCollapsed ? 'px-0' : 'px-3'
              )}
            >
              <DropdownMenu open={createMenuOpen} onOpenChange={setCreateMenuOpen}>
                {effectiveCollapsed ? (
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
                ) : (
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
                )}

                <DropdownMenuContent
                  align={effectiveCollapsed ? 'end' : 'start'}
                  side={effectiveCollapsed ? 'right' : 'bottom'}
                  className="w-48"
                >
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('source')
                    }}
                    className="gap-2"
                  >
                    <FileText className="h-4 w-4" />
                    {t('common.source')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('notebook')
                    }}
                    className="gap-2"
                  >
                    <Book className="h-4 w-4" />
                    {t('common.notebook')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('podcast')
                    }}
                    className="gap-2"
                  >
                    <Mic className="h-4 w-4" />
                    {t('common.podcast')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('report')
                    }}
                    className="gap-2"
                  >
                    <FileBarChart className="h-4 w-4" />
                    {t('navigation.reports')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('quiz')
                    }}
                    className="gap-2"
                  >
                    <FileQuestion className="h-4 w-4" />
                    {t('navigation.quiz')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('video')
                    }}
                    className="gap-2"
                  >
                    <Video className="h-4 w-4" />
                    {t('navigation.videos')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('mindmap')
                    }}
                    className="gap-2"
                  >
                    <Network className="h-4 w-4" />
                    {t('navigation.mindmaps')}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onSelect={(event) => {
                      event.preventDefault()
                      handleCreateSelection('ppt')
                    }}
                    className="gap-2"
                  >
                    <Presentation className="h-4 w-4" />
                    {t('navigation.ppt')}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}

          {/* Nav sections */}
          {navigation.map((section, index) => (
            <div key={section.title}>
              {index > 0 && (
                <Separator className="my-3" />
              )}
              <div className="space-y-1">
                {!effectiveCollapsed && (
                  <h3 className="mb-2 px-3 text-xs font-semibold uppercase tracking-wider text-sidebar-foreground/60">
                    {section.title}
                  </h3>
                )}

                {section.items.map((item) => {
                  const isActive = item.href === '/settings'
                    ? pathname === '/settings'
                    : (pathname?.startsWith(item.href) || false)
                  const button = (
                    <Button
                      variant={isActive ? 'secondary' : 'ghost'}
                      className={cn(
                        'w-full gap-3 text-sidebar-foreground sidebar-menu-item',
                        isActive && 'bg-sidebar-accent text-sidebar-accent-foreground',
                        effectiveCollapsed ? 'justify-center px-2' : 'justify-start'
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {!effectiveCollapsed && <span>{item.name}</span>}
                    </Button>
                  )

                  if (effectiveCollapsed) {
                    return (
                      <Tooltip key={item.name}>
                        <TooltipTrigger asChild>
                          <Link href={item.href} prefetch={false}>
                            {button}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent side="right">{item.name}</TooltipContent>
                      </Tooltip>
                    )
                  }

                  return (
                    <Link key={item.name} href={item.href} prefetch={false}>
                      {button}
                    </Link>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div
          className={cn(
            'border-t border-sidebar-border p-3 space-y-3',
            effectiveCollapsed && 'px-2'
          )}
        >
          {/* Quick actions hint */}
          {!effectiveCollapsed && (
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
          )}

          <div
            className={cn(
              'flex flex-col gap-2',
              effectiveCollapsed ? 'items-center' : 'items-stretch'
            )}
          >
            {/* Mode switcher */}
            {effectiveCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center sidebar-menu-item"
                    asChild
                  >
                    <Link href={mode === 'feature' ? '/settings/api-keys' : '/notebooks'} prefetch={false}>
                      <ArrowLeftRight className="h-4 w-4" />
                    </Link>
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">
                  {mode === 'feature' ? '切换到管理后台' : '切换到学习前台'}
                </TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 sidebar-menu-item"
                asChild
              >
                <Link href={mode === 'feature' ? '/settings/api-keys' : '/notebooks'} prefetch={false}>
                  <ArrowLeftRight className="h-4 w-4" />
                  {mode === 'feature' ? '切换到管理后台' : '切换到学习前台'}
                </Link>
              </Button>
            )}

            {effectiveCollapsed ? (
              <>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <ThemeToggle iconOnly />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t('common.theme')}</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div>
                      <LanguageToggle iconOnly />
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right">{t('common.language')}</TooltipContent>
                </Tooltip>
              </>
            ) : (
              <>
                <ThemeToggle />
                <LanguageToggle />
              </>
            )}

            {effectiveCollapsed ? (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-center sidebar-menu-item"
                    onClick={logout}
                    aria-label={t('common.signOut')}
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="right">{t('common.signOut')}</TooltipContent>
              </Tooltip>
            ) : (
              <Button
                variant="outline"
                className="w-full justify-start gap-3 sidebar-menu-item"
                onClick={logout}
                aria-label={t('common.signOut')}
              >
                <LogOut className="h-4 w-4" />
                {t('common.signOut')}
              </Button>
            )}
          </div>
        </div>
      </div>
    </TooltipProvider>
  )
}
