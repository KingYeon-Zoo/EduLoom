# Login Splash + Transition 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现登录页 Splash 启动画面 + 闪白翻页过渡动画 + 左右分栏登录布局

**Architecture:** 单路由 `/login` 内部状态机驱动 4 个阶段（splash → flash → flip → login）。所有动画纯 CSS + 轻量 JS 实现，零新增依赖。Splash 用环形缓冲区管理涟漪节点，过渡动画用 CSS 3D transform，登录页 flex 左 2/3 右 1/3 响应式布局。

**Tech Stack:** React 19, Next.js 16, TypeScript, Tailwind CSS v4, shadcn/ui, tw-animate-css

## Global Constraints

- 零新增 npm 依赖
- 所有动画使用 `transform` + `opacity`（GPU 合成层）
- 支持 `prefers-reduced-motion`
- 触屏设备降级（无涟漪，触摸直接过渡）
- 所有文案 i18n 覆盖
- 复用现有 LoginForm 认证逻辑，仅修改样式层

---

### Task 1: 新增 i18n Key

**Files:**
- Modify: `frontend/src/lib/locales/en-US/index.ts`
- Modify: `frontend/src/lib/locales/zh-CN/index.ts`

**Interfaces:**
- Produces: `auth.splashSubtitle`, `auth.brandSlogan` — splash 提示文案和品牌标语

- [ ] **Step 1: 在 zh-CN locale 的 auth 段末尾添加两个 key**

在 `frontend/src/lib/locales/zh-CN/index.ts` 的 `auth` 对象中，`registerSuccess` 之后添加：

```typescript
splashSubtitle: "点击任意处开始",
brandSlogan: "你的 AI 智能研究助手",
```

- [ ] **Step 2: 在 en-US locale 的 auth 段末尾添加两个 key**

在 `frontend/src/lib/locales/en-US/index.ts` 的 `auth` 对象中，`registerSuccess` 之后添加：

```typescript
splashSubtitle: "Click anywhere to begin",
brandSlogan: "Your AI-powered research companion",
```

- [ ] **Step 3: 验证 TypeScript 编译**

