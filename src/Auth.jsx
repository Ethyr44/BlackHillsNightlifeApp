import { useState, useEffect } from 'react'
import { supabase } from './supabaseClient'

export default function Auth() {
  const [loading, setLoading] = useState(false)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLogin, setIsLogin] = useState(true)

  // THE URL INTERCEPTOR (Keeps KSocial handoff working)
  useEffect(() => {
      const params = new URLSearchParams(window.location.search)
      if (params.get('mode') === 'register') setIsLogin(false)
      else if (params.get('mode') === 'login') setIsLogin(true)
  }, [])

  const handleEmailAuth = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error?.message.includes('Email not confirmed')) {
           alert('Please confirm your email address before signing in. You can use the resend button below if needed.')
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

  const handleResendConfirmation = async () => {
    if (!email) return alert('Please enter your email address in the box above first.')
    setLoading(true)
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: email })
      if (error) throw error
      alert('A new confirmation link has been sent to your email!')
    } catch (error) {
      alert(error.message)
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    const { error } = await supabase.auth.signInWithOAuth({ provider: 'google' })
    if (error) alert(error.message)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-900 px-4">
      <div className="max-w-md w-full bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-['Bebas_Neue'] text-blue-600 tracking-wider">Black Hills Nightlife</h1>
          <p className="text-gray-500 mt-2 font-medium">
            {isLogin ? 'Welcome back to the scene.' : 'Join the community.'}
          </p>
        </div>

        <form onSubmit={handleEmailAuth} className="space-y-4">
          <div>
            <label className="block text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">Email</label>
            <input
              type="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="you@example.com"
            />
          </div>
          <div>
            <label className="block text-sm font-bold uppercase tracking-widest text-gray-500 mb-1">Password</label>
            <input
              type="password" required value={password} onChange={(e) => setPassword(e.target.value)}
              className="w-full p-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              placeholder="••••••••"
            />
          </div>
          
          <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50 uppercase tracking-widest shadow-md transition-all">
            {loading ? 'Processing...' : (isLogin ? 'Sign In' : 'Sign Up')}
          </button>
        </form>

        {isLogin && (
          <div className="mt-4 text-center">
            <button type="button" onClick={handleResendConfirmation} disabled={loading} className="text-xs font-bold uppercase tracking-widest text-gray-400 hover:text-blue-500 transition-colors">
              Didn't get confirmation email? Resend.
            </button>
          </div>
        )}

        <div className="mt-8">
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-3 bg-white text-gray-400 font-bold uppercase tracking-widest text-[10px]">Or continue with</span></div>
          </div>

          <button onClick={handleGoogleLogin} className="mt-6 w-full border-2 border-gray-200 text-gray-700 font-bold py-3 px-4 rounded-lg hover:bg-gray-50 hover:border-blue-500 flex items-center justify-center gap-2 transition-all">
            Google
          </button>
        </div>

        <div className="mt-8 text-center pt-6 border-t border-gray-100">
          <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-bold text-blue-600 hover:text-blue-800 transition-colors">
            {isLogin ? "Don't have an account? Sign up" : "Already have an account? Sign in"}
          </button>
        </div>
      </div>
    </div>
  )
}