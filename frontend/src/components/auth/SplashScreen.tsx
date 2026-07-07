'use client'

import { useState, useEffect, type ReactNode } from 'react'
import Lightfall from '@/components/Lightfall'

interface SplashScreenProps {
  children?: ReactNode
}

export function SplashScreen({ children }: SplashScreenProps) {
  const [revealed, setRevealed] = useState(false)
  const [brandingGone, setBrandingGone] = useState(false)

  useEffect(() => {
    if (revealed) {
      // Unmount centered branding after its fade-out completes
      const timer = setTimeout(() => setBrandingGone(true), 550)
      return () => clearTimeout(timer)
    }
  }, [revealed])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-hidden bg-[#0A0729]">
      {/* ── Lightfall WebGL background (always visible) ── */}
      <div className="absolute inset-0 z-0">
        <Lightfall
          colors={['#A6C8FF', '#5227FF', '#FF9FFC']}
          backgroundColor="#0A0729"
          speed={0.4}
          streakCount={3}
          streakWidth={1.2}
          streakLength={0.8}
          glow={1.2}
          density={0.5}
          twinkle={1}
          zoom={3}
          backgroundGlow={0.4}
          opacity={1}
          mouseInteraction
          mouseStrength={0.4}
          mouseRadius={0.1}
        />
      </div>

      {/* ── Splash branding — absolute overlay, fades out then unmounts ── */}
      {!brandingGone && (
        <div
          className="absolute inset-0 z-20 flex flex-col items-center justify-center"
          style={{
            opacity: revealed ? 0 : 1,
            pointerEvents: revealed ? 'none' : 'auto',
            transition: 'opacity 500ms ease-out',
          }}
          onClick={() => setRevealed(true)}
        >
          <h1 className="font-heading text-9xl font-bold text-white tracking-wide cursor-pointer">
            EduLoom
          </h1>
          <p className="mt-3 font-heading text-5xl font-medium tracking-[0.5em] text-white/85">
            学织
          </p>
          <p className="mt-8 text-2xl font-sans font-light tracking-[0.15em] text-white/70">
            你的智能AI学习助手
          </p>
          <div className="mt-10 h-px w-40 bg-gradient-to-r from-transparent via-white/15 to-transparent" />
          <p className="mt-10 text-lg font-sans tracking-[0.3em] text-white/40">
            点击任意位置
          </p>
          <p className="mt-3 text-sm font-sans tracking-[0.2em] text-white/25">
            开启新的篇章
          </p>
        </div>
      )}

      {/* ── Revealed layout: branding left + login card right, center-symmetric ── */}
      {revealed && (
        <div
          className="relative z-10 flex items-center justify-center gap-12 lg:gap-20 w-full max-w-4xl px-6"
          style={{
            animation: 'revealLayout 600ms cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
          }}
        >
          <style>{`
            @keyframes revealLayout {
              from {
                transform: scale(0.3);
                opacity: 0;
              }
              to {
                transform: scale(1);
                opacity: 1;
              }
            }
          `}</style>

          {/* ── Left: Compact branding ── */}
          <div className="hidden sm:flex flex-col items-end text-right flex-shrink-0">
            <h2 className="font-heading text-5xl lg:text-6xl font-bold text-white tracking-wide leading-none">
              EduLoom
            </h2>
            <p className="mt-2 font-heading text-2xl lg:text-3xl font-medium tracking-[0.4em] text-white/80">
              学织
            </p>
            <p className="mt-4 text-sm lg:text-base font-sans font-light tracking-[0.1em] text-white/50">
              你的智能AI学习助手
            </p>
          </div>

          {/* ── Center divider ── */}
          <div className="hidden sm:block w-px h-48 bg-gradient-to-b from-transparent via-white/15 to-transparent flex-shrink-0" />

          {/* ── Right: Login card ── */}
          <div className="flex-shrink-0 w-full max-w-sm">
            {children}
          </div>
        </div>
      )}
    </div>
  )
}