Run: `cd frontend && npx tsc --noEmit`
Expected: No new type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/lib/locales/en-US/index.ts frontend/src/lib/locales/zh-CN/index.ts
git commit -m "feat: add splash subtitle and brand slogan i18n keys"
```

---

### Task 2: 创建 BrandIllustration 组件

**Files:**
- Create: `frontend/src/components/auth/BrandIllustration.tsx`

**Interfaces:**
- Produces: `BrandIllustration` — React 无 props 组件，渲染内联 SVG 品牌插画

- [ ] **Step 1: 创建 BrandIllustration 组件**

```typescript
// frontend/src/components/auth/BrandIllustration.tsx
export function BrandIllustration() {
  return (
    <div className="flex flex-col items-center justify-center h-full px-8">
      {/* Abstract geometric brand illustration */}
      <svg
        viewBox="0 0 400 300"
        className="w-full max-w-md"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-label="EduLoom brand illustration"
      >
        {/* Central glowing orb */}
        <defs>
          <radialGradient id="centerGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.725 0.153 78.68)" stopOpacity="0.6" />
            <stop offset="100%" stopColor="oklch(0.546 0.245 262.881)" stopOpacity="0" />
          </radialGradient>
          <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="oklch(0.546 0.245 262.881)" stopOpacity="0.8" />
            <stop offset="100%" stopColor="oklch(0.546 0.245 262.881)" stopOpacity="0.2" />
          </radialGradient>
        </defs>
        {/* Background glow */}
        <circle cx="200" cy="150" r="120" fill="url(#centerGlow)" />
        {/* Connected nodes — knowledge graph metaphor */}
        <line x1="120" y1="90" x2="200" y2="150" stroke="oklch(0.546 0.245 262.881 / 0.4)" strokeWidth="1.5" />
        <line x1="280" y1="80" x2="200" y2="150" stroke="oklch(0.546 0.245 262.881 / 0.4)" strokeWidth="1.5" />
        <line x1="140" y1="210" x2="200" y2="150" stroke="oklch(0.725 0.153 78.68 / 0.3)" strokeWidth="1.5" />
        <line x1="270" y1="200" x2="200" y2="150" stroke="oklch(0.725 0.153 78.68 / 0.3)" strokeWidth="1.5" />
        <line x1="200" y1="60" x2="200" y2="150" stroke="oklch(0.64 0.21 266.85 / 0.35)" strokeWidth="1.5" />
        <line x1="200" y1="260" x2="200" y2="150" stroke="oklch(0.64 0.21 266.85 / 0.35)" strokeWidth="1.5" />
        {/* Nodes */}
        <circle cx="120" cy="90" r="8" fill="url(#nodeGlow)" />
        <circle cx="280" cy="80" r="10" fill="url(#nodeGlow)" />
        <circle cx="140" cy="210" r="7" fill="url(#nodeGlow)" />
        <circle cx="270" cy="200" r="9" fill="url(#nodeGlow)" />
        <circle cx="200" cy="60" r="6" fill="url(#nodeGlow)" />
        <circle cx="200" cy="260" r="7" fill="url(#nodeGlow)" />
        {/* Central node — larger, amber accent */}
        <circle cx="200" cy="150" r="16" fill="url(#nodeGlow)" />
        <circle cx="200" cy="150" r="8" fill="oklch(0.725 0.153 78.68)" opacity="0.7" />
        {/* Small floating particles */}
        <circle cx="90" cy="150" r="2" fill="oklch(0.89 0.01 268.12 / 0.3)" />
        <circle cx="310" cy="130" r="2.5" fill="oklch(0.89 0.01 268.12 / 0.25)" />
        <circle cx="170" cy="40" r="1.5" fill="oklch(0.89 0.01 268.12 / 0.2)" />
        <circle cx="240" cy="270" r="2" fill="oklch(0.89 0.01 268.12 / 0.2)" />
      </svg>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/BrandIllustration.tsx
git commit -m "feat: add BrandIllustration SVG component for login page"
```

---

### Task 3: 创建 SplashScreen 组件

**Files:**
- Create: `frontend/src/components/auth/SplashScreen.tsx`

**Interfaces:**
- Consumes: `auth.splashSubtitle` (i18n key from Task 1)
- Produces: `<SplashScreen onClick={() => void} />` — 鼠标涟漪 + 渐变背景 + 视差品牌文字

- [ ] **Step 1: 创建 SplashScreen 组件**

```typescript
// frontend/src/components/auth/SplashScreen.tsx
'use client'

import { useState, useCallback, useEffect, useRef } from 'react'
import { useTranslation } from '@/lib/hooks/use-translation'

interface Ripple {
  id: number
  x: number
  y: number
  opacity: number
  scale: number
}

interface SplashScreenProps {
  onClick: () => void
}

export function SplashScreen({ onClick }: SplashScreenProps) {
  const { t } = useTranslation()
  const [ripples, setRipples] = useState<(Ripple | null)[]>(() => Array(8).fill(null))
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const nextSlotRef = useRef(0)
  const idCounterRef = useRef(0)
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      // Normalized position for parallax
      setMousePos({
        x: x / rect.width,
        y: y / rect.height,
      })

      if (prefersReducedMotion) return

      const id = idCounterRef.current++
      const slot = nextSlotRef.current
      nextSlotRef.current = (slot + 1) % 8

      setRipples((prev) => {
        const next = [...prev]
        next[slot] = { id, x, y, opacity: 1, scale: 1 }
        return next
      })

      // Fade out ripple after one frame
      requestAnimationFrame(() => {
        setRipples((prev) => {
          const next = [...prev]
          if (next[slot]?.id === id) {
            next[slot] = { ...next[slot]!, opacity: 0, scale: 2 }
          }
          return next
        })
      })
    },
    [prefersReducedMotion],
  )

  const parallaxX = (mousePos.x - 0.5) * 10
  const parallaxY = (mousePos.y - 0.5) * 10

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer overflow-hidden
                 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950"
      onMouseMove={handleMouseMove}
      onClick={onClick}
    >
      {/* Ripple layer */}
      {!prefersReducedMotion &&
        ripples.map((ripple, i) =>
          ripple ? (
            <div
              key={`${ripple.id}-${i}`}
              className="absolute pointer-events-none rounded-full"
              style={{
                left: ripple.x - 60,
                top: ripple.y - 60,
                width: 120,
                height: 120,
                background:
                  'radial-gradient(circle, oklch(0.546 0.245 262.881 / 0.2) 0%, transparent 70%)',
                opacity: ripple.opacity,
                transform: `scale(${ripple.scale})`,
                transition: 'opacity 800ms ease-out, transform 800ms ease-out',
              }}
            />
          ) : null,
        )}

      {/* Center glow for touch devices */}
      {prefersReducedMotion && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl animate-pulse"
          style={{ animationDuration: '4s' }}
        />
      )}

      {/* Brand text with parallax */}
      <div
        className="text-center select-none"
        style={{
          transform: prefersReducedMotion
            ? 'none'
            : `translate(${parallaxX}px, ${parallaxY}px)`,
          transition: 'transform 0.1s ease-out',
        }}
      >
        <h1 className="font-heading text-6xl font-bold text-white tracking-wide">
          EduLoom
        </h1>
        <p className="mt-4 text-lg text-white/60 font-sans">
          {t('auth.splashSubtitle')}
        </p>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/SplashScreen.tsx
