import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { createCheckoutSession } from '../lib/stripe'
import { supabase } from '../lib/supabaseClient'

function Login() {
  const { user, loading, signInWithGoogle } = useAuth()
  const [searchParams] = useSearchParams()
  const [isRedirecting, setIsRedirecting] = useState(false)

  // Handle redirect after login (e.g., from Pro upgrade flow)
  useEffect(() => {
    const handlePostLoginRedirect = async () => {
      if (!loading && user) {
        const redirectParam = searchParams.get('redirect')

        if (redirectParam === 'upgrade') {
          setIsRedirecting(true)
          try {
            const { data: { session } } = await supabase.auth.getSession()
            if (!session) {
              throw new Error('Not authenticated')
            }

            const checkoutUrl = await createCheckoutSession(user.id, session.access_token)
            window.location.href = checkoutUrl
          } catch (err) {
            console.error('Redirect to checkout error:', err)
            setIsRedirecting(false)
            // Fallback to dashboard on error
            window.location.href = '/dashboard'
          }
        }
      }
    }

    handlePostLoginRedirect()
  }, [user, loading, searchParams])

  // 如果已登录且没有redirect参数，直接跳转 Dashboard
  if (!loading && user) {
    const redirectParam = searchParams.get('redirect')
    if (redirectParam === 'upgrade' || isRedirecting) {
      return null // Let the effect handle the redirect
    }
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
      <div className="w-full max-w-sm">
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <img src="/snipcat-logo.png" alt="Snipcat" className="w-8 h-8" />
          <span className="text-2xl font-bold text-gray-900">
            Snip<span className="text-orange-500">cat</span>
          </span>
        </Link>
        <div className="bg-white rounded-lg shadow p-8">
          <h1 className="text-xl font-semibold text-gray-900 text-center mb-6">
            Sign in
          </h1>
          <button
            type="button"
            onClick={() => {
              const redirectParam = searchParams.get('redirect')
              const redirectPath = redirectParam === 'upgrade' ? '/login?redirect=upgrade' : '/dashboard'
              signInWithGoogle(redirectPath)
            }}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 transition disabled:opacity-50"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            {loading ? 'Loading...' : 'Sign in with Google'}
          </button>
          <p className="text-sm text-gray-500 text-center mt-6">
            Sign in to manage your subscriptions
          </p>
        </div>
      </div>
    </div>
  )
}

export default Login
