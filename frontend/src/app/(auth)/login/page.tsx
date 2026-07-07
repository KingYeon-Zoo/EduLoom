'use client'

import { ErrorBoundary } from '@/components/common/ErrorBoundary'
import { LoginForm } from '@/components/auth/LoginForm'
import { SplashScreen } from '@/components/auth/SplashScreen'

function LoginPage() {
  return (
    <SplashScreen>
      <LoginForm variant="glass" />
    </SplashScreen>
  )
}

export default function LoginPageWrapper() {
  return (
    <ErrorBoundary>
      <LoginPage />
    </ErrorBoundary>
  )
}
