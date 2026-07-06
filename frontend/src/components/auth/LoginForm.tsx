'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/use-auth'
import { useAuthStore } from '@/lib/stores/auth-store'
import { getConfig, getApiUrl } from '@/lib/config'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { AlertCircle, CheckCircle, Lock, RefreshCw, User } from 'lucide-react'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useTranslation } from '@/lib/hooks/use-translation'

export function LoginForm() {
  const { t, language } = useTranslation()
  const router = useRouter()
  
  // Auth Store States
  const { login, register, isLoading: isAuthLoading, error: authError } = useAuth()
  const { authRequired, checkAuthRequired, hasHydrated, isAuthenticated } = useAuthStore()
  
  // Local UI States
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [username, setUsername] = useState('admin')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [captchaCode, setCaptchaCode] = useState('')
  const [captchaKey, setCaptchaKey] = useState('')
  const [captchaSvg, setCaptchaSvg] = useState('')
  const [captchaLoading, setCaptchaLoading] = useState(false)
  
  const [isCheckingAuth, setIsCheckingAuth] = useState(true)
  const [localError, setLocalError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  
  const [configInfo, setConfigInfo] = useState<{ apiUrl: string; version: string; buildTime: string } | null>(null)

  // Load config info
  useEffect(() => {
    getConfig().then(cfg => {
      setConfigInfo({
        apiUrl: cfg.apiUrl,
        version: cfg.version,
        buildTime: cfg.buildTime,
      })
    }).catch(err => {
      console.error('Failed to load config:', err)
    })
  }, [])

  // Load captcha
  const fetchCaptcha = async () => {
    setCaptchaLoading(true)
    try {
      const apiUrl = await getApiUrl()
      const response = await fetch(`${apiUrl}/api/auth/captcha`, {
        cache: 'no-store'
      })
      if (response.ok) {
        const data = await response.json()
        setCaptchaKey(data.captcha_key)
        setCaptchaSvg(data.captcha_svg)
        setCaptchaCode('')
      } else {
        console.error('Failed to fetch captcha:', response.statusText)
      }
    } catch (err) {
      console.error('Network error fetching captcha:', err)
    } finally {
      setCaptchaLoading(false)
    }
  }

  // Check auth requirement and load initial captcha
  useEffect(() => {
    if (!hasHydrated) {
      return
    }

    const initAuth = async () => {
      try {
        const required = await checkAuthRequired()
        if (!required) {
          router.push('/notebooks')
        } else {
          // If auth is required, fetch a captcha immediately
          void fetchCaptcha()
        }
      } catch (error) {
        console.error('Error checking auth requirement:', error)
      } finally {
        setIsCheckingAuth(false)
      }
    }

    if (authRequired !== null) {
      if (!authRequired && isAuthenticated) {
        router.push('/notebooks')
      } else {
        setIsCheckingAuth(false)
        if (mode === 'login' && !captchaSvg) {
          void fetchCaptcha()
        }
      }
    } else {
      void initAuth()
    }
  }, [hasHydrated, authRequired, checkAuthRequired, router, isAuthenticated, mode, captchaSvg])

  // Clear states when mode changes
  const handleModeSwitch = (newMode: 'login' | 'register') => {
    setMode(newMode)
    setLocalError(null)
    setSuccessMsg(null)
    setPassword('')
    setConfirmPassword('')
    setCaptchaCode('')
    if (newMode === 'register') {
      setUsername('')
    } else {
      setUsername('admin')
      void fetchCaptcha()
    }
  }

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setSuccessMsg(null)

    const trimmedUsername = username.trim()
    const trimmedCaptcha = captchaCode.trim()

    if (!trimmedUsername) {
      setLocalError(t('auth.usernamePlaceholder') + ' ' + t('common.required'))
      return
    }
    if (!password) {
      setLocalError(t('auth.passwordPlaceholder') + ' ' + t('common.required'))
      return
    }
    if (!trimmedCaptcha) {
      setLocalError(t('auth.captchaPlaceholder') + ' ' + t('common.required'))
      return
    }

    try {
      const success = await login(trimmedUsername, password, captchaKey, trimmedCaptcha)
      if (!success) {
        // Refresh captcha on login failure since it gets invalidated
        void fetchCaptcha()
      }
    } catch (err) {
      console.error('Login error:', err)
      void fetchCaptcha()
    }
  }

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLocalError(null)
    setSuccessMsg(null)

    const trimmedUsername = username.trim()

    if (!trimmedUsername) {
      setLocalError(t('auth.usernamePlaceholder') + ' ' + t('common.required'))
      return
    }
    if (password.length < 5) {
      setLocalError(language === 'zh-CN' ? '密码长度不能少于 5 位' : 'Password must be at least 5 characters')
      return
    }
    if (password !== confirmPassword) {
      setLocalError(t('auth.passwordsDoNotMatch'))
      return
    }

    try {
      const result = await register(trimmedUsername, password)
      if (result.success) {
        setSuccessMsg(t('auth.registerSuccess'))
        // Switch to login and prefill username
        setTimeout(() => {
          setMode('login')
          setUsername(trimmedUsername)
          setPassword('')
          setConfirmPassword('')
          setLocalError(null)
          void fetchCaptcha()
        }, 1500)
      } else {
        setLocalError(result.message || 'Registration failed')
      }
    } catch (err) {
      console.error('Registration error:', err)
      setLocalError('Network error during registration')
    }
  }

  // Show loading while checking if auth is required
  if (!hasHydrated || isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner />
      </div>
    )
  }

  // If we still don't know if auth is required (connection error), show error
  if (authRequired === null) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md border-destructive/50 shadow-lg">
          <CardHeader className="text-center">
            <CardTitle className="text-destructive flex items-center justify-center gap-2">
              <AlertCircle className="h-6 w-6" />
              {t('common.connectionError')}
            </CardTitle>
            <CardDescription>
              {t('common.unableToConnect')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-start gap-2 text-destructive text-sm bg-destructive/10 p-3 rounded-md">
                <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 font-medium">
                  {authError || t('auth.connectErrorHint')}
                </div>
              </div>

              {configInfo && (
                <div className="space-y-2 text-xs text-muted-foreground border-t pt-3 font-mono">
                  <div className="font-medium text-foreground">{t('common.diagnosticInfo')}:</div>
                  <div className="space-y-1">
                    <div>{t('common.version')}: {configInfo.version}</div>
                    <div>{t('common.built')}: {new Date(configInfo.buildTime).toLocaleString(language === 'zh-CN' ? 'zh-CN' : 'en-US')}</div>
                    <div className="break-all">{t('common.apiUrl')}: {configInfo.apiUrl}</div>
                  </div>
                </div>
              )}

              <Button
                onClick={() => window.location.reload()}
                className="w-full"
              >
                {t('common.retryConnection')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const errorToShow = localError || authError
  const isSubmitDisabled = isAuthLoading || !username.trim() || !password || (mode === 'login' && !captchaCode.trim()) || (mode === 'register' && !confirmPassword)

  return (
    <>
      
      <Card className="w-full border-border bg-card text-card-foreground backdrop-blur-xl shadow-2xl rounded-2xl transition-all duration-300">
        <CardHeader className="space-y-2 text-center pb-4">
          <div className="mx-auto w-12 h-12 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-indigo-500/20 mb-2">
            <span className="text-white font-extrabold text-xl font-mono tracking-tight">EL</span>
          </div>
          <CardTitle className="text-2xl font-bold text-card-foreground">
            {mode === 'login' ? t('auth.loginTitle') : t('auth.registerTitle')}
          </CardTitle>
          <CardDescription className="text-muted-foreground">
            {mode === 'login' 
              ? (language === 'zh-CN' ? '系统默认管理员账号为 admin / admin' : 'Default admin account is admin / admin')
              : t('auth.registerDesc')}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <form onSubmit={mode === 'login' ? handleLoginSubmit : handleRegisterSubmit} className="space-y-4">
            
            {/* Username Input */}
            <div className="space-y-1">
              <div className="relative">
                <span className="absolute left-3 top-3 text-muted-foreground">
                  <User className="h-4 w-4" />
                </span>
                <Input
                  type="text"
                  placeholder={t('auth.usernamePlaceholder')}
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  disabled={isAuthLoading}
                  className="pl-9 bg-background border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Password Input */}
            <div className="space-y-1">
              <div className="relative">
                <span className="absolute left-3 top-3 text-muted-foreground">
                  <Lock className="h-4 w-4" />
                </span>
                <Input
                  type="password"
                  placeholder={t('auth.passwordPlaceholder')}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isAuthLoading}
                  className="pl-9 bg-background border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                />
              </div>
            </div>

            {/* Confirm Password Input (Register Only) */}
            {mode === 'register' && (
              <div className="space-y-1">
                <div className="relative">
                  <span className="absolute left-3 top-3 text-muted-foreground">
                    <Lock className="h-4 w-4" />
                  </span>
                  <Input
                    type="password"
                    placeholder={t('auth.confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    disabled={isAuthLoading}
                    className="pl-9 bg-background border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary"
                  />
                </div>
              </div>
            )}

            {/* Captcha Input (Login Only) */}
            {mode === 'login' && (
              <div className="grid grid-cols-2 gap-3 items-center">
                <Input
                  type="text"
                  placeholder={t('auth.captchaPlaceholder')}
                  value={captchaCode}
                  onChange={(e) => setCaptchaCode(e.target.value)}
                  disabled={isAuthLoading}
                  className="bg-background border-input text-foreground placeholder-muted-foreground focus:border-primary focus:ring-1 focus:ring-primary font-mono tracking-widest text-center"
                  maxLength={6}
                />
                <div className="relative h-10 flex items-center justify-between border border-input rounded-md overflow-hidden bg-background">
                  {captchaSvg ? (
                    <div 
                      className="w-full h-full flex items-center justify-center cursor-pointer select-none"
                      dangerouslySetInnerHTML={{ __html: captchaSvg }}
                      onClick={fetchCaptcha}
                      title={language === 'zh-CN' ? '点击刷新验证码' : 'Click to refresh captcha'}
                    />
                  ) : (
                    <span className="text-xs text-muted-foreground pl-3">Loading...</span>
                  )}
                  <button
                    type="button"
                    onClick={fetchCaptcha}
                    disabled={captchaLoading}
                    className="absolute right-2 p-1 text-muted-foreground hover:text-foreground rounded-md transition-colors"
                  >
                    <RefreshCw className={`h-3 w-3 ${captchaLoading ? 'animate-spin' : ''}`} />
                  </button>
                </div>
              </div>
            )}

            {/* Error Message */}
            {errorToShow && (
              <div className="flex items-center gap-2 text-rose-500 text-xs bg-rose-500/10 p-2.5 rounded-lg border border-rose-500/20">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>{errorToShow}</span>
              </div>
            )}

            {/* Success Message */}
            {successMsg && (
              <div className="flex items-center gap-2 text-emerald-400 text-xs bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                <CheckCircle className="h-4 w-4 flex-shrink-0" />
                <span>{successMsg}</span>
              </div>
            )}

            {/* Submit Button */}
            <Button
              type="submit"
              className="w-full h-10 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-lg shadow-lg transition-all duration-200"
              disabled={isSubmitDisabled}
            >
              {isAuthLoading ? (
                <div className="flex items-center gap-2">
                  <LoadingSpinner className="h-4 w-4 border-white/30 border-t-white" />
                  <span>{mode === 'login' ? t('auth.signingIn') : t('auth.registering')}</span>
                </div>
              ) : (
                <span>{mode === 'login' ? t('auth.signIn') : t('auth.register')}</span>
              )}
            </Button>
          </form>
        </CardContent>

        <CardFooter className="flex flex-col space-y-3 pt-0 pb-6">
          <button
            onClick={() => handleModeSwitch(mode === 'login' ? 'register' : 'login')}
            className="text-xs text-primary hover:text-primary/80 font-medium transition-colors"
            type="button"
          >
            {mode === 'login' ? t('auth.goToRegister') : t('auth.goToLogin')}
          </button>
          
          {configInfo && (
            <div className="text-[10px] text-center text-muted-foreground pt-2 border-t border-border w-full font-mono">
              <div>Version {configInfo.version}</div>
              <div className="opacity-60">{configInfo.apiUrl}</div>
            </div>
          )}
        </CardFooter>
      </Card>
    </>
  )
}