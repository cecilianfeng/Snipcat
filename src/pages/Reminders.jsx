import { useState, useEffect } from 'react'
import { Bell, Plus, AlertTriangle, Inbox } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSubscriptions, getUpcomingRenewals } from '../lib/subscriptions'

const Toggle = ({ enabled, onChange }) => (
  <div
    onClick={onChange}
    className={`w-11 h-6 rounded-full cursor-pointer transition-colors ${
      enabled ? 'bg-[#F97316]' : 'bg-gray-200'
    } flex items-center p-0.5`}
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
  const [prefs, setPrefs] = useState({
    renewalReminder: true,
    renewalDays: '3 days before',
    priceChange: true,
    trialWarning: true,
    weeklyDigest: false,
    digestDay: 'Every Monday',
    emailNotif: true,
  })

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const data = await getSubscriptions(user.id)
      setSubscriptions(data)
    } catch (err) {
      console.error('Failed to load subscriptions:', err)
    } finally {
      setLoading(false)
    }
  }

  const togglePref = (key) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }))
  const updateDropdown = (key, value) => setPrefs(prev => ({ ...prev, [key]: value }))

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

  const getDaysLeft = (dateStr) => {
    if (!dateStr) return null
    const diff = Math.ceil((new Date(dateStr) - today) / (1000 * 60 * 60 * 24))
    return diff
  }

  const getUrgencyColor = (daysLeft) => {
    if (daysLeft <= 2) return 'text-red-600'
    if (daysLeft <= 5) return 'text-amber-600'
    return 'text-gray-600'
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '—'

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading reminders...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur-sm border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-1">Reminders</h1>
              <p className="text-gray-600">Never miss a renewal or free trial ending again.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Section 1: Upcoming This Week */}
        <section className="mb-14">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Upcoming This Week</h2>

          {thisWeek.length === 0 ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-6 text-center">
              <p className="text-green-700 font-medium">No renewals this week. You're all good!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {thisWeek.map(item => {
                const daysLeft = getDaysLeft(item.next_billing_date)
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-5 border ${
                      daysLeft <= 2 ? 'bg-red-50 border-red-200' : 'bg-white border-gray-200 shadow-sm'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className={`text-sm font-medium ${getUrgencyColor(daysLeft)}`}>
                            Renews in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — {formatDate(item.next_billing_date)}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-gray-900 text-lg">${Number(item.amount).toFixed(2)}</p>
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
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Later This Month</h2>
            <div className="grid gap-4">
              {thisMonth.map(item => {
                const daysLeft = getDaysLeft(item.next_billing_date)
                return (
                  <div key={item.id} className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          <p className="text-sm text-gray-600">
                            {formatDate(item.next_billing_date)} · {daysLeft} days away
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-gray-900">${Number(item.amount).toFixed(2)}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* Empty state if no subscriptions at all */}
        {subscriptions.length === 0 && (
          <section className="mb-14 text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-orange-50 flex items-center justify-center">
              <Bell size={28} className="text-[#F97316]" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No reminders yet</h3>
            <p className="text-gray-500 mb-6">Add some subscriptions first, and reminders will show up here automatically.</p>
          </section>
        )}

        {/* Section 3: Notification Preferences */}
        <section>
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Notification Preferences</h2>
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
            {/* Renewal Reminders */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Renewal Reminders</p>
                <p className="text-sm text-gray-600">Get notified before your subscriptions renew</p>
              </div>
              <div className="flex items-center gap-4 ml-6">
                <select
                  value={prefs.renewalDays}
                  onChange={e => updateDropdown('renewalDays', e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                >
                  <option>1 day before</option>
                  <option>3 days before</option>
                  <option>7 days before</option>
                  <option>Same day</option>
                </select>
                <Toggle enabled={prefs.renewalReminder} onChange={() => togglePref('renewalReminder')} />
              </div>
            </div>

            {/* Price Change Alerts */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Price Change Alerts</p>
                <p className="text-sm text-gray-600">Be notified when a subscription price increases</p>
              </div>
              <div className="ml-6">
                <Toggle enabled={prefs.priceChange} onChange={() => togglePref('priceChange')} />
              </div>
            </div>

            {/* Free Trial Warnings */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Free Trial Warnings</p>
                <p className="text-sm text-gray-600">Get alerted when your free trial is about to end</p>
              </div>
              <div className="ml-6">
                <Toggle enabled={prefs.trialWarning} onChange={() => togglePref('trialWarning')} />
              </div>
            </div>

            {/* Weekly Spending Digest */}
            <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Weekly Spending Digest</p>
                <p className="text-sm text-gray-600">Receive a summary of your subscription expenses</p>
              </div>
              <div className="flex items-center gap-4 ml-6">
                <select
                  value={prefs.digestDay}
                  onChange={e => updateDropdown('digestDay', e.target.value)}
                  disabled={!prefs.weeklyDigest}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-[#F97316] disabled:bg-gray-50 disabled:text-gray-400"
                >
                  <option>Every Monday</option>
                  <option>Every Friday</option>
                  <option>1st of Month</option>
                </select>
                <Toggle enabled={prefs.weeklyDigest} onChange={() => togglePref('weeklyDigest')} />
              </div>
            </div>

            {/* Email Notifications */}
            <div className="px-6 py-5 flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-gray-900 mb-1">Email Notifications</p>
                <p className="text-sm text-gray-600">Receive reminders via email</p>
              </div>
              <div className="ml-6">
                <Toggle enabled={prefs.emailNotif} onChange={() => togglePref('emailNotif')} />
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Reminders