git commit -m "feat: add SplashScreen with mouse ripple and parallax"
```

---

### Task 4: 创建 FlashOverlay 组件

**Files:**
- Create: `frontend/src/components/auth/FlashOverlay.tsx`

**Interfaces:**
- Consumes: (none — 纯视觉组件，通过 props 回调通信)
- Produces: `<FlashOverlay onComplete={() => void} />` — 白色遮罩从中心扩散，300ms 后调用 onComplete

- [ ] **Step 1: 创建 FlashOverlay 组件**

```typescript
// frontend/src/components/auth/FlashOverlay.tsx
'use client'

import { useEffect, useRef } from 'react'

interface FlashOverlayProps {
  onComplete: () => void
}

export function FlashOverlay({ onComplete }: FlashOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const duration = prefersReducedMotion ? 150 : 300

  useEffect(() => {
    const timer = setTimeout(onComplete, duration)
    // Trigger enter animation
    requestAnimationFrame(() => {
      if (panelRef.current) {
        panelRef.current.style.opacity = '1'
        if (!prefersReducedMotion) {
          panelRef.current.style.transform = 'scale(1)'
        }
      }
    })
    return () => clearTimeout(timer)
  }, [onComplete, duration, prefersReducedMotion])

  return (
    <div
      ref={panelRef}
      className="fixed inset-0 z-50 bg-white"
      style={{
        opacity: 0,
        transform: prefersReducedMotion ? 'none' : 'scale(0.95)',
        transition: `all ${duration}ms ease-out`,
      }}
    />
  )
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/FlashOverlay.tsx
git commit -m "feat: add FlashOverlay white flash transition component"
```

---

### Task 5: 创建 FlipTransition 组件

**Files:**
- Create: `frontend/src/components/auth/FlipTransition.tsx`

**Interfaces:**
- Consumes: (none — children 为登录布局内容)
- Produces: `<FlipTransition onComplete={() => void}>{children}</FlipTransition>` — 3D 翻页容器，600ms 后调用 onComplete 并显示 children

- [ ] **Step 1: 创建 FlipTransition 组件**

```typescript
// frontend/src/components/auth/FlipTransition.tsx
'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface FlipTransitionProps {
  children: ReactNode
  onComplete: () => void
}

