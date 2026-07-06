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

/**
 * Loom meteor configs — two crossing groups create a weaving fabric effect:
 *   warp (经线): 左下 → 右上 ↗  (bottom-left to top-right)
 *   weft (纬线): 右下 → 左上 ↖  (bottom-right to top-left)
 * Dense coverage: 12 per group = 24 total, varied timing & position.
 */
const WARP = Array.from({ length: 12 }, (_, i) => ({
  id: `warp-${i}`,
  left: `${2 + (i * 8.5) % 96}%`,
  top: `${90 + (i * 9) % 20}%`,        // start near bottom
  delay: `${(i * 0.45) % 4}s`,
  duration: `${2.2 + (i * 0.35) % 2.5}s`,
  width: `${50 + (i * 25) % 90}px`,
}))

const WEFT = Array.from({ length: 12 }, (_, i) => ({
  id: `weft-${i}`,
  left: `${2 + (i * 8.5) % 96}%`,
  top: `${90 + ((i + 6) * 9) % 20}%`,  // offset phase from warp
  delay: `${0.5 + (i * 0.45) % 4}s`,
  duration: `${2.2 + ((i + 3) * 0.35) % 2.5}s`,
  width: `${50 + ((i + 3) * 25) % 90}px`,
}))

export function SplashScreen({ onClick }: SplashScreenProps) {
  const { t } = useTranslation()
  const containerRef = useRef<HTMLDivElement>(null)
  const [ripples, setRipples] = useState<(Ripple | null)[]>(() => Array(8).fill(null))
  const [mousePos, setMousePos] = useState({ x: 0.5, y: 0.5 })
  const nextSlotRef = useRef(0)
  const idCounterRef = useRef(0)

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const isTouchDevice =
    typeof window !== 'undefined'
      ? window.matchMedia('(hover: none)').matches
      : false

  const showCenterGlow = prefersReducedMotion || isTouchDevice

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      setMousePos({ x: x / rect.width, y: y / rect.height })

      // Update CSS custom properties for spotlight (no React re-render)
      if (containerRef.current) {
        containerRef.current.style.setProperty('--spotlight-x', `${x}px`)
        containerRef.current.style.setProperty('--spotlight-y', `${y}px`)
      }

      if (prefersReducedMotion) return

      const id = idCounterRef.current++
      const slot = nextSlotRef.current
      nextSlotRef.current = (slot + 1) % 8

      setRipples((prev) => {
        const next = [...prev]
        next[slot] = { id, x, y, opacity: 1, scale: 1 }
        return next
      })

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

  useEffect(() => {
    const handleResize = () => setRipples(Array(8).fill(null))
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const parallaxX = (mousePos.x - 0.5) * 10
  const parallaxY = (mousePos.y - 0.5) * 10

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 z-50 flex items-center justify-center cursor-pointer overflow-hidden
                 bg-gradient-to-br from-indigo-950 via-slate-900 to-violet-950"
      onMouseMove={handleMouseMove}
      onClick={onClick}
      style={
        {
          '--spotlight-x': '50%',
          '--spotlight-y': '50%',
        } as React.CSSProperties
      }
    >
      {/* ── Spotlight lens — follows mouse, brightens/magnifies area ── */}
      {!prefersReducedMotion && (
        <div
          className="absolute inset-0 pointer-events-none z-0"
          style={{
            background: `radial-gradient(
              circle 140px at var(--spotlight-x, 50%) var(--spotlight-y, 50%),
              rgba(255, 255, 255, 0.07) 0%,
              rgba(168, 180, 255, 0.04) 40%,
              transparent 70%
            )`,
            transition: 'opacity 0.2s ease-out',
          }}
        />
      )}

      {/* ── Loom meteor shower (warp ↗ + weft ↖) ── */}
      {!prefersReducedMotion && (
        <>
          {WARP.map((m) => (
            <div
              key={m.id}
              className="absolute pointer-events-none"
              style={{
                left: m.left,
                top: m.top,
                width: m.width,
                height: '1.5px',
                background:
                  'linear-gradient(90deg, rgba(199,210,254,0) 0%, rgba(199,210,254,0.8) 55%, rgba(255,255,255,1) 100%)',
                borderRadius: '1px',
                boxShadow: '0 0 4px rgba(199,210,254,0.6)',
                animation: `meteor-warp ${m.duration} ${m.delay} linear infinite`,
                opacity: 0,
              }}
            />
          ))}
          {WEFT.map((m) => (
            <div
              key={m.id}
              className="absolute pointer-events-none"
              style={{
                left: m.left,
                top: m.top,
                width: m.width,
                height: '1.5px',
                background:
                  'linear-gradient(270deg, rgba(199,210,254,0) 0%, rgba(199,210,254,0.8) 55%, rgba(255,255,255,1) 100%)',
                borderRadius: '1px',
                boxShadow: '0 0 4px rgba(199,210,254,0.6)',
                animation: `meteor-weft ${m.duration} ${m.delay} linear infinite`,
                opacity: 0,
              }}
            />
          ))}
        </>
      )}

      {/* ── Ripple layer ── */}
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

      {/* ── Center glow for reduced-motion / touch devices ── */}
      {showCenterGlow && (
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
                     w-48 h-48 rounded-full bg-indigo-500/10 blur-3xl animate-pulse pointer-events-none"
          style={{ animationDuration: '4s' }}
        />
      )}

      {/* ── Brand text with parallax ── */}
      <div
        className="text-center select-none relative z-10"
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
