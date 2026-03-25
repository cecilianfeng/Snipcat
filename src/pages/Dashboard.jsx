import { useState, useEffect } from 'react'
import {
  DollarSign,
  Package,
  Clock,
  TrendingDown,
  Mail,
  ChevronDown,
  ChevronUp,
  Plus,
  Inbox,
  Loader2,
  CheckCircle,
  Scissors,
  Info,
  X,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  calcMonthlyTotal,
  calcYearlyTotal,
  getMonthlyEquivalent,
  getYearlyEquivalent,
  calcCancelledSavingsMonthly,
  calcCancelledSavingsYearly,
  getUpcomingRenewals,
  CATEGORIES,
} from '../lib/subscriptions'
import { scanGmailForSubscriptions } from '../lib/gmail'
import { getServiceLogo, getColorForName, getServiceInitials } from '../lib/serviceLogos'

const Dashboard = () => {
  const { user, getGoogleToken } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [activeFilter, setActiveFilter] = useState('active')
  const [sortBy, setSortBy] = useState('renewal')
  const [hoveredId, setHoveredId] = useState(null)
  const [costView, setCostView] = useState('monthly') // 'monthly' or 'yearly'
  const [cancelConfirm, setCancelConfirm] = useState(null) // subscription object to confirm cancel
  const [deleteConfirm, setDeleteConfirm] = useState(null) // subscription object to confirm delete
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ phase: 0, message: '', current: 0, total: 0 })
  const [scanResult, setScanResult] = useState(null) // { confirmed, needsReview, addedCount } or { error }
  const [scanMonths, setScanMonths] = useState(36)
  const [reviewItems, setReviewItems] = useState([]) // items needing user confirmation
  const [showPastItems, setShowPastItems] = useState(false)
  const [showScanOptions, setShowScanOptions] = useState(false) // scan month picker popup
  const [showCurrencyInfo, setShowCurrencyInfo] = useState(false) // currency conversion info
  const [modalOpen, setModalOpen] = useState(false) // add subscription modal
  const [editingSub, setEditingSub] = useState(null) // editing mode for modal

  // ─── CURRENCY CONVERSION ───
  // Approximate exchange rates to USD (used for unified display)
  const RATES_TO_USD = {
    USD: 1, CAD: 0.73, CNY: 0.145, EUR: 1.08, GBP: 1.29, AUD: 0.70,
    JPY: 0.00628, KRW: 0.000667, INR: 0.01068, SGD: 0.78, HKD: 0.128,
    TWD: 0.031, MYR: 0.225, CHF: 1.27, BRL: 0.175, SEK: 0.10,
  }
  const CURRENCY_SYMBOLS = {
    USD: '$', CAD: 'CA$', CNY: '¥', EUR: '€', GBP: '£', AUD: 'A$',
    JPY: '¥', KRW: '₩', INR: '₹', SGD: 'S$', HKD: 'HK$',
    TWD: 'NT$', MYR: 'RM', CHF: 'CHF ', BRL: 'R$', SEK: 'kr ',
  }

  // Detect the dominant currency among active subscriptions
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

  // Convert amount from one currency to dominant currency
  const convertToDominant = (amount, fromCurrency) => {
    if (!amount) return 0
    const from = fromCurrency || 'USD'
    if (from === dominantCurrency) return amount
    const usdAmount = amount * (RATES_TO_USD[from] || 1)
    const rate = RATES_TO_USD[dominantCurrency] || 1
    return usdAmount / rate
  }

  // Get monthly equivalent in dominant currency
  const getMonthlyInDominant = (sub) => {
    const monthly = getMonthlyEquivalent(sub)
    return convertToDominant(monthly, sub.currency || 'USD')
  }

  // Get yearly equivalent in dominant currency
  const getYearlyInDominant = (sub) => {
    const yearly = getYearlyEquivalent(sub)
    return convertToDominant(yearly, sub.currency || 'USD')
  }

  useEffect(() => {
    if (!user) return
    loadSubscriptions()
  }, [user])

  const loadSubscriptions = async () => {
    try {
      const data = await getSubscriptions(user.id)
      setSubscriptions(data)
    } catch (err) {
      console.error('Failed to load subscriptions:', err)
    } finally {
      setLoadingData(false)
    }
  }

  const handleScanInbox = async () => {
    setScanning(true)
    setScanResult(null)
    setReviewItems([])
    setScanProgress({ phase: 0, message: 'Starting scan...', current: 0, total: 0 })
    try {
      const token = await getGoogleToken()
      if (!token) {
        setScanResult({ error: 'Gmail access not available. Please sign out and sign in again to grant Gmail permission.' })
        setScanning(false)
        return
      }
      const { confirmed, needsReview } = await scanGmailForSubscriptions(
        token,
        (progress) => setScanProgress(progress),
        { months: scanMonths }
      )
      // Save confirmed subscriptions — add new ones, update existing ones with fresh dates
      const existingByName = {}
      for (const s of subscriptions) {
        existingByName[s.name.toLowerCase()] = s
      }
      let addedCount = 0
      let updatedCount = 0
      for (const sub of confirmed) {
        const existing = existingByName[sub.name.toLowerCase()]
        if (!existing) {
          // New subscription — create it
          try {
            // Strip ALL internal fields (underscore-prefixed) before saving to DB
            const dbSub = {}
            for (const [key, value] of Object.entries(sub)) {
              if (!key.startsWith('_')) dbSub[key] = value
            }
            await createSubscription({ ...dbSub, amount: dbSub.amount || 0, user_id: user.id })
            addedCount++
          } catch (err) {
            console.warn('Failed to add:', sub.name, err)
          }
        } else {
          // Existing subscription — update dates, amount, cycle, and category if we have better data
          try {
            const updates = {}
            if (sub.last_email_date) updates.last_email_date = sub.last_email_date
            if (sub.next_billing_date) updates.next_billing_date = sub.next_billing_date
            if (sub.billing_cycle && !existing.billing_cycle) updates.billing_cycle = sub.billing_cycle
            // Update category if current is 'other' and scan found a real category
            if (sub.category && sub.category !== 'other' && existing.category === 'other') {
              updates.category = sub.category
            }
            if (Object.keys(updates).length > 0) {
              await updateSubscription(existing.id, updates)
              updatedCount++
            }
          } catch (err) {
            console.warn('Failed to update:', sub.name, err)
          }
        }
      }
      // Also update existing subs that match review items (by domain)
      for (const sub of needsReview) {
        const existing = existingByName[sub.name.toLowerCase()]
        if (existing) {
          try {
            const updates = {}
            if (sub.last_email_date) updates.last_email_date = sub.last_email_date
            if (sub.next_billing_date) updates.next_billing_date = sub.next_billing_date
            if (sub.billing_cycle && !existing.billing_cycle) updates.billing_cycle = sub.billing_cycle
            if (sub.category && sub.category !== 'other' && existing.category === 'other') {
              updates.category = sub.category
            }
            if (Object.keys(updates).length > 0) {
              await updateSubscription(existing.id, updates)
              updatedCount++
            }
          } catch (err) { /* skip */ }
        }
      }
      await loadSubscriptions()
      // Set review items for user confirmation (only truly new ones)
      const refreshedSubs = await getSubscriptions(user.id)
      const refreshedNames = new Set(refreshedSubs.map(s => s.name.toLowerCase()))
      const reviewFiltered = needsReview.filter(s => !refreshedNames.has(s.name.toLowerCase()))
      setReviewItems(reviewFiltered)
      setScanResult({ addedCount, updatedCount, confirmedTotal: confirmed.length, reviewCount: reviewFiltered.length })
    } catch (err) {
      console.error('Scan failed:', err)
      // Ensure error message is a clean, user-friendly string (never raw API data)
      let errorMsg = err?.message || 'Scan failed. Please try again.'
      // Truncate if it looks like raw API response (> 200 chars or contains JSON)
      if (errorMsg.length > 200 || errorMsg.includes('{"') || errorMsg.includes('<!DOCTYPE')) {
        errorMsg = 'Gmail scan failed. Please sign out and sign in again to refresh your Gmail access.'
      }
      setScanResult({ error: errorMsg })
    } finally {
      setScanning(false)
    }
  }

  // Update a review item's editable fields
  const handleEditReview = (idx, field, value) => {
    setReviewItems(prev => prev.map((item, i) => {
      if (i !== idx) return item
      if (field === 'amount') {
        const num = parseFloat(value)
        return { ...item, amount: isNaN(num) ? null : num }
      }
      return { ...item, [field]: value }
    }))
  }

  const handleApproveReview = async (item) => {
    try {
      // Strip ALL internal fields (underscore-prefixed) before saving to DB
      const dbSub = {}
      for (const [key, value] of Object.entries(item)) {
        if (!key.startsWith('_')) dbSub[key] = value
      }
      // Ensure amount is a number, not a string
      const amount = parseFloat(dbSub.amount) || 0
      await createSubscription({
        ...dbSub,
        amount,
        billing_cycle: dbSub.billing_cycle || 'monthly',
        status: dbSub.status === 'cancelled' || dbSub.status === 'payment_failed' || dbSub.status === 'expired' || dbSub.status === 'possibly_cancelled' ? 'active' : (dbSub.status || 'active'),
        user_id: user.id,
      })
      setReviewItems(prev => prev.filter(r => r !== item))
      await loadSubscriptions()
    } catch (err) {
      console.warn('Failed to add:', item.name, err)
    }
  }

  const handleDismissReview = (item) => {
    setReviewItems(prev => prev.filter(r => r !== item))
  }

  const handleAddAsCancelled = async (item) => {
    try {
      const dbSub = {}
      for (const [key, value] of Object.entries(item)) {
        if (!key.startsWith('_')) dbSub[key] = value
      }
      const amount = parseFloat(dbSub.amount) || 0
      await createSubscription({
        ...dbSub,
        amount,
        billing_cycle: dbSub.billing_cycle || 'monthly',
        status: 'cancelled',
        user_id: user.id,
      })
      setReviewItems(prev => prev.filter(r => r !== item))
      await loadSubscriptions()
    } catch (err) {
      console.warn('Failed to add as cancelled:', item.name, err)
    }
  }

  // Split review items into active vs past (cancelled/expired/payment_failed)
  const isItemPast = (item) => ['cancelled', 'payment_failed', 'expired', 'possibly_cancelled'].includes(item._aiStatus)
  const activeReviewItems = reviewItems.filter(i => !isItemPast(i))
  const pastReviewItems = reviewItems.filter(i => isItemPast(i))

  // Helper: find the real index in reviewItems for editing
  const getRealIndex = (item) => reviewItems.indexOf(item)

  // Render an active subscription review card — simple: Add or Skip
  const renderActiveReviewCard = (item) => {
    const realIdx = getRealIndex(item)
    const paymentHistory = item._paymentHistory || []
    return (
      <div key={realIdx} className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#F3F4F6] dark:border-[#2A2D3A] p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 transition-all duration-200">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            {item.logo_url ? (
              <img
                src={item.logo_url}
                alt={item.name}
                className="w-9 h-9 rounded-xl mt-0.5 flex-shrink-0 object-cover"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
              />
            ) : null}
            <div
              className="w-9 h-9 rounded-xl bg-[#FFF5F0] dark:bg-[#252836] text-[#F97316] flex items-center justify-center font-bold text-sm mt-0.5 flex-shrink-0"
              style={{ display: item.logo_url ? 'none' : 'flex' }}
            >
              {item.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <input
                type="text"
                value={item.name || ''}
                onChange={(e) => handleEditReview(realIdx, 'name', e.target.value)}
                className="font-semibold text-[#111827] dark:text-white bg-transparent border-b border-transparent hover:border-gray-300 dark:hover:border-gray-700 focus:border-[#F97316] focus:outline-none w-full text-sm dark:bg-transparent"
              />
              <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                {item._emailCount} email{item._emailCount !== 1 ? 's' : ''} found · {item._domain}
                {item.last_email_date && ` · Last: ${new Date(item.last_email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
                {item.next_billing_date && ` · Renews: ${new Date(item.next_billing_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </p>
              {paymentHistory.length > 0 && (
                <p className="text-xs text-blue-600 dark:text-blue-400 mt-0.5">
                  {paymentHistory.length} payment{paymentHistory.length !== 1 ? 's' : ''} found
                  {paymentHistory[0]?.amount && ` · Latest: ${paymentHistory[0].currency || '$'}${paymentHistory[0].amount}`}
                </p>
              )}
              {item._singleEmail && (
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Only 1 email found — please verify</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <span className="text-xs text-gray-500 dark:text-gray-500">Amount:</span>
                <select
                  value={item.currency || 'USD'}
                  onChange={(e) => handleEditReview(realIdx, 'currency', e.target.value)}
                  className="text-xs border border-gray-200 dark:border-[#2A2D3A] rounded px-1 py-0.5 bg-gray-50 dark:bg-[#252836] dark:text-white"
                >
                  <option value="USD">$</option>
                  <option value="CAD">CA$</option>
                  <option value="CNY">¥</option>
                  <option value="EUR">€</option>
                  <option value="GBP">£</option>
                  <option value="AUD">A$</option>
                  <option value="JPY">¥</option>
                  <option value="KRW">₩</option>
                  <option value="INR">₹</option>
                  <option value="SGD">S$</option>
                  <option value="HKD">HK$</option>
                  <option value="TWD">NT$</option>
                  <option value="MYR">RM</option>
                  <option value="CHF">CHF</option>
                  <option value="BRL">R$</option>
                  <option value="SEK">kr</option>
                </select>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={item.amount ?? ''}
                  onChange={(e) => handleEditReview(realIdx, 'amount', e.target.value)}
                  placeholder="—"
                  className="w-20 text-xs border border-gray-200 dark:border-[#2A2D3A] rounded px-2 py-0.5 bg-gray-50 dark:bg-[#252836] dark:text-white text-right"
                />
                <span className="text-xs text-gray-400 dark:text-gray-500">/</span>
                <select
                  value={item.billing_cycle || ''}
                  onChange={(e) => handleEditReview(realIdx, 'billing_cycle', e.target.value)}
                  className={`text-xs border rounded px-1 py-0.5 ${item.billing_cycle ? 'border-gray-200 dark:border-[#2A2D3A] bg-gray-50 dark:bg-[#252836] dark:text-white' : 'border-orange-300 bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400'}`}
                >
                  <option value="">Select cycle</option>
                  <option value="monthly">monthly</option>
                  <option value="quarterly">quarterly</option>
                  <option value="yearly">yearly</option>
                  <option value="weekly">weekly</option>
                </select>
              </div>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0 mt-1">
            <button
              onClick={() => handleApproveReview(item)}
              className="px-4 py-1.5 bg-[#F97316] text-white rounded-full text-sm font-semibold hover:bg-[#EA580C] transition-colors"
            >
              Add
            </button>
            <button
              onClick={() => handleDismissReview(item)}
              className="px-4 py-1.5 bg-[#F9FAFB] dark:bg-[#252836] text-[#6B7280] dark:text-gray-400 rounded-full text-sm font-medium hover:bg-gray-200 dark:hover:bg-[#2A2D3A] transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render a past subscription review card — simple: Track History or Skip
  const renderPastReviewCard = (item) => {
    const realIdx = getRealIndex(item)
    const paymentHistory = item._paymentHistory || []
    return (
      <div key={realIdx} className="bg-white dark:bg-[#1C1F2E] rounded-xl border border-[#F3F4F6] dark:border-[#2A2D3A] p-4 opacity-80 hover:opacity-100 transition-all duration-200">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            {item.logo_url ? (
              <img
                src={item.logo_url}
                alt={item.name}
                className="w-8 h-8 rounded-xl flex-shrink-0 object-cover"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }}
              />
            ) : null}
            <div
              className="w-8 h-8 rounded-xl bg-[#F9FAFB] dark:bg-[#252836] text-[#9CA3AF] dark:text-gray-500 flex items-center justify-center font-bold text-xs flex-shrink-0"
              style={{ display: item.logo_url ? 'none' : 'flex' }}
            >
              {item.name?.charAt(0) || '?'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-700 truncate">{item.name}</p>
              <p className="text-xs text-gray-400">
                {item.amount ? `${item.currency || '$'}${item.amount}/${item.billing_cycle || '?'}` : 'Amount unknown'}
                {paymentHistory.length > 0 && ` · ${paymentHistory.length} payment${paymentHistory.length !== 1 ? 's' : ''} found`}
                {item.last_email_date && ` · Last: ${new Date(item.last_email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`}
              </p>
            </div>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => handleAddAsCancelled(item)}
              className="px-3 py-1.5 border-2 border-[#F97316] text-[#F97316] rounded-full text-xs font-semibold hover:bg-[#FFF5F0] transition-colors"
            >
              Track History
            </button>
            <button
              onClick={() => handleDismissReview(item)}
              className="px-3 py-1.5 bg-[#F9FAFB] dark:bg-[#252836] text-[#9CA3AF] dark:text-gray-500 rounded-full text-xs font-medium hover:bg-gray-200 dark:hover:bg-[#2A2D3A] transition-colors"
            >
              Skip
            </button>
          </div>
        </div>
      </div>
    )
  }

  // Render the full review section (active + collapsible past)
  const renderReviewSection = (maxWidth) => {
    if (activeReviewItems.length === 0 && pastReviewItems.length === 0) return null
    return (
      <div className={`${maxWidth} mx-auto mt-8 text-left`}>
        {/* Active subscriptions needing review */}
        {activeReviewItems.length > 0 && (
          <div className="bg-[#FFF5F0] dark:bg-[#252836] border border-[#F97316]/20 dark:border-[#F97316]/30 rounded-2xl p-6 mb-4">
            <h3 className="font-bold text-[#111827] dark:text-white mb-1">Active subscriptions found — please confirm</h3>
            <p className="text-xs text-[#6B7280] dark:text-gray-400 mb-4">You can edit name, amount, and billing cycle before adding.</p>
            <div className="space-y-3">
              {activeReviewItems.map(item => renderActiveReviewCard(item))}
            </div>
          </div>
        )}

        {/* Past subscriptions — collapsible */}
        {pastReviewItems.length > 0 && (
          <div className="bg-[#F9FAFB] dark:bg-[#252836] border border-[#E5E7EB] dark:border-[#2A2D3A] rounded-2xl p-5">
            <button
              onClick={() => setShowPastItems(!showPastItems)}
              className="flex items-center justify-between w-full text-left"
            >
              <span className="text-sm font-medium text-[#6B7280] dark:text-gray-400">
                We also found {pastReviewItems.length} past subscription{pastReviewItems.length !== 1 ? 's' : ''}
              </span>
              <ChevronDown className={`w-4 h-4 text-gray-400 dark:text-gray-500 transition-transform ${showPastItems ? 'rotate-180' : ''}`} />
            </button>
            {showPastItems && (
              <div className="space-y-2 mt-3">
                {pastReviewItems.map(item => renderPastReviewCard(item))}
              </div>
            )}
          </div>
        )}
      </div>
    )
  }

  const handleCancelSub = async (sub) => {
    try {
      await updateSubscription(sub.id, { status: 'cancelled' })
      await loadSubscriptions()
      setCancelConfirm(null)
    } catch (err) {
      console.error('Cancel failed:', err)
    }
  }

  const handleDeleteSub = async (sub) => {
    try {
      await deleteSubscription(sub.id)
      await loadSubscriptions()
      setDeleteConfirm(null)
    } catch (err) {
      console.error('Delete failed:', err)
    }
  }

  const handleReactivateSub = async (sub) => {
    try {
      await updateSubscription(sub.id, { status: 'active' })
      await loadSubscriptions()
    } catch (err) {
      console.error('Reactivate failed:', err)
    }
  }

  // Calculate stats — responsive to costView toggle, in dominant currency
  const activeCount = subscriptions.filter(s => s.status === 'active' || s.status === 'pending').length
  const monthlyTotal = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + getMonthlyInDominant(s), 0)
  const yearlyTotal = subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => sum + getYearlyInDominant(s), 0)
  const displayTotal = costView === 'monthly' ? monthlyTotal : yearlyTotal
  const upcoming = getUpcomingRenewals(subscriptions, 14)
  const cancelledSavings = subscriptions
    .filter(s => s.status === 'cancelled')
    .reduce((sum, s) => sum + (costView === 'monthly' ? getMonthlyInDominant(s) : getYearlyInDominant(s)), 0)
  const hasMultipleCurrencies = (() => {
    const currencies = new Set(subscriptions.filter(s => s.amount > 0).map(s => s.currency || 'USD'))
    return currencies.size > 1
  })()

  // Filter & sort
  const filtered = subscriptions.filter(sub => {
    if (activeFilter === 'all') return true
    return sub.status === activeFilter
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'renewal') {
      if (a.status === 'cancelled') return 1
      if (b.status === 'cancelled') return -1
      const dateA = a.next_billing_date ? new Date(a.next_billing_date) : new Date('2999-01-01')
      const dateB = b.next_billing_date ? new Date(b.next_billing_date) : new Date('2999-01-01')
      return dateA - dateB
    } else if (sortBy === 'price') {
      return b.amount - a.amount
    } else if (sortBy === 'name') {
      return a.name.localeCompare(b.name)
    }
    return 0
  })

  const getFilterCounts = () => ({
    all: subscriptions.length,
    active: subscriptions.filter(s => s.status === 'active').length,
    pending: subscriptions.filter(s => s.status === 'pending').length,
    paused: subscriptions.filter(s => s.status === 'paused').length,
    cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
  })
  const counts = getFilterCounts()

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-[#22C55E]/[0.07] text-[#22C55E]/70',
      pending: 'bg-[#FBBF24]/10 text-[#D97706]',
      paused: 'bg-[#F97316]/10 text-[#F97316]',
      cancelled: 'bg-[#F3F4F6] text-[#9CA3AF]',
    }
    const labels = {
      active: 'Active',
      pending: 'Upcoming',
      paused: 'Paused',
      cancelled: 'Cancelled',
    }
    return (
      <span className={`px-3 py-1 ${styles[status] || 'bg-[#F3F4F6] text-[#9CA3AF]'} text-xs font-semibold rounded-full`}>
        {labels[status] || status}
      </span>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?'

  // Enhanced logo resolver: checks service library first, then falls back
  const resolveLogoUrl = (sub) => {
    if (sub.logo_url) return sub.logo_url
    const match = getServiceLogo(sub.name)
    return match?.logo || null
  }

  // ─── ADD SUBSCRIPTION HANDLER ───
  const openAdd = () => {
    setEditingSub(null)
    setModalOpen(true)
  }

  const handleSaveSubscription = async (formData) => {
    try {
      if (editingSub) {
        await updateSubscription(editingSub.id, formData)
      } else {
        await createSubscription({ ...formData, user_id: user.id })
      }
      await loadSubscriptions()
      setModalOpen(false)
      setEditingSub(null)
    } catch (err) {
      console.error('Save failed:', err)
      throw err
    }
  }

  // ─── SUBSCRIPTION MODAL COMPONENT ───
  const SubscriptionModal = ({ isOpen, onClose, onSave }) => {
    const [form, setForm] = useState({
      name: '',
      category: 'other',
      amount: '',
      currency: 'USD',
      billing_cycle: 'monthly',
      next_billing_date: '',
      status: 'active',
      notes: '',
    })
    const [saving, setSaving] = useState(false)

    useEffect(() => {
      if (editingSub) {
        setForm({
          name: editingSub.name || '',
          category: editingSub.category || 'other',
          amount: editingSub.amount?.toString() || '',
          currency: editingSub.currency || 'USD',
          billing_cycle: editingSub.billing_cycle || 'monthly',
          next_billing_date: editingSub.next_billing_date || '',
          status: editingSub.status || 'active',
          notes: editingSub.notes || '',
        })
      } else {
        setForm({
          name: '', category: 'other', amount: '', currency: 'USD',
          billing_cycle: 'monthly', next_billing_date: '', status: 'active', notes: '',
        })
      }
    }, [editingSub, isOpen])

    if (!isOpen) return null

    const handleSubmit = async (e) => {
      e.preventDefault()
      setSaving(true)
      try {
        await onSave({
          ...form,
          amount: parseFloat(form.amount) || 0,
          next_billing_date: form.next_billing_date || null,
        })
      } catch (err) {
        console.error('Save failed:', err)
      } finally {
        setSaving(false)
      }
    }

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
        <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-[#E5E7EB] dark:border-[#2A2D3A]">
            <h2 className="text-xl font-bold text-[#111827] dark:text-white">
              {editingSub ? 'Edit Subscription' : 'Add Subscription'}
            </h2>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-[#252836] transition-colors">
              <X size={20} className="text-[#6B7280] dark:text-gray-400" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Name */}
            <div>
              <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Name</label>
              <input
                type="text"
                required
                placeholder="e.g. Netflix, Spotify, Claude..."
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
              />
            </div>

            {/* Category + Billing Cycle */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Category</label>
                <select
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316] bg-white"
                >
                  {Object.entries(CATEGORIES).map(([key, { label }]) => (
                    <option key={key} value={key}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Billing Cycle</label>
                <select
                  value={form.billing_cycle}
                  onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316] bg-white"
                >
                  <option value="weekly">Weekly</option>
                  <option value="monthly">Monthly</option>
                  <option value="quarterly">Quarterly</option>
                  <option value="yearly">Yearly</option>
                </select>
              </div>
            </div>

            {/* Amount + Currency */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Amount</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  placeholder="9.99"
                  value={form.amount}
                  onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316]"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Currency</label>
                <select
                  value={form.currency}
                  onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                  className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316] bg-white"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CNY">CNY (¥)</option>
                  <option value="JPY">JPY (¥)</option>
                </select>
              </div>
            </div>

            {/* Next Billing Date */}
            <div>
              <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Next Billing Date</label>
              <input
                type="date"
                value={form.next_billing_date}
                onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))}
                className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Status</label>
              <div className="flex gap-2">
                {['active', 'paused', 'cancelled'].map(s => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, status: s }))}
                    className={`px-4 py-2 rounded-full text-sm font-medium transition-colors capitalize ${
                      form.status === s
                        ? 'bg-[#F97316] text-white'
                        : 'bg-[#F9FAFB] dark:bg-[#252836] text-[#6B7280] dark:text-gray-400 hover:bg-[#F3F4F6] dark:hover:bg-[#2A2D3A]'
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm font-medium text-[#6B7280] dark:text-gray-400 mb-1.5">Notes (optional)</label>
              <textarea
                rows={2}
                placeholder="Any notes about this subscription..."
                value={form.notes}
                onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                className="w-full px-4 py-2.5 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-white rounded-xl focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
              />
            </div>

            {/* Buttons */}
            <div className="flex gap-3 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 border-2 border-[#E5E7EB] dark:border-[#2A2D3A] text-[#6B7280] dark:text-gray-400 rounded-full font-medium hover:bg-[#F9FAFB] dark:hover:bg-[#252836] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="flex-1 px-4 py-2.5 bg-[#F97316] text-white rounded-full font-medium hover:bg-[#EA580C] transition-colors disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingSub ? 'Save Changes' : 'Add Subscription'}
              </button>
            </div>
          </form>
        </div>
      </div>
    )
  }

  // ─── EMPTY STATE ───
  if (!loadingData && subscriptions.length === 0) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950">
        <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#1C1F2E]/80 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A2D3A]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
            <h1 className="text-2xl font-bold text-[#111827] dark:text-white">Dashboard</h1>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-0.5">Your subscription overview at a glance.</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-[#FFF5F0] dark:bg-[#252836] flex items-center justify-center">
            <Scissors size={36} className="text-[#F97316]" />
          </div>
          <h2 className="text-2xl font-bold text-[#111827] dark:text-white mb-3">No subscriptions yet</h2>
          <p className="text-[#6B7280] dark:text-gray-400 mb-8 max-w-md mx-auto text-sm">
            Start by scanning your inbox to automatically find subscriptions, or add one manually.
          </p>
          <div className="flex flex-col items-center gap-4">
            {!showScanOptions ? (
              <div className="flex gap-3 items-center">
                <button
                  onClick={() => setShowScanOptions(true)}
                  disabled={scanning}
                  className="px-7 py-3 bg-[#F97316] text-white rounded-full font-semibold hover:bg-[#EA580C] transition-all duration-200 flex items-center gap-2 disabled:opacity-50 shadow-[0_8px_28px_rgba(249,115,22,0.4)] hover:shadow-[0_12px_36px_rgba(249,115,22,0.5)]"
                >
                  {scanning ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                  {scanning ? 'Scanning...' : 'Scan Inbox'}
                </button>
                <button
                  onClick={openAdd}
                  className="px-7 py-3 border-2 border-[#F97316] text-[#F97316] rounded-full font-semibold hover:bg-[#FFF5F0] transition-colors flex items-center gap-2"
                >
                  <Plus size={18} />
                  Add Subscription
                </button>
              </div>
            ) : (
              <div className="bg-[#F9FAFB] dark:bg-[#252836] rounded-2xl p-6 w-full max-w-sm border border-[#E5E7EB] dark:border-[#2A2D3A]">
                <p className="text-sm font-semibold text-[#111827] dark:text-white mb-3 text-left">How far back should we scan?</p>
                <div className="grid grid-cols-2 gap-2 mb-4">
                  {[
                    { value: 6, label: '6 months' },
                    { value: 12, label: '1 year' },
                    { value: 24, label: '2 years' },
                    { value: 36, label: '3 years' },
                  ].map(opt => (
                    <button
                      key={opt.value}
                      onClick={() => setScanMonths(opt.value)}
                      className={`px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        scanMonths === opt.value
                          ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827]'
                          : 'bg-white dark:bg-[#1C1F2E] text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-300 border border-[#E5E7EB] dark:border-[#2A2D3A]'
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setShowScanOptions(false); handleScanInbox() }}
                    className="flex-1 py-2.5 bg-[#F97316] text-white rounded-full font-semibold text-sm hover:bg-[#EA580C] transition-colors shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
                  >
                    Start Scan
                  </button>
                  <button
                    onClick={() => setShowScanOptions(false)}
                    className="px-4 py-2.5 text-[#6B7280] text-sm font-medium hover:text-[#111827] transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
            {scanning && (
              <div className="text-sm text-[#6B7280] dark:text-gray-400 text-center">
                <p className="font-semibold text-[#111827] dark:text-white">Phase {scanProgress.phase}/4</p>
                <p>{scanProgress.message}</p>
              </div>
            )}
            {scanResult?.error && (
              <p className="text-sm text-[#EF4444] dark:text-red-400 max-w-md">{scanResult.error}</p>
            )}
            {scanResult && !scanResult.error && (
              <p className="text-sm text-[#22C55E] dark:text-green-400 flex items-center gap-1 font-medium">
                <CheckCircle size={16} />
                Added {scanResult.addedCount} new{scanResult.updatedCount > 0 ? `, updated ${scanResult.updatedCount} existing` : ''}.
                {scanResult.reviewCount > 0 && ` ${scanResult.reviewCount} need your review.`}
              </p>
            )}
          </div>

          {/* Review Items — also shown in empty state */}
          {renderReviewSection('max-w-2xl')}
        </main>

        {/* Add/Edit Subscription Modal */}
        <SubscriptionModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveSubscription} />
      </div>
    )
  }

  // ─── LOADING STATE ───
  if (loadingData) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-[#6B7280] dark:text-gray-400">
          <Loader2 size={20} className="animate-spin text-[#F97316]" />
          <span className="text-sm font-medium">Loading your subscriptions...</span>
        </div>
      </div>
    )
  }

  // ─── MAIN DASHBOARD ───
  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/90 dark:bg-[#1C1F2E]/80 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A2D3A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold text-[#111827] dark:text-white">Dashboard</h1>
            <p className="text-[#6B7280] dark:text-gray-400 text-sm mt-0.5">
              Your subscription overview at a glance.
            </p>
          </div>
          <div className="flex gap-2 items-center">
            <button
              onClick={openAdd}
              className="px-4 py-2 border-2 border-[#E5E7EB] dark:border-[#2A2D3A] rounded-full text-[#6B7280] dark:text-gray-400 hover:bg-[#F9FAFB] dark:hover:bg-[#252836] transition-colors flex items-center gap-2 text-sm font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Subscription
            </button>
            <div className="relative">
              <button
                onClick={() => setShowScanOptions(!showScanOptions)}
                disabled={scanning}
                className="px-5 py-2 bg-[#F97316] text-white rounded-full hover:bg-[#EA580C] transition-all duration-200 flex items-center gap-2 text-sm font-semibold disabled:opacity-50 shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
              >
                {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                {scanning ? 'Scanning...' : 'Scan Inbox'}
              </button>
              {/* Scan Options Popup */}
              {showScanOptions && !scanning && (
                <div className="absolute right-0 top-full mt-2 w-64 bg-white dark:bg-[#252836] rounded-2xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25)] border border-[#E5E7EB] dark:border-[#2A2D3A] p-5 z-50">
                  <p className="text-sm font-semibold text-[#111827] dark:text-white mb-3">How far back should we scan?</p>
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {[
                      { value: 6, label: '6 months' },
                      { value: 12, label: '1 year' },
                      { value: 24, label: '2 years' },
                      { value: 36, label: '3 years' },
                    ].map(opt => (
                      <button
                        key={opt.value}
                        onClick={() => setScanMonths(opt.value)}
                        className={`px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                          scanMonths === opt.value
                            ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827]'
                            : 'bg-[#F9FAFB] dark:bg-[#1C1F2E] text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-300'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                  <button
                    onClick={() => { setShowScanOptions(false); handleScanInbox() }}
                    className="w-full py-2.5 bg-[#F97316] text-white rounded-full font-semibold text-sm hover:bg-[#EA580C] transition-colors shadow-[0_4px_16px_rgba(249,115,22,0.3)]"
                  >
                    Start Scan
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Scanning Progress Banner */}
      {scanning && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-2xl p-5 bg-[#FFF5F0] dark:bg-[#252836] border border-[#F97316]/20 dark:border-[#F97316]/30">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-[#F97316]" />
              <div>
                <p className="text-sm font-semibold text-[#111827] dark:text-white">Phase {scanProgress.phase}/4</p>
                <p className="text-sm text-[#6B7280] dark:text-gray-400">{scanProgress.message}</p>
              </div>
            </div>
            {scanProgress.total > 0 && (
              <div className="mt-3 bg-[#F97316]/10 dark:bg-[#F97316]/20 rounded-full h-2">
                <div
                  className="bg-[#F97316] rounded-full h-2 transition-all duration-300"
                  style={{ width: `${Math.min(100, (scanProgress.current / scanProgress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scan Result Banner */}
      {scanResult && !scanning && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className={`rounded-2xl p-4 flex items-center justify-between ${
            scanResult.error ? 'bg-red-50 dark:bg-red-900/20 border border-[#EF4444]/20 dark:border-[#EF4444]/30' : 'bg-green-50 dark:bg-green-900/20 border border-[#22C55E]/20 dark:border-[#22C55E]/30'
          }`}>
            <p className={`text-sm font-medium flex items-center gap-2 ${
              scanResult.error ? 'text-[#EF4444] dark:text-red-400' : 'text-[#22C55E] dark:text-green-400'
            }`}>
              {scanResult.error ? (
                scanResult.error
              ) : (
                <>
                  <CheckCircle size={16} />
                  Scan complete! Added {scanResult.addedCount} new{scanResult.updatedCount > 0 ? `, updated ${scanResult.updatedCount} existing` : ''}.
                  {scanResult.reviewCount > 0 && ` ${scanResult.reviewCount} item${scanResult.reviewCount !== 1 ? 's' : ''} need your review below.`}
                </>
              )}
            </p>
            <button onClick={() => setScanResult(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Dismiss</button>
          </div>
        </div>
      )}

      {/* Review Items Section */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        {renderReviewSection('max-w-7xl')}
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Cost View Toggle */}
        <div className="flex items-center gap-3 mb-6">
          <span className="text-sm text-[#9CA3AF] dark:text-gray-500">View as:</span>
          <div className="inline-flex rounded-full border border-[#E5E7EB] dark:border-[#2A2D3A] overflow-hidden p-0.5 bg-[#F9FAFB] dark:bg-[#252836]">
            <button
              onClick={() => setCostView('monthly')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 ${
                costView === 'monthly'
                  ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-sm'
                  : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-300'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setCostView('yearly')}
              className={`px-4 py-1.5 text-sm font-semibold rounded-full transition-all duration-200 ${
                costView === 'yearly'
                  ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-sm'
                  : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-300'
              }`}
            >
              Yearly
            </button>
          </div>
        </div>

        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#F3F4F6] dark:border-[#2A2D3A] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[#6B7280] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  Total {costView === 'monthly' ? 'Monthly' : 'Yearly'} Cost
                </p>
                <p className="text-3xl font-bold text-[#111827] dark:text-white mt-2">{dominantSymbol}{displayTotal.toFixed(2)}</p>
                {hasMultipleCurrencies && (
                  <button
                    onClick={() => setShowCurrencyInfo(!showCurrencyInfo)}
                    className="text-xs text-[#F97316] dark:text-orange-400 mt-1 flex items-center gap-1 hover:underline"
                  >
                    <Info className="w-3 h-3" /> Converted rates
                    {showCurrencyInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                  </button>
                )}
              </div>
              <div className="w-11 h-11 rounded-2xl bg-[#FFF5F0] dark:bg-[#252836] flex items-center justify-center">
                <DollarSign className="w-5 h-5 text-[#F97316]" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#F3F4F6] dark:border-[#2A2D3A] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[#6B7280] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Active Subscriptions</p>
                <p className="text-3xl font-bold text-[#111827] dark:text-white mt-2">{activeCount}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-[#FFF5F0] dark:bg-[#252836] flex items-center justify-center">
                <Package className="w-5 h-5 text-[#F97316]" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#F3F4F6] dark:border-[#2A2D3A] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[#6B7280] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">Renewing Soon</p>
                <p className="text-3xl font-bold text-[#F97316] mt-2">{upcoming.length}</p>
              </div>
              <div className="w-11 h-11 rounded-2xl bg-[#FFF5F0] dark:bg-[#252836] flex items-center justify-center">
                <Clock className="w-5 h-5 text-[#F97316]" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#F3F4F6] dark:border-[#2A2D3A] shadow-[0_1px_4px_rgba(0,0,0,0.04)] p-6 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-[#6B7280] dark:text-gray-400 text-xs font-semibold uppercase tracking-wider">
                  Saved ({costView === 'monthly' ? '/mo' : '/yr'})
                </p>
                <p className="text-3xl font-bold text-[#22C55E] dark:text-green-400 mt-2">{dominantSymbol}{cancelledSavings.toFixed(2)}</p>
                {cancelledSavings > 0 && (
                  <p className="text-xs text-[#9CA3AF] dark:text-gray-500 mt-1">From cancelled subscriptions</p>
                )}
              </div>
              <div className="w-11 h-11 rounded-2xl bg-green-50 dark:bg-[#252836] flex items-center justify-center">
                <TrendingDown className="w-5 h-5 text-[#22C55E] dark:text-green-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Currency Conversion Info (collapsible) */}
        {showCurrencyInfo && hasMultipleCurrencies && (
          <div className="bg-[#FFF5F0] dark:bg-[#252836] rounded-2xl p-4 mb-6 border border-[#F97316]/10 dark:border-[#F97316]/20">
            <p className="text-xs font-semibold text-[#111827] dark:text-white mb-2">Currency Conversion</p>
            <p className="text-xs text-[#6B7280] dark:text-gray-400 mb-2">
              All amounts shown in {dominantCurrency} ({dominantSymbol.trim()}). Approximate exchange rates used:
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {[...new Set(subscriptions.filter(s => s.amount > 0 && (s.currency || 'USD') !== dominantCurrency).map(s => s.currency || 'USD'))].map(c => {
                const rate = (RATES_TO_USD[c] || 1) / (RATES_TO_USD[dominantCurrency] || 1)
                return (
                  <span key={c} className="text-xs text-[#6B7280] dark:text-gray-400">
                    1 {c} ≈ {rate.toFixed(2)} {dominantCurrency}
                  </span>
                )
              })}
            </div>
          </div>
        )}

        {/* Filter Bar */}
        <div className="bg-[#F9FAFB] dark:bg-[#252836] rounded-2xl p-4 mb-6 flex justify-between items-center flex-wrap gap-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'active', label: 'Active', count: counts.active },
              ...(counts.pending > 0 ? [{ key: 'pending', label: 'Upcoming', count: counts.pending }] : []),
              { key: 'paused', label: 'Paused', count: counts.paused },
              { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`px-4 py-2 rounded-full font-semibold text-sm transition-all duration-200 ${
                  activeFilter === filter.key
                    ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827] shadow-sm'
                    : 'bg-white dark:bg-[#1C1F2E] text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-gray-300 border border-[#E5E7EB] dark:border-[#2A2D3A]'
                }`}
              >
                {filter.label} ({filter.count})
              </button>
            ))}
          </div>

          <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-2 bg-white dark:bg-[#1C1F2E] rounded-full border border-[#E5E7EB] dark:border-[#2A2D3A] text-sm font-medium text-[#111827] dark:text-white cursor-pointer appearance-none pr-8 hover:border-[#F97316] dark:hover:border-[#F97316] transition-colors"
            >
              <option value="renewal">Sort: Renewal Date</option>
              <option value="price">Sort: Price (High to Low)</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-[#9CA3AF] dark:text-gray-500 pointer-events-none" />
          </div>
        </div>

        {/* Subscription List */}
        <div className="space-y-3">
          {sorted.length > 0 ? (
            sorted.map(sub => {
              const catInfo = CATEGORIES[sub.category] || CATEGORIES['other']
              const monthlyInDom = getMonthlyInDominant(sub)
              const yearlyInDom = getYearlyInDominant(sub)
              const isConverted = (sub.currency || 'USD') !== dominantCurrency

              return (
                <div
                  key={sub.id}
                  onMouseEnter={() => setHoveredId(sub.id)}
                  onMouseLeave={() => setHoveredId(null)}
                  className={`bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#F3F4F6] dark:border-[#2A2D3A] p-5 flex justify-between items-center transition-all duration-200 hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)] hover:-translate-y-0.5 ${
                    sub.status === 'cancelled' ? 'opacity-55' : ''
                  }`}
                >
                  <div className="flex items-center gap-4 flex-1">
                    {(() => {
                      const logoUrl = resolveLogoUrl(sub)
                      const color = getColorForName(sub.name)
                      return logoUrl ? (
                        <img
                          src={logoUrl}
                          alt={sub.name}
                          className="w-11 h-11 rounded-2xl object-cover bg-gray-50 dark:bg-[#252836]"
                          onError={(e) => {
                            e.target.style.display = 'none'
                            e.target.nextSibling.style.display = 'flex'
                          }}
                        />
                      ) : null
                    })()}
                    <div
                      className="w-11 h-11 rounded-2xl flex items-center justify-center font-bold text-lg flex-shrink-0"
                      style={{
                        display: resolveLogoUrl(sub) ? 'none' : 'flex',
                        backgroundColor: getColorForName(sub.name) + '18',
                        color: getColorForName(sub.name),
                      }}
                    >
                      {getServiceInitials(sub.name)}
                    </div>
                    <div>
                      <p className={`font-semibold text-[#111827] dark:text-white ${sub.status === 'cancelled' ? 'line-through text-[#9CA3AF] dark:text-gray-500' : ''}`}>
                        {sub.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className={`text-xs px-2 py-0.5 rounded-full ${catInfo.color} ${catInfo.textColor}`}>
                          {catInfo.label}
                        </span>
                        <span className="text-xs text-[#9CA3AF] dark:text-gray-500 capitalize">{sub.billing_cycle || 'unknown'}</span>
                      </div>
                      {sub.last_email_date && (
                        <p className="text-xs text-[#9CA3AF] dark:text-gray-500 mt-0.5">
                          Last billed: {new Date(sub.last_email_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-6">
                    {sub.status !== 'cancelled' && (
                      <div className="text-right">
                        <p className="text-xs text-[#9CA3AF] dark:text-gray-500 font-medium">Renews</p>
                        <p className="font-semibold text-[#111827] dark:text-white text-sm">{formatDate(sub.next_billing_date)}</p>
                      </div>
                    )}
                    {sub.status === 'cancelled' && (
                      <div className="text-right">
                        <p className="text-xs text-[#9CA3AF] dark:text-gray-500">Cancelled</p>
                      </div>
                    )}

                    <div className="text-right min-w-28">
                      {Number(sub.amount) > 0 ? (
                        <>
                          <p className="font-semibold text-[#111827] dark:text-white text-sm">
                            {dominantSymbol}{monthlyInDom.toFixed(2)}
                            <span className="text-xs text-[#9CA3AF] dark:text-gray-500 font-normal">/mo</span>
                          </p>
                          <p className="text-xs text-[#9CA3AF] dark:text-gray-500">
                            {dominantSymbol}{yearlyInDom.toFixed(2)}/yr
                            {isConverted && ' *'}
                          </p>
                        </>
                      ) : (
                        <p className="font-semibold text-[#D1D5DB] dark:text-gray-600">—</p>
                      )}
                    </div>

                    <div className="min-w-32 flex items-center gap-2">
                      {getStatusBadge(sub.status)}
                      {hoveredId === sub.id && sub.status === 'active' && (
                        <button
                          onClick={() => setCancelConfirm(sub)}
                          className="text-xs text-[#EF4444]/70 dark:text-red-400/70 hover:text-[#EF4444] dark:hover:text-red-400 transition-colors whitespace-nowrap font-medium"
                        >
                          Cancel
                        </button>
                      )}
                      {hoveredId === sub.id && sub.status === 'cancelled' && (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleReactivateSub(sub)}
                            className="text-xs text-[#22C55E] dark:text-green-400 hover:text-green-700 dark:hover:text-green-300 transition-colors font-medium"
                          >
                            Reactivate
                          </button>
                          <button
                            onClick={() => setDeleteConfirm(sub)}
                            className="text-xs text-[#EF4444]/70 dark:text-red-400/70 hover:text-[#EF4444] dark:hover:text-red-400 transition-colors font-medium"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )
            })
          ) : (
            <div className="bg-[#F9FAFB] dark:bg-[#252836] rounded-2xl p-12 text-center">
              <p className="text-[#6B7280] dark:text-gray-400 font-medium">No subscriptions match this filter.</p>
            </div>
          )}
        </div>
      </main>

      {/* Cancel Confirmation Modal */}
      {cancelConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1F2E] rounded-3xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25)] w-full max-w-sm mx-4 p-7">
            <h3 className="text-lg font-bold text-[#111827] dark:text-white mb-2">Cancel Subscription?</h3>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mb-5">
              Mark <strong className="text-[#111827] dark:text-white">{cancelConfirm.name}</strong> as cancelled? You can reactivate it later.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setCancelConfirm(null)}
                className="px-5 py-2.5 text-sm font-semibold text-[#6B7280] dark:text-gray-400 bg-[#F9FAFB] dark:bg-[#252836] rounded-full hover:bg-[#F3F4F6] dark:hover:bg-[#2A2D3A] transition-colors"
              >
                Keep Active
              </button>
              <button
                onClick={() => handleCancelSub(cancelConfirm)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#EF4444] rounded-full hover:bg-red-600 transition-colors"
              >
                Yes, Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white dark:bg-[#1C1F2E] rounded-3xl shadow-[0_16px_48px_-12px_rgba(0,0,0,0.25)] w-full max-w-sm mx-4 p-7">
            <h3 className="text-lg font-bold text-[#111827] dark:text-white mb-2">Delete Permanently?</h3>
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mb-5">
              Permanently delete <strong className="text-[#111827] dark:text-white">{deleteConfirm.name}</strong>? This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setDeleteConfirm(null)}
                className="px-5 py-2.5 text-sm font-semibold text-[#6B7280] dark:text-gray-400 bg-[#F9FAFB] dark:bg-[#252836] rounded-full hover:bg-[#F3F4F6] dark:hover:bg-[#2A2D3A] transition-colors"
              >
                Keep
              </button>
              <button
                onClick={() => handleDeleteSub(deleteConfirm)}
                className="px-5 py-2.5 text-sm font-semibold text-white bg-[#EF4444] rounded-full hover:bg-red-600 transition-colors"
              >
                Delete Forever
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add/Edit Subscription Modal */}
      <SubscriptionModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveSubscription} />
    </div>
  )
}

export default Dashboard