export function FlipTransition({ children, onComplete }: FlipTransitionProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [flipping, setFlipping] = useState(false)
  const prefersReducedMotion = typeof window !== 'undefined'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false

  const duration = prefersReducedMotion ? 300 : 600

  useEffect(() => {
    // Start flip on next frame
    const raf = requestAnimationFrame(() => {
      setFlipping(true)
    })

    const timer = setTimeout(onComplete, duration)

    return () => {
      cancelAnimationFrame(raf)
      clearTimeout(timer)
    }
  }, [onComplete, duration])

  if (prefersReducedMotion) {
    // Simple crossfade instead of flip
    return (
      <div className="fixed inset-0 z-50">
        <div
          className="absolute inset-0 bg-white"
          style={{
            opacity: flipping ? 0 : 1,
            transition: `opacity ${duration}ms ease-in-out`,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            opacity: flipping ? 1 : 0,
            transition: `opacity ${duration}ms ease-in-out`,
          }}
        >
          {children}
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50" style={{ perspective: '1200px' }}>
      {/* Login layout behind the flipping panel */}
      <div className="absolute inset-0">{children}</div>
      {/* White flip panel */}
      <div
        ref={panelRef}
        className="absolute inset-0 bg-white"
        style={{
          transformOrigin: 'left center',
          backfaceVisibility: 'hidden',
          transform: flipping ? 'rotateY(-180deg)' : 'rotateY(0deg)',
          transition: `transform ${duration}ms cubic-bezier(0.4, 0, 0.2, 1)`,
        }}
      />
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/FlipTransition.tsx
git commit -m "feat: add FlipTransition 3D page-flip component"
```

---

### Task 6: 创建 LoginLayout 组件

**Files:**
- Create: `frontend/src/components/auth/LoginLayout.tsx`

**Interfaces:**
- Produces: `<LoginLayout>{children}</LoginLayout>` — flex 左 2/3 右 1/3 布局，左侧品牌面板，右侧 children 插槽放登录表单

- [ ] **Step 1: 创建 LoginLayout 组件**

```typescript
// frontend/src/components/auth/LoginLayout.tsx
'use client'

import type { ReactNode } from 'react'
import { BrandIllustration } from './BrandIllustration'
import { useTranslation } from '@/lib/hooks/use-translation'

interface LoginLayoutProps {
  children: ReactNode
}

export function LoginLayout({ children }: LoginLayoutProps) {
  const { t } = useTranslation()

  return (
    <div className="flex min-h-screen">
      {/* Left panel — brand illustration + ambient glow */}
      <div className="hidden md:flex flex-[2] relative items-center justify-center overflow-hidden
                      bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950">
        {/* Ambient glow orbs */}
        <div
          className="absolute -top-[10%] -left-[10%] w-[30rem] h-[30rem]
                     bg-indigo-500/10 rounded-full blur-3xl animate-pulse pointer-events-none"
          style={{ animationDuration: '6s' }}
        />
        <div
          className="absolute -bottom-[5%] -right-[10%] w-[25rem] h-[25rem]
                     bg-violet-500/8 rounded-full blur-3xl animate-pulse pointer-events-none"
          style={{ animationDuration: '8s' }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center justify-center w-full">
          <BrandIllustration />
          <p className="mt-4 text-lg text-white/60 text-center font-sans">
            {t('auth.brandSlogan')}
          </p>
        </div>
      </div>

      {/* Right panel — login form */}
      <div className="flex-1 flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/components/auth/LoginLayout.tsx
git commit -m "feat: add LoginLayout flex split layout component"
```

---

### Task 7: 修改 LoginForm 组件 — 移除全屏样式适配卡片布局

**Files:**
- Modify: `frontend/src/components/auth/LoginForm.tsx`

**Interfaces:**
- Consumes: CSS theme variables (`bg-card`, `text-card-foreground`, `border-border`) — 适配亮暗主题
- Produces: `LoginForm` — 行为不变，仅移除全屏背景和装饰光斑，卡片宽度由父级 LoginLayout 控制

**关键变更：**
1. 外层 `div` 从 `min-h-screen flex items-center justify-center ...` 简化为空的 fragment `<>...</>`
2. 移除两个装饰性背景光斑 div
3. Card 宽度从 `max-w-md` 改为 `w-full`（由父级控制）
4. Card 样式从硬编码暗色（`bg-slate-950/60 border-white/10`）改为 CSS 变量（`bg-card border-border`）
5. Card 文字从硬编码白色改为 CSS 变量（`text-card-foreground`）
6. Input 样式从硬编码暗色改为使用主题变量 + 聚焦态配合 primary 色
7. 保持所有 auth 逻辑完全不变

- [ ] **Step 1: 读取现有 LoginForm 确认当前内容**

- [ ] **Step 2: 修改 LoginForm — 替换最外层 JSX 结构**

将 LoginForm 的 return 语句中的外层 `<div className="min-h-screen flex items-center justify-center relative bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 p-4 overflow-hidden">` 及其装饰光斑子元素替换为 `<>`，移除两个 `absolute` 光斑 div。

具体编辑：

**删除** 第 261–265 行（外层 div 开始 + 两个装饰光斑）：
```tsx
    <div className="min-h-screen flex items-center justify-center relative bg-gradient-to-tr from-slate-900 via-slate-800 to-indigo-950 p-4 overflow-hidden">
      {/* Decorative gradient balls */}
      <div className="absolute w-[35rem] h-[35rem] -top-40 -left-40 rounded-full bg-indigo-500/10 blur-3xl pointer-events-none" />
      <div className="absolute w-[35rem] h-[35rem] -bottom-40 -right-40 rounded-full bg-purple-500/10 blur-3xl pointer-events-none" />
```

替换为：
```tsx
    <>
```

**删除** 第 424 行（外层 div 结束 `</div>`），替换为 `</>`

- [ ] **Step 3: 修改 Card 样式**

将 Card 的 className：
```
className="w-full max-w-md border-white/10 bg-slate-950/60 backdrop-blur-xl shadow-2xl rounded-2xl transition-all duration-300 relative z-10"
```

替换为：
```
className="w-full border-border bg-card text-card-foreground backdrop-blur-xl shadow-2xl rounded-2xl transition-all duration-300"
```

- [ ] **Step 4: 修改 Card 内容文字颜色**

CardTitle 的 className 从：
```
className="text-2xl font-bold bg-gradient-to-r from-white to-slate-300 bg-clip-text text-transparent"
```
替换为：
```
className="text-2xl font-bold text-card-foreground"
```

CardDescription 的 className 从 `text-slate-400` 替换为 `text-muted-foreground`

- [ ] **Step 5: 修改 Input 样式**

将所有 Input 的 className 从：
```
className="pl-9 bg-slate-900/50 border-slate-700/60 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
```
替换为：
```
className="pl-9 bg-background border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
```

（共 3 处：username、password、confirmPassword）

验证码 Input 的 className 从：
```
className="bg-slate-900/50 border-slate-700/60 text-white placeholder-slate-500 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 font-mono tracking-widest text-center"
```
替换为：
```
className="bg-background border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary font-mono tracking-widest text-center"
```

- [ ] **Step 6: 修改验证码显示区域样式**

验证码外框的 className 从：
```
className="relative h-10 flex items-center justify-between border border-slate-700/60 rounded-md overflow-hidden bg-slate-900/40"
```
替换为：
```
className="relative h-10 flex items-center justify-between border border-input rounded-md overflow-hidden bg-background"
```

- [ ] **Step 7: 修改图标颜色**

将所有图标 span 的 `text-slate-400` 替换为 `text-muted-foreground`：
- 第 288 行（User 图标）
- 第 305 行（Lock 图标）
- 第 323 行（第二个 Lock 图标）

- [ ] **Step 8: 修改提交按钮样式**

Button 的 className 从：
```
className="w-full h-10 bg-indigo-600 hover:bg-indigo-500 text-white font-medium rounded-lg shadow-lg shadow-indigo-600/20 transition-all duration-200"
```
替换为：
```
className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-lg transition-all duration-200"
```

- [ ] **Step 9: 修改模式切换按钮颜色**

将模式切换按钮的 `text-indigo-400 hover:text-indigo-300` 替换为 `text-primary hover:text-primary/80`

- [ ] **Step 10: 修改 footer 版本信息颜色**

将 footer 版本信息的 `text-slate-500` 替换为 `text-muted-foreground`，`border-slate-800/80` 替换为 `border-border`

- [ ] **Step 11: 修改错误和成功提示保留现有颜色**

（错误和成功提示的 rose/emerald 颜色保持特殊性，不做更改）

- [ ] **Step 12: 修改验证码刷新按钮颜色**

将刷新按钮的 `text-slate-400 hover:text-white` 替换为 `text-muted-foreground hover:text-foreground`

- [ ] **Step 13: 验证 TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 14: Commit**

```bash
git add frontend/src/components/auth/LoginForm.tsx
git commit -m "refactor: adapt LoginForm styling to use CSS theme variables"
```

---

### Task 8: 替换登录页面 — 实现阶段状态机

**Files:**
- Modify: `frontend/src/app/(auth)/login/page.tsx`

**Interfaces:**
- Consumes: `SplashScreen`, `FlashOverlay`, `FlipTransition`, `LoginLayout`, `LoginForm` — 所有前面创建的组件
- Produces: `LoginPage` — 阶段状态机驱动的登录入口页面

- [ ] **Step 1: 重写 login/page.tsx**

```typescript
// frontend/src/app/(auth)/login/page.tsx
'use client'

import { useState } from 'react'
import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoginForm } from '@/components/auth/LoginForm'
import { SplashScreen } from '@/components/auth/SplashScreen'
import { FlashOverlay } from '@/components/auth/FlashOverlay'
import { FlipTransition } from '@/components/auth/FlipTransition'
import { LoginLayout } from '@/components/auth/LoginLayout'

type Phase = 'splash' | 'flash' | 'flip' | 'login'

function LoginPage() {
  const [phase, setPhase] = useState<Phase>('splash')

  return (
    <>
      {phase === 'splash' && (
        <SplashScreen onClick={() => setPhase('flash')} />
      )}
      {phase === 'flash' && (
        <FlashOverlay onComplete={() => setPhase('flip')} />
      )}
      {phase === 'flip' && (
        <FlipTransition onComplete={() => setPhase('login')}>
          <LoginLayout>
            <LoginForm />
          </LoginLayout>
        </FlipTransition>
      )}
      {phase === 'login' && (
        <LoginLayout>
          <LoginForm />
        </LoginLayout>
      )}
    </>
  )
}

export default function LoginPageWrapper() {
  return (
    <ErrorBoundary>
      <LoginPage />
    </ErrorBoundary>
  )
}
```

- [ ] **Step 2: 验证 TypeScript**

Run: `cd frontend && npx tsc --noEmit`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/\(auth\)/login/page.tsx
git commit -m "feat: implement splash-to-login phase state machine on /login route"
```

---

### Task 9: 端到端验证

- [ ] **Step 1: 运行开发服务器检查编译**

Run: `cd frontend && npx next build 2>&1 | tail -20`
Expected: Build succeeds without errors.

- [ ] **Step 2: 手动验证检查清单**

Verify:
1. 访问 `/login` → 首先看到 Splash 渐变背景 + 品牌文字
2. 移动鼠标 → 看到涟漪效果跟随鼠标
3. 点击页面任意处 → 闪白 ~300ms
4. 闪白后 → 3D 翻页动画露出登录页
5. 登录页 → 左侧品牌插画 + 右侧登录表单
6. 缩小窗口至 < 768px → 左侧面板隐藏，表单全宽居中
7. 登录表单功能正常（登录/注册切换、验证码、错误提示）
8. 触屏设备 → 无涟漪，中心呼吸光斑，触摸后可过渡
9. `prefers-reduced-motion` → 动画简化

- [ ] **Step 3: 修复发现的问题（如有）并提交**

```bash
git add -A
git commit -m "fix: address e2e verification issues for login splash"
```
