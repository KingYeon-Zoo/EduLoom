'use client'

import { useEffect, useRef, useState, type ReactNode } from 'react'

interface FlipTransitionProps {
  children: ReactNode
  onComplete: () => void
}

export function FlipTransition({ children, onComplete }: FlipTransitionProps) {
  const [flipping, setFlipping] = useState(false)

  const prefersReducedMotion =
    typeof window !== 'undefined'
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
