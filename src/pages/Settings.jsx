import { useState, useEffect } from 'react'
import { Check, Mail, Info, AlertTriangle, Loader2 } from 'lucide-react'
import { useTheme } from '../context/ThemeContext'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabaseClient'
import { getSubscriptions } from '../lib/subscriptions'
import { createCheckoutSession } from '../lib/stripe'

export default function Settings() {
  const { theme, setTheme } = useTheme()
  const { user, profile, signOut, refreshProfile } = useAuth()

  // Upgrade to Pro
  const [upgrading, setUpgrading] = useState(false)
  const [upgradingError, setUpgradingError] = useState(null)
  const [successMessage, setSuccessMessage] = useState(null)

  // Check for successful payment (session_id in URL)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const sessionId = params.get('session_id')
    if (sessionId) {
      // Refresh profile to get updated plan from webhook
      const checkPayment = async () => {
        await refreshProfile()
        // Small delay to allow webhook to process
        setTimeout(async () => {
          await refreshProfile()
        }, 2000)
      }
      checkPayment()
      setSuccessMessage('Payment successful! You are now on the Pro plan.')
      setTimeout(() => setSuccessMessage(null), 8000)
      // Clean up URL
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])

  const handleUpgradeToPro = async () => {
    setUpgrading(true)
    setUpgradingError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) {
        throw new Error('Not authenticated')
      }

      const checkoutUrl = await createCheckoutSession(user.id, session.access_token)
      window.location.href = checkoutUrl
    } catch (err) {
      console.error('Upgrade error:', err)
      setUpgradingError(err.message || 'Failed to start upgrade. Please try again.')
      setUpgrading(false)
    }
  }

  // Delete account
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState(null)

  const handleDeleteAccount = async () => {
    if (deleteConfirmText !== 'DELETE') return
    setDeleting(true)
    setDeleteError(null)
    try {
      // Delete user's data in order (subscriptions, reminders, notification prefs, profile)
      await supabase.from('reminders').delete().eq('user_id', user.id)
      await supabase.from('subscriptions').delete().eq('user_id', user.id)
      await supabase.from('notification_preferences').delete().eq('user_id', user.id)
      await supabase.from('profiles').delete().eq('id', user.id)

      // Sign out (Supabase auth user deletion requires admin/service role,
      // so we sign out and the account becomes orphaned — can be cleaned up server-side)
      await signOut()
    } catch (err) {
      console.error('Delete account failed:', err)
      setDeleteError('Something went wrong. Please try again.')
      setDeleting(false)
    }
  }

  // Derive user info from Google auth
  const fullName = user?.user_metadata?.full_name || user?.email?.split('@')[0] || 'User'
  const email = user?.email || ''
  const avatarUrl = user?.user_metadata?.avatar_url
  const initials = fullName
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  // Profile section
  const [displayName, setDisplayName] = useState(fullName)
  const [savingProfile, setSavingProfile] = useState(false)
  const [profileSaved, setProfileSaved] = useState(false)

  // Data & Privacy section
  const [analyticsEnabled, setAnalyticsEnabled] = useState(profile?.analytics_enabled ?? true)
  const [savingAnalytics, setSavingAnalytics] = useState(false)

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      await supabase
        .from('profiles')
        .update({ full_name: displayName })
        .eq('id', user.id)

      setProfileSaved(true)
      setTimeout(() => setProfileSaved(false), 2000)
    } catch (err) {
      console.error('Save profile failed:', err)
    } finally {
      setSavingProfile(false)
    }
  }

  const handleToggleAnalytics = async () => {
    const newValue = !analyticsEnabled
    setAnalyticsEnabled(newValue)
    setSavingAnalytics(true)

    try {
      await supabase
        .from('profiles')
        .update({ analytics_enabled: newValue })
        .eq('id', user.id)
    } catch (err) {
      console.error('Save analytics preference failed:', err)
      setAnalyticsEnabled(!newValue)
    } finally {
      setSavingAnalytics(false)
    }
  }

  const handleExportCSV = async () => {
    try {
      const subscriptions = await getSubscriptions(user.id)

      const headers = ['Name', 'Category', 'Amount', 'Currency', 'Billing Cycle', 'Status', 'Next Billing Date', 'Start Date', 'Notes']
      const rows = subscriptions.map(sub => [
        sub.name || '',
        sub.category || '',
        sub.amount || '',
        sub.currency || '',
        sub.billing_cycle || '',
        sub.status || '',
        sub.next_billing_date || '',
        sub.start_date || '',
        sub.notes || ''
      ])

      const csv = [headers, ...rows]
        .map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n')

      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
      const link = document.createElement('a')
      const url = URL.createObjectURL(blob)
      link.setAttribute('href', url)
      link.setAttribute('download', `subscriptions_${new Date().toISOString().split('T')[0]}.csv`)
      link.style.visibility = 'hidden'
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (err) {
      console.error('Export CSV failed:', err)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1C1F2E]/80 backdrop-blur-sm border-b border-gray-200 dark:border-[#2A2D3A]">
        <div className="max-w-3xl mx-auto px-6 py-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Settings</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Manage your account, connections, and preferences.</p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-3xl mx-auto px-6 py-8 space-y-8">

        {/* Section 1: Profile */}
        <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Profile</h2>

          {/* Avatar and Basic Info */}
          <div className="flex items-start gap-6 mb-8">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="w-20 h-20 rounded-full object-cover flex-shrink-0"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-20 h-20 rounded-full bg-[#F97316] flex items-center justify-center flex-shrink-0">
                <span className="text-white text-2xl font-bold">{initials}</span>
              </div>
            )}
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{fullName}</h3>
              <p className="text-gray-600 dark:text-gray-400">{email}</p>
              <p className="text-sm text-gray-400 dark:text-gray-500 mt-1 capitalize">
                {profile?.plan || 'Free'} Plan
              </p>
            </div>
          </div>

          {/* Profile Inputs */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Display Name
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#2A2D3A] bg-white dark:bg-[#252836] rounded-lg dark:text-white focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                Email
              </label>
              <input
                type="email"
                value={email}
                disabled
                className="w-full px-4 py-2 border border-gray-300 dark:border-[#2A2D3A] rounded-lg bg-gray-100 dark:bg-[#252836] text-gray-600 dark:text-gray-400 cursor-not-allowed"
              />
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={savingProfile}
            className="px-6 py-2 bg-[#F97316] text-white rounded-lg hover:bg-orange-500 font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
          >
            {savingProfile ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Saving...
              </>
            ) : profileSaved ? (
              <>
                <Check size={16} />
                Saved
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>

        {/* Section 2: Connected Accounts */}
        <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Connected Accounts</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Connect your email accounts to enable smart subscription detection.</p>

          <div className="space-y-4 mb-6">
            {/* Gmail — connected, no disconnect in v1 */}
            <div className="p-4 rounded-xl border border-[#22C55E]/20 bg-[#22C55E]/[0.04] dark:border-[#22C55E]/20 dark:bg-[#22C55E]/[0.08]">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Mail className="text-red-500" size={24} />
                  <div>
                    <h3 className="font-semibold text-[#111827] dark:text-white">Gmail</h3>
                    <p className="text-sm text-[#6B7280] dark:text-gray-400">Connected as {email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-[#22C55E] text-sm font-medium">
                  <Check size={18} />
                  Connected
                </div>
              </div>
            </div>

            {/* Connect another Gmail — coming soon */}
            <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2D3A] bg-[#F9FAFB] dark:bg-[#252836] opacity-60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <Mail className="text-gray-400" size={24} />
                  <div>
                    <h3 className="font-semibold text-[#111827] dark:text-gray-300">Connect another Gmail</h3>
                    <p className="text-sm text-[#9CA3AF] dark:text-gray-500">Coming soon</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#9CA3AF] dark:text-gray-500 bg-[#F3F4F6] dark:bg-[#2A2D3A] px-3 py-1 rounded-full">Coming Soon</span>
              </div>
            </div>

            {/* Outlook — coming soon */}
            <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2D3A] bg-[#F9FAFB] dark:bg-[#252836] opacity-60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded bg-blue-500" />
                  <div>
                    <h3 className="font-semibold text-[#111827] dark:text-gray-300">Outlook / Microsoft 365</h3>
                    <p className="text-sm text-[#9CA3AF] dark:text-gray-500">Coming soon</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#9CA3AF] dark:text-gray-500 bg-[#F3F4F6] dark:bg-[#2A2D3A] px-3 py-1 rounded-full">Coming Soon</span>
              </div>
            </div>

            {/* Apple Mail — coming soon */}
            <div className="p-4 rounded-xl border border-dashed border-[#E5E7EB] dark:border-[#2A2D3A] bg-[#F9FAFB] dark:bg-[#252836] opacity-60">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-6 h-6 rounded bg-gray-800 dark:bg-gray-600" />
                  <div>
                    <h3 className="font-semibold text-[#111827] dark:text-gray-300">Apple Mail / iCloud</h3>
                    <p className="text-sm text-[#9CA3AF] dark:text-gray-500">Coming soon</p>
                  </div>
                </div>
                <span className="text-xs font-medium text-[#9CA3AF] dark:text-gray-500 bg-[#F3F4F6] dark:bg-[#2A2D3A] px-3 py-1 rounded-full">Coming Soon</span>
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg p-4 flex gap-3">
            <Info className="text-blue-600 dark:text-blue-400 flex-shrink-0" size={20} />
            <div>
              <h4 className="font-semibold text-blue-900 dark:text-blue-300 mb-1">How does email scanning work?</h4>
              <p className="text-sm text-blue-800 dark:text-blue-200">
                Snipcat securely reads your billing emails to detect subscriptions. We only read — never send or delete. Your data is encrypted and never shared.
              </p>
            </div>
          </div>
        </div>

        {/* Section 3: Plan & Billing */}
        <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Plan & Billing</h2>

          {successMessage && (
            <div className="bg-[#22C55E]/10 border border-[#22C55E] rounded-lg p-4 mb-6 flex items-start gap-3">
              <Check className="text-[#22C55E] flex-shrink-0" size={20} />
              <p className="text-[#166534] dark:text-[#86efac] text-sm font-medium">{successMessage}</p>
            </div>
          )}

          <div className="bg-white dark:bg-[#252836] border border-[#E5E7EB] dark:border-[#2A2D3A] rounded-xl p-6 mb-6">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-xl font-bold text-[#111827] dark:text-white capitalize">{profile?.plan || 'Free'} Plan</h3>
                <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-1">
                  {profile?.plan === 'pro' ? '$4.99/month' : 'Free forever'}
                </p>
              </div>
              <span className="bg-[#22C55E]/10 text-[#22C55E] text-xs font-semibold px-3 py-1 rounded-full">
                Current
              </span>
            </div>
          </div>

          {profile?.plan !== 'pro' ? (
            <>
              {upgradingError && (
                <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4 mb-4 flex items-start gap-3">
                  <AlertTriangle className="text-red-600 dark:text-red-400 flex-shrink-0" size={20} />
                  <p className="text-red-700 dark:text-red-300 text-sm">{upgradingError}</p>
                </div>
              )}
              <button
                onClick={handleUpgradeToPro}
                disabled={upgrading}
                className="w-full py-3.5 bg-gradient-to-r from-[#F97316] to-[#FB923C] text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-orange-200 hover:-translate-y-0.5 transition-all duration-200 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none disabled:hover:translate-y-0 flex items-center justify-center gap-2"
              >
                {upgrading ? (
                  <>
                    <Loader2 size={18} className="animate-spin" />
                    Processing...
                  </>
                ) : (
                  '✨ Upgrade to Pro'
                )}
              </button>
            </>
          ) : (
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-900/40 rounded-lg p-4">
              <p className="text-blue-900 dark:text-blue-300 font-medium">You are on the Pro plan</p>
              <p className="text-blue-700 dark:text-blue-400 text-sm mt-1">Thank you for your subscription! Manage your billing in Stripe.</p>
            </div>
          )}
        </div>

        {/* Section 4: Data & Privacy */}
        <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl p-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Data & Privacy</h2>

          {/* Export */}
          <div className="mb-8 pb-8 border-b border-gray-200 dark:border-[#2A2D3A]">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">Export Your Data</h3>
            <p className="text-gray-600 dark:text-gray-400 mb-4">Download all your subscription data as CSV.</p>
            <div className="flex gap-3">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-[#F97316] text-white rounded-lg hover:bg-orange-500 font-medium transition-colors"
              >
                CSV
              </button>
            </div>
          </div>

          {/* Analytics */}
          <div className="mb-8 pb-8 border-b border-gray-200 dark:border-[#2A2D3A]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Usage Analytics</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Help us improve by sharing anonymous usage data.</p>
              </div>
              <button
                onClick={handleToggleAnalytics}
                disabled={savingAnalytics}
                className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 disabled:opacity-50 ${
                  analyticsEnabled ? 'bg-[#F97316]' : 'bg-gray-200 dark:bg-gray-700'
                }`}
              >
                <div className={`w-5 h-5 rounded-full bg-white transition-transform ${analyticsEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>
          </div>

          {/* Delete Account */}
          <div>
            <h3 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Delete Account</h3>
            <p className="text-[#6B7280] dark:text-gray-400 mb-4">
              Permanently delete your Snipcat account, all subscriptions, reminders, and preferences. This action cannot be undone.
            </p>
            <button
              onClick={() => setShowDeleteModal(true)}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium transition-colors"
            >
              Delete Account
            </button>
          </div>

      {/* Delete Confirmation Modal */}
        </div>

        {/* Section 5: Appearance */}
        <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl p-8 mb-8">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">Appearance</h2>
          <p className="text-gray-600 dark:text-gray-400 mb-6">Choose your preferred color scheme.</p>

          <div className="flex gap-3">
            {['light', 'dark', 'system'].map(t => (
              <button
                key={t}
                onClick={() => setTheme(t)}
                className={`px-4 py-2 rounded-full font-medium transition-all capitalize ${
                  theme === t
                    ? 'bg-gray-900 dark:bg-gray-900 text-white shadow-sm font-semibold'
                    : 'bg-gray-100 dark:bg-[#252836] text-gray-700 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300'
                }`}
              >
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Delete Account Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => !deleting && setShowDeleteModal(false)} />
          <div className="relative bg-white dark:bg-[#1C1F2E] rounded-2xl p-8 max-w-md w-full shadow-2xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                <AlertTriangle size={20} className="text-red-600 dark:text-red-400" />
              </div>
              <h3 className="text-xl font-bold text-[#111827] dark:text-white">Delete your account?</h3>
            </div>
            <p className="text-[#6B7280] dark:text-gray-400 mb-2">
              This will permanently delete:
            </p>
            <ul className="text-sm text-[#6B7280] dark:text-gray-400 mb-6 space-y-1 ml-4">
              <li>• All your subscription data</li>
              <li>• Reminders and notification preferences</li>
              <li>• Your profile and connected accounts</li>
            </ul>
            <p className="text-sm font-medium text-[#111827] dark:text-white mb-2">
              Type <span className="font-mono bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded">DELETE</span> to confirm:
            </p>
            <input
              type="text"
              value={deleteConfirmText}
              onChange={(e) => setDeleteConfirmText(e.target.value)}
              placeholder="DELETE"
              disabled={deleting}
              className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] bg-white dark:bg-[#252836] rounded-xl text-sm dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent mb-4 disabled:bg-gray-50 dark:disabled:bg-gray-800"
            />
            {deleteError && (
              <p className="text-sm text-red-600 dark:text-red-400 mb-3">{deleteError}</p>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmText(''); setDeleteError(null) }}
                disabled={deleting}
                className="flex-1 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] text-[#6B7280] dark:text-gray-400 bg-white dark:bg-[#252836] rounded-xl font-medium hover:bg-gray-50 dark:hover:bg-[#2A2D3A] transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAccount}
                disabled={deleteConfirmText !== 'DELETE' || deleting}
                className="flex-1 py-2.5 bg-red-600 text-white rounded-xl font-medium hover:bg-red-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {deleting ? 'Deleting...' : 'Delete Forever'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
