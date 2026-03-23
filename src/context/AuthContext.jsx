import { createContext, useContext, useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { ensureProfile } from '../lib/subscriptions'

const AuthContext = createContext({})

export const useAuth = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  // Fetch profile from Supabase profiles table
  const fetchProfile = async (currentUser) => {
    try {
      // Ensure profile exists (handles users who signed up before profiles table)
      await ensureProfile(currentUser)

      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', currentUser.id)
        .single()
      if (error) {
        console.warn('Profile fetch:', error.message)
        return null
      }
      setProfile(data)
      return data
    } catch (err) {
      console.warn('Profile fetch failed:', err)
      return null
    }
  }

  useEffect(() => {
    // Get current session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      const currentUser = session?.user ?? null
      setUser(currentUser)
      if (currentUser) {
        await fetchProfile(currentUser)
      }
      setLoading(false)
    })

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null
        setUser(currentUser)
        if (currentUser) {
          fetchProfile(currentUser)
        } else {
          setProfile(null)
        }
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  // Google sign-in — request Gmail read scope so we can scan inbox later
  const signInWithGoogle = async (redirectPath = '/dashboard') => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: window.location.origin + redirectPath,
        scopes: 'https://www.googleapis.com/auth/gmail.readonly',
      }
    })
    if (error) console.error('Login error:', error.message)
  }

  // Get Google provider token for Gmail API calls
  const getGoogleToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.provider_token || null
  }

  // Sign out
  const signOut = async () => {
    const { error } = await supabase.auth.signOut()
    if (error) console.error('Logout error:', error.message)
    setProfile(null)
  }

  // Mark user as onboarded
  const markOnboarded = async () => {
    if (!user) return
    try {
      const { data } = await supabase
        .from('profiles')
        .update({ onboarded: true })
        .eq('id', user.id)
        .select()
        .single()
      if (data) setProfile(data)
    } catch (err) {
      console.warn('Could not mark onboarded:', err)
    }
  }

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signOut,
    markOnboarded,
    getGoogleToken,
    refreshProfile: () => user && fetchProfile(user),
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
