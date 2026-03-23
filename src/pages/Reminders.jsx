import { useState, useEffect, useCallback } from 'react'
import { Bell } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSubscriptions, getUpcomingRenewals } from '../lib/subscriptions'
import {
  getNotificationPrefs,
  upsertNotificationPrefs,
  RENEWAL_DAYS_OPTIONS,
  DIGEST_DAY_OPTIONS,
  DEFAULT_PREFS,
} from '../lib/notifications'

const Toggle = ({ enabled, onChange, disabled }) => (
  <div
    onClick={disabled ? undefined : onChange}
    className={`w-11 h-6 rounded-full transition-colors flex items-center p-0.5 ${
      disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
    } ${enabled ? 'bg-[#F97316]' : 'bg-gray-200 dark:bg-[#2A2D3A]'}`}
  >
    <div
      className={`w-5 h-5 rounded-full bg-white transition-transform ${
        enabled ? 'translate-x-5' : 'translate-x-0'
      }`}
    />
  </div>
)

const Reminders = () => {
  const { user } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState(null) // 'saved' | 'error' | null
  const [prefs, setPrefs] = useState(DEFAULT_PREFS)

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const [subs, savedPrefs] = await Promise.all([
        getSubscriptions(user.id),
        getNotificationPrefs(user.id),
      ])
      setSubscriptions(subs)
      setPrefs(savedPrefs)
    } catch (err) {
      console.error('Failed to load data:', err)
    } finally {
      setLoading(false)
    }
  }

  // Persist a single preference update to DB
  const updatePref = useCallback(async (key, value) => {
    const newPrefs = { ...prefs, [key]: value }
    setPrefs(newPrefs)
    setSaving(true)
    setSaveStatus(null)
    try {
      await upsertNotificationPrefs(user.id, { [key]: value })
      setSaveStatus('saved')
      setTimeout(() => setSaveStatus(null), 2000)
    } catch (err) {
      console.error('Failed to save preference:', err)
      setSaveStatus('error')
      // Rollback optimistic update
      setPrefs(prefs)
    } finally {
      setSaving(false)
    }
  }, [user, prefs])

  const togglePref = (key) => updatePref(key, !prefs[key])

  // Group upcoming renewals by timeframe
  const today = new Date()
  const thisWeek = getUpcomingRenewals(subscriptions, 7)
  const thisMonth = subscriptions
    .filter(s => {
      if (s.status !== 'active' || !s.next_billing_date) return false
      const d = new Date(s.next_billing_date)
      const diff = Math.ceil((d - today) / (1000 * 60 * 60 * 24))
      return diff > 7 && diff <= 30
    })
    .sort((a, b) => new Date(a.next_billing_date) - new Date(b.next_billing_date))

  // Active trials expiring soon
  const trials = subscriptions
    .filter(s => s.is_trial && s.trial_end_date && s.status === 'active')
    .sort((a, b) => new Date(a.trial_end_date) - new Date(b.trial_end_date))

  const getDaysLeft = (dateStr) => {
    if (!dateStr) return null
    return Math.ceil((new Date(dateStr) - today) / (1000 * 60 * 60 * 24))
  }

  const getUrgencyColor = (daysLeft) => {
    if (daysLeft <= 2) return 'text-red-600'
    if (daysLeft <= 5) return 'text-amber-600'
    return 'text-gray-600'
  }

  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '—'

  const currentRenewalLabel =
    RENEWAL_DAYS_OPTIONS.find(o => o.value === prefs.renewal_days_before)?.label || '3 days before'
  const currentDigestLabel =
    DIGEST_DAY_OPTIONS.find(o => o.value === prefs.weekly_digest_day)?.label || 'Every Monday'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500">Loading reminders...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 dark:bg-[#1C1F2E]/80 backdrop-blur-sm border-b border-gray-200 dark:border-[#2A2D3A]">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-1">Reminders</h1>
              <p className="text-gray-600 dark:text-gray-400">Never miss a renewal or free trial ending again.</p>
            </div>
            {/* Save status indicator */}
            {(saving || saveStatus) && (
              <div className={`text-sm font-medium px-3 py-1.5 rounded-full transition-all ${
                saving ? 'bg-gray-100 dark:bg-[#252836] text-gray-500 dark:text-gray-500' :
                saveStatus === 'saved' ? 'bg-green-100 dark:bg-green-500/10 text-green-700 dark:text-green-400' :
                'bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400'
              }`}>
                {saving ? 'Saving…' : saveStatus === 'saved' ? '✓ Saved' : '✕ Save failed'}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Section 1: Upcoming This Week */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Upcoming This Week</h2>

          {thisWeek.length === 0 ? (
            <div className="bg-green-50 dark:bg-green-500/10 border border-green-200 dark:border-green-500/20 rounded-xl p-6 text-center">
              <p className="text-green-700 dark:text-green-400 font-medium">No renewals this week. You're all good!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {thisWeek.map(item => {
                const daysLeft = getDaysLeft(item.next_billing_date)
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-5 border ${
                      daysLeft <= 2 ? 'bg-red-50 dark:bg-red-500/10 border-red-200 dark:border-red-500/20' : 'bg-white dark:bg-[#1C1F2E] border-gray-200 dark:border-[#2A2D3A] shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                          <p className={`text-sm font-medium ${getUrgencyColor(daysLeft)}`}>
                            Renews in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — {formatDate(item.next_billing_date)}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900 dark:text-white text-lg">${Number(item.amount).toFixed(2)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* Section 2: Later This Month */}
        {thisMonth.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Later This Month</h2>
            <div className="grid gap-4">
              {thisMonth.map(item => {
                const daysLeft = getDaysLeft(item.next_billing_date)
                return (
                  <div key={item.id} className="bg-white dark:bg-[#1C1F2E] border border-gray-200 dark:border-[#2A2D3A] rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                          <p className="text-sm text-gray-600 dark:text-gray-400">
                            {formatDate(item.next_billing_date)} · {daysLeft} days away
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900 dark:text-white">${Number(item.amount).toFixed(2)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Section 3: Active Trials */}
        {trials.length > 0 && (
          <section className="mb-14">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Active Free Trials</h2>
            <div className="space-y-3">
              {trials.map(item => {
                const daysLeft = getDaysLeft(item.trial_end_date)
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-5 border ${
                      daysLeft <= 3 ? 'bg-purple-50 dark:bg-purple-500/10 border-purple-200 dark:border-purple-500/20' : 'bg-white dark:bg-[#1C1F2E] border-gray-200 dark:border-[#2A2D3A] shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center font-semibold">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-semibold text-gray-900 dark:text-white">{item.name}</p>
                            <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 font-medium">Trial</span>
                          </div>
                          <p className={`text-sm font-medium ${daysLeft <= 3 ? 'text-purple-700' : 'text-gray-600 dark:text-gray-400'}`}>
                            {daysLeft <= 0
                              ? 'Trial ended'
                              : `Trial ends in ${daysLeft} day${daysLeft !== 1 ? 's' : ''} — ${formatDate(item.trial_end_date)}`
                            }
                          </p>
                        </div>
                      </div>
                      {item.amount > 0 && (
                        <div className="text-right">
                          <p className="font-semibold text-gray-900 dark:text-white">${Number(item.amount).toFixed(2)}</p>
                          <p className="text-xs text-gray-500 dark:text-gray-500">after trial</p>
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state */}
        {subscriptions.length === 0 && (
          <section className="mb-14 text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-50 dark:bg-[#F97316]/10 flex items-center justify-center">
              <Bell size={28} className="text-[#F97316]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No reminders yet</h3>
            <p className="text-gray-500 dark:text-gray-400 mb-6">Add some subscriptions first, and reminders will show up here automatically.</p>
          </section>
        )}

        {/* Section 4: Notification Preferences */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Notification Preferences</h2>
            {!prefs.email_notifications_enabled && (
              <span className="text-sm text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-[#252836] px-3 py-1.5 rounded-full">
                All emails paused
              </span>
            )}
          </div>
          <div className="bg-white dark:bg-[#1C1F2E] border border-gray-200 dark:border-[#2A2D3A] rounded-xl overflow-hidden">

            {/* Email Notifications master toggle — FIRST so it's visually prominent */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-[#2A2D3A] flex items-center justify-between bg-gray-50 dark:bg-[#252836]">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 dark:text-white mb-1">Email Notifications</p>
                <p className="text-sm text-gray-600 dark:text-gray-400">Master switch — turn off to pause all emails</p>
              </div>
              <div className="ml-6">
                <Toggle
                  enabled={prefs.email_notifications_enabled}
                  onChange={() => togglePref('email_notifications_enabled')}
                />
              </div>
            </div>

            {/* Renewal Reminders */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-[#2A2D3A] flex items-center justify-between">
              <div className="flex-1">
                <p className={`font-semibold mb-1 ${!prefs.email_notifications_enabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                  Renewal Reminders
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified before your subscriptions renew</p>
              </div>
              <div className="flex items-center gap-4 ml-6">
                <select
                  value={currentRenewalLabel}
                  onChange={e => {
                    const opt = RENEWAL_DAYS_OPTIONS.find(o => o.label === e.target.value)
                    if (opt) updatePref('renewal_days_before', opt.value)
                  }}
                  disabled={!prefs.renewal_reminders_enabled || !prefs.email_notifications_enabled}
                  className="px-3 py-2 border border-gray-300 dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316] disabled:bg-gray-50 dark:disabled:bg-[#252836] disabled:text-gray-400 dark:disabled:text-gray-500"
                >
                  {RENEWAL_DAYS_OPTIONS.map(o => (
                    <option key={o.value}>{o.label}</option>
                  ))}
                </select>
                <Toggle
                  enabled={prefs.renewal_reminders_enabled}
                  onChange={() => togglePref('renewal_reminders_enabled')}
                  disabled={!prefs.email_notifications_enabled}
                />
              </div>
            </div>

            {/* Price Change Alerts */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-[#2A2D3A] flex items-center justify-between">
              <div className="flex-1">
                <p className={`font-semibold mb-1 ${!prefs.email_notifications_enabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                  Price Change Alerts
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get notified when a subscription price changes (detected on scan)</p>
              </div>
              <div className="ml-6">
                <Toggle
                  enabled={prefs.price_change_alerts_enabled}
                  onChange={() => togglePref('price_change_alerts_enabled')}
                  disabled={!prefs.email_notifications_enabled}
                />
              </div>
            </div>

            {/* Free Trial Warnings */}
            <div className="px-6 py-5 border-b border-gray-100 dark:border-[#2A2D3A] flex items-center justify-between">
              <div className="flex-1">
                <p className={`font-semibold mb-1 ${!prefs.email_notifications_enabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                  Free Trial Warnings
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Get alerted 3 days before your free trial ends</p>
              </div>
              <div className="ml-6">
                <Toggle
                  enabled={prefs.free_trial_warnings_enabled}
                  onChange={() => togglePref('free_trial_warnings_enabled')}
                  disabled={!prefs.email_notifications_enabled}
                />
              </div>
            </div>

            {/* Weekly Spending Digest */}
            <div className="px-6 py-5 flex items-center justify-between">
              <div className="flex-1">
                <p className={`font-semibold mb-1 ${!prefs.email_notifications_enabled ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-white'}`}>
                  Spending Digest
                </p>
                <p className="text-sm text-gray-500 dark:text-gray-400">Receive a summary of your subscription expenses</p>
              </div>
              <div className="flex items-center gap-4 ml-6">
                <select
                  value={currentDigestLabel}
                  onChange={e => {
                    const opt = DIGEST_DAY_OPTIONS.find(o => o.label === e.target.value)
                    if (opt) updatePref('weekly_digest_day', opt.value)
                  }}
                  disabled={!prefs.weekly_digest_enabled || !prefs.email_notifications_enabled}
                  className="px-3 py-2 border border-gray-300 dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316] disabled:bg-gray-50 dark:disabled:bg-[#252836] disabled:text-gray-400 dark:disabled:text-gray-500"
                >
                  {DIGEST_DAY_OPTIONS.map(o => (
                    <option key={o.value}>{o.label}</option>
                  ))}
                </select>
                <Toggle
                  enabled={prefs.weekly_digest_enabled}
                  onChange={() => togglePref('weekly_digest_enabled')}
                  disabled={!prefs.email_notifications_enabled}
                />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Reminders
