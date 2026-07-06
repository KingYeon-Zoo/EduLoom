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
