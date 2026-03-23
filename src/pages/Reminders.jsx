import { useState, useEffect } from 'react'
import { Bell, Plus, AlertTriangle, Inbox } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSubscriptions, getUpcomingRenewals, getMonthlyEquivalent, getYearlyEquivalent } from '../lib/subscriptions'

const Toggle = ({ enabled, onChange }) => (
  <div
    onClick={onChange}
    className={`w-11 h-6 rounded-full cursor-pointer transition-colors ${
      enabled ? 'bg-[#F97316]' : 'bg-[#E5E7EB]'
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

  // ─── CURRENCY CONVERSION (same as Dashboard) ───
  const RATES_TO_USD = {
    USD: 1, CAD: 0.74, CNY: 0.14, EUR: 1.09, GBP: 1.27, AUD: 0.66,
    JPY: 0.0067, KRW: 0.00075, INR: 0.012, SGD: 0.75, HKD: 0.13,
    TWD: 0.031, MYR: 0.22, CHF: 1.13, BRL: 0.20, SEK: 0.097,
  }
  const CURRENCY_SYMBOLS = {
    USD: '$', CAD: 'CA$', CNY: '¥', EUR: '€', GBP: '£', AUD: 'A$',
    JPY: '¥', KRW: '₩', INR: '₹', SGD: 'S$', HKD: 'HK$',
    TWD: 'NT$', MYR: 'RM', CHF: 'CHF ', BRL: 'R$', SEK: 'kr ',
  }
  const getDominantCurrency = () => {
    const counts = {}
    subscriptions.filter(s => s.status === 'active' && s.amount > 0).forEach(s => {
      const c = s.currency || 'USD'
      counts[c] = (counts[c] || 0) + 1
    })
    let max = 0, dominant = 'USD'
    for (const [c, n] of Object.entries(counts)) {
      if (n > max) { max = n; dominant = c }
    }
    return dominant
  }
  const dominantCurrency = getDominantCurrency()
  const dominantSymbol = CURRENCY_SYMBOLS[dominantCurrency] || dominantCurrency + ' '
  const convertToDominant = (amount, fromCurrency) => {
    if (!amount) return 0
    const from = fromCurrency || 'USD'
    if (from === dominantCurrency) return amount
    const usdAmount = amount * (RATES_TO_USD[from] || 1)
    const rate = RATES_TO_USD[dominantCurrency] || 1
    return usdAmount / rate
  }
  const getMonthlyInDominant = (sub) => {
    const monthly = getMonthlyEquivalent(sub)
    return convertToDominant(monthly, sub.currency || 'USD')
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
    if (daysLeft <= 2) return 'text-[#EF4444]'
    if (daysLeft <= 5) return 'text-[#D97706]'
    return 'text-[#6B7280]'
  }

  const formatDate = (d) => d ? new Date(d).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }) : '—'

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-[#6B7280]">Loading reminders...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/90 backdrop-blur-md border-b border-[#E5E7EB]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-3xl font-bold text-[#111827] mb-1">Reminders</h1>
              <p className="text-[#6B7280]">Never miss a renewal or free trial ending again.</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Section 1: Upcoming This Week */}
        <section className="mb-14">
          <h2 className="text-xl font-bold text-[#111827] mb-6">Upcoming This Week</h2>

          {thisWeek.length === 0 ? (
            <div className="bg-[#22C55E]/[0.05] border border-[#22C55E]/20 rounded-2xl p-6 text-center">
              <p className="text-[#22C55E] font-medium">No renewals this week. You're all good!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {thisWeek.map(item => {
                const daysLeft = getDaysLeft(item.next_billing_date)
                return (
                  <div
                    key={item.id}
                    className={`rounded-2xl p-5 border ${
                      daysLeft <= 2 ? 'bg-[#EF4444]/[0.05] border-[#EF4444]/20' : 'bg-white border-[#F3F4F6] shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-[#FFF5F0] text-[#F97316] flex items-center justify-center font-semibold">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#111827]">{item.name}</p>
                          <p className={`text-sm font-medium ${getUrgencyColor(daysLeft)}`}>
                            Renews in {daysLeft} day{daysLeft !== 1 ? 's' : ''} — {formatDate(item.next_billing_date)}
                          </p>
                        </div>
                      </div>
                      <p className="font-semibold text-[#111827] text-lg">{dominantSymbol}{getMonthlyInDominant(item).toFixed(2)}/mo</p>
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
            <h2 className="text-xl font-bold text-[#111827] mb-6">Later This Month</h2>
            <div className="grid gap-4">
              {thisMonth.map(item => {
                const daysLeft = getDaysLeft(item.next_billing_date)
                return (
                  <div key={item.id} className="bg-white rounded-2xl border border-[#F3F4F6] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] transition-shadow">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-11 h-11 rounded-full bg-[#FFF5F0] text-[#F97316] flex items-center justify-center font-semibold">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-semibold text-[#111827]">{item.name}</p>
                          <p className="text-sm text-[#6B7280]">
                            {formatDate(item.next_billing_date)} · {daysLeft} days away
                          </p>
                        </div>
                      </div>
                      <p className="font-bold text-[#111827]">{dominantSymbol}{getMonthlyInDominant(item).toFixed(2)}/mo</p>
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
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-[#FFF5F0] flex items-center justify-center">
              <Bell size={28} className="text-[#F97316]" />
            </div>
            <h3 className="text-xl font-bold text-[#111827] mb-2">No reminders yet</h3>
            <p className="text-[#9CA3AF] mb-6">Add some subscriptions first, and reminders will show up here automatically.</p>
          </section>
        )}

        {/* Section 3: Notification Preferences */}
        <section>
          <h2 className="text-xl font-bold text-[#111827] mb-6">Notification Preferences</h2>
          <div className="bg-white rounded-2xl border border-[#E5E7EB] overflow-hidden">
            {/* Renewal Reminders */}
            <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-[#111827] mb-1">Renewal Reminders</p>
                <p className="text-sm text-[#6B7280]">Get notified before your subscriptions renew</p>
              </div>
              <div className="flex items-center gap-4 ml-6">
                <select
                  value={prefs.renewalDays}
                  onChange={e => updateDropdown('renewalDays', e.target.value)}
                  className="px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#F97316]"
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
            <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-[#111827] mb-1">Price Change Alerts</p>
                <p className="text-sm text-[#6B7280]">Be notified when a subscription price increases</p>
              </div>
              <div className="ml-6">
                <Toggle enabled={prefs.priceChange} onChange={() => togglePref('priceChange')} />
              </div>
            </div>

            {/* Free Trial Warnings */}
            <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-[#111827] mb-1">Free Trial Warnings</p>
                <p className="text-sm text-[#6B7280]">Get alerted when your free trial is about to end</p>
              </div>
              <div className="ml-6">
                <Toggle enabled={prefs.trialWarning} onChange={() => togglePref('trialWarning')} />
              </div>
            </div>

            {/* Weekly Spending Digest */}
            <div className="px-6 py-5 border-b border-[#F3F4F6] flex items-center justify-between">
              <div className="flex-1">
                <p className="font-semibold text-[#111827] mb-1">Weekly Spending Digest</p>
                <p className="text-sm text-[#6B7280]">Receive a summary of your subscription expenses</p>
              </div>
              <div className="flex items-center gap-4 ml-6">
                <select
                  value={prefs.digestDay}
                  onChange={e => updateDropdown('digestDay', e.target.value)}
                  disabled={!prefs.weeklyDigest}
                  className="px-3 py-2 border border-[#E5E7EB] rounded-xl text-sm text-[#6B7280] focus:outline-none focus:ring-2 focus:ring-[#F97316] disabled:bg-white disabled:text-[#9CA3AF]"
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
                <p className="font-semibold text-[#111827] mb-1">Email Notifications</p>
                <p className="text-sm text-[#6B7280]">Receive reminders via email</p>
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
