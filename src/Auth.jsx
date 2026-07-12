import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)
  const [agreedToTerms, setAgreedToTerms] = useState(false)
  const [showPass, setShowPass] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('mode') === 'register') setIsLogin(false)
    else if (params.get('mode') === 'login') setIsLogin(true)
  }, [])

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    if (!isLogin && !agreedToTerms) {
      return alert('You must agree to the Terms of Service to create an account.')
    }
    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error?.message.includes('Email not confirmed')) {
          alert('Please confirm your email address before signing in.')
          return
        }
        if (error) throw error
      } else {
        const { error } = await supabase.auth.signUp({ email, password })
        if (error) throw error
        alert('Success! Check your email for a confirmation link.')
      }
    } catch (error) {
      alert(error.error_description || error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleResend = async () => {
    if (!email) return alert('Enter your email address first.')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email })
      if (error) throw error
      alert('Confirmation link resent!')
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) alert(error.message)
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden"
      style={{ background: 'radial-gradient(ellipse 120% 80% at 50% -10%, #1a2d5a 0%, #0e1e3d 35%, #070d1a 70%)' }}
    >
      {/* Background glow orbs */}
      <div className="absolute top-[-15%] left-[10%] w-[50vw] h-[50vw] rounded-full opacity-20 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(79,140,255,0.4) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40vw] h-[40vw] rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(245,85,122,0.4) 0%, transparent 70%)', filter: 'blur(60px)' }} />

      <div className="relative w-full max-w-sm">
        {/* Card */}
        <div
          className="rounded-3xl p-8 relative overflow-hidden"
          style={{
            background: 'rgba(255,255,255,0.04)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(255,255,255,0.09)',
            boxShadow: '0 32px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04) inset',
          }}
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[rgba(79,140,255,0.5)] to-transparent" />

          {/* Logo & heading */}
          <div className="text-center mb-8">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#4f8cff] to-[#2463d4] flex items-center justify-center mx-auto mb-4 shadow-[0_8px_24px_rgba(79,140,255,0.35)]">
              <span className="text-white text-2xl font-black" style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}>B</span>
            </div>
            <h1
              className="text-2xl font-bold text-white mb-1"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Black Hills Nightlife
            </h1>
            <p className="text-sm text-white/45" style={{ fontFamily: 'Inter, sans-serif' }}>
              {isLogin ? 'Welcome back to the scene.' : 'Join the community.'}
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40" style={{ fontFamily: 'Inter, sans-serif' }}>
                Email
              </label>
              <input
                type="email" required value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-150"
                style={{
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  fontFamily: 'Inter, sans-serif',
                }}
                onFocus={e => {
                  e.target.style.border = '1px solid rgba(79,140,255,0.5)'
                  e.target.style.boxShadow = '0 0 0 3px rgba(79,140,255,0.12)'
                }}
                onBlur={e => {
                  e.target.style.border = '1px solid rgba(255,255,255,0.1)'
                  e.target.style.boxShadow = 'none'
                }}
              />
            </div>

            <div className="space-y-1">
              <label className="text-[11px] font-semibold uppercase tracking-wider text-white/40" style={{ fontFamily: 'Inter, sans-serif' }}>
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} required value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full rounded-xl px-4 py-3 text-sm text-white placeholder-white/25 outline-none transition-all duration-150 pr-11"
                  style={{
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    fontFamily: 'Inter, sans-serif',
                  }}
                  onFocus={e => {
                    e.target.style.border = '1px solid rgba(79,140,255,0.5)'
                    e.target.style.boxShadow = '0 0 0 3px rgba(79,140,255,0.12)'
                  }}
                  onBlur={e => {
                    e.target.style.border = '1px solid rgba(255,255,255,0.1)'
                    e.target.style.boxShadow = 'none'
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPass
                    ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    : <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  }
                </button>
              </div>
            </div>

            {/* Terms */}
            {!isLogin && (
              <label className="flex items-start gap-3 cursor-pointer select-none">
                <div
                  className={`mt-0.5 w-4 h-4 rounded-[5px] flex items-center justify-center flex-shrink-0 transition-all duration-150 ${
                    agreedToTerms ? 'bg-[#4f8cff] border border-[#4f8cff]' : 'border border-white/20 bg-white/[0.04]'
                  }`}
                  onClick={() => setAgreedToTerms(p => !p)}
                >
                  {agreedToTerms && (
                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </div>
                <input type="checkbox" className="sr-only" checked={agreedToTerms} onChange={e => setAgreedToTerms(e.target.checked)} />
                <span className="text-xs text-white/40 leading-snug" style={{ fontFamily: 'Inter, sans-serif' }}>
                  I agree to the{' '}
                  <a href="#" className="text-[#4f8cff] hover:text-[#7aadff] transition-colors">Terms of Service</a>
                  {' '}and{' '}
                  <a href="#" className="text-[#4f8cff] hover:text-[#7aadff] transition-colors">Privacy Policy</a>.
                </span>
              </label>
            )}

            <button
              type="submit"
              disabled={loading || (!isLogin && !agreedToTerms)}
              className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all duration-150 disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98] mt-2"
              style={{
                background: 'linear-gradient(135deg, #4f8cff 0%, #2463d4 100%)',
                boxShadow: '0 4px 16px rgba(79,140,255,0.35)',
                fontFamily: 'Inter, sans-serif',
              }}
            >
              {loading ? 'Processing…' : isLogin ? 'Sign In' : 'Create Account'}
            </button>
          </form>

          {/* Resend link */}
          {isLogin && (
            <div className="mt-4 text-center">
              <button
                type="button"
                onClick={handleResend}
                disabled={loading}
                className="text-xs text-white/30 hover:text-white/55 transition-colors"
                style={{ fontFamily: 'Inter, sans-serif' }}
              >
                Didn't get a confirmation email? Resend.
              </button>
            </div>
          )}

          {/* Divider */}
          <div className="my-6 flex items-center gap-3">
            <div className="flex-1 h-px bg-white/[0.07]" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-white/25" style={{ fontFamily: 'Inter, sans-serif' }}>
              or
            </span>
            <div className="flex-1 h-px bg-white/[0.07]" />
          </div>

          {/* Google */}
          <button
            onClick={handleGoogle}
            className="w-full flex items-center justify-center gap-3 py-3 rounded-xl text-sm font-medium text-white/75 transition-all duration-150 hover:text-white hover:bg-white/[0.08] active:scale-[0.98]"
            style={{
              background: 'rgba(255,255,255,0.04)',
              border: '1px solid rgba(255,255,255,0.08)',
              fontFamily: 'Inter, sans-serif',
            }}
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </button>

          {/* Toggle */}
          <div className="mt-6 text-center">
            <button
              onClick={() => setIsLogin(p => !p)}
              className="text-sm text-white/40 hover:text-white/70 transition-colors"
              style={{ fontFamily: 'Inter, sans-serif' }}
            >
              {isLogin
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
