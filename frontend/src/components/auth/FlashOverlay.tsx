'use client'

import { useEffect, useRef } from 'react'

interface FlashOverlayProps {
  onComplete: () => void
}

export function FlashOverlay({ onComplete }: FlashOverlayProps) {
  const panelRef = useRef<HTMLDivElement>(null)

  const prefersReducedMotion =
    typeof window !== 'undefined'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false

  const duration = prefersReducedMotion ? 150 : 300

  useEffect(() => {
    const timer = setTimeout(onComplete, duration)
    // Trigger enter animation on next frame
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
