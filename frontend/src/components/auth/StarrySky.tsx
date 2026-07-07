'use client'

import { useEffect, useRef, useCallback } from 'react'

interface Star {
  x: number
  y: number
  r: number
  baseAlpha: number
  phase: number
  period: number
  hue: number
}

interface StarrySkyProps {
  starCount?: number
  prefersReducedMotion?: boolean
}

export function StarrySky({
  starCount = 250,
  prefersReducedMotion = false,
}: StarrySkyProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const starsRef = useRef<Star[]>([])
  const rafRef = useRef<number>(0)
  const dimensionsRef = useRef({ width: 0, height: 0 })

  const generateStars = useCallback(
    (width: number, height: number): Star[] =>
      Array.from({ length: starCount }, () => {
        const r = 0.5 + Math.random() * 2.0
        return {
          x: Math.random() * width,
          y: Math.random() * height,
          r,
          baseAlpha: 0.25 + (r / 2.5) * 0.65,
          phase: Math.random() * Math.PI * 2,
          period: 1500 + Math.random() * 2500,
          hue: Math.random() < 0.08 ? 200 + Math.random() * 40 : 0,
        }
      }),
    [starCount],
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      dimensionsRef.current = { width: rect.width, height: rect.height }
      canvas.width = rect.width * dpr
      canvas.height = rect.height * dpr
      starsRef.current = generateStars(rect.width, rect.height)
    }

    let resizeTimeout: ReturnType<typeof setTimeout>
    const debouncedResize = () => {
      clearTimeout(resizeTimeout)
      resizeTimeout = setTimeout(resize, 150)
    }

    resize()
    window.addEventListener('resize', debouncedResize)

    const startTime = performance.now()

    const draw = (now: number) => {
      const elapsed = now - startTime
      const { width, height } = dimensionsRef.current

      ctx.clearRect(0, 0, canvas.width, canvas.height)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)

      for (const star of starsRef.current) {
        const wave = prefersReducedMotion
          ? 0.7
          : 0.3 +
            0.7 *
              (Math.sin((elapsed / star.period) * Math.PI * 2 + star.phase) *
                0.5 +
                0.5)

        const alpha = star.baseAlpha * wave

        // Subtle glow halo for larger stars
        if (star.r > 1.2) {
          ctx.fillStyle =
            star.hue === 0
              ? `rgba(255, 255, 255, ${alpha * 0.12})`
              : `rgba(180, 210, 255, ${alpha * 0.12})`
          ctx.beginPath()
          ctx.arc(star.x, star.y, star.r * 2.8, 0, Math.PI * 2)
          ctx.fill()
        }

        // Star core
        ctx.fillStyle =
          star.hue === 0
            ? `rgba(255, 255, 255, ${alpha})`
            : `rgba(180, 210, 255, ${alpha})`
        ctx.beginPath()
        ctx.arc(star.x, star.y, star.r, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(draw)
    }

    rafRef.current = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(rafRef.current)
      window.removeEventListener('resize', debouncedResize)
      clearTimeout(resizeTimeout)
    }
  }, [generateStars, prefersReducedMotion])

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 pointer-events-none"
      aria-hidden="true"
    />
  )
}
