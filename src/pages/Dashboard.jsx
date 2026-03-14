import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  DollarSign,
  Package,
  Clock,
  TrendingDown,
  Download,
  Mail,
  Filter,
  ChevronDown,
  Plus,
  Inbox,
  Loader2,
  CheckCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { getSubscriptions, createSubscription, calcMonthlyTotal, getUpcomingRenewals } from '../lib/subscriptions'
import { scanGmailForSubscriptions } from '../lib/gmail'

const Dashboard = () => {
  const { user, getGoogleToken } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [sortBy, setSortBy] = useState('renewal')
  const [hoveredId, setHoveredId] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ phase: 0, message: '', current: 0, total: 0 })
  const [scanResult, setScanResult] = useState(null) // { confirmed, needsReview, addedCount } or { error }
  const [scanMonths, setScanMonths] = useState(6)
  const [reviewItems, setReviewItems] = useState([]) // items needing user confirmation

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
      // Save confirmed subscriptions (skip duplicates by name)
      const existingNames = new Set(subscriptions.map(s => s.name.toLowerCase()))
      let addedCount = 0
      for (const sub of confirmed) {
        if (!existingNames.has(sub.name.toLowerCase())) {
          try {
            const { _emailCount, _confidence, _domain, ...dbSub } = sub
            await createSubscription({ ...dbSub, amount: dbSub.amount || 0, user_id: user.id })
            addedCount++
          } catch (err) {
            console.warn('Failed to add:', sub.name, err)
          }
        }
      }
      await loadSubscriptions()
      // Set review items for user confirmation
      const reviewFiltered = needsReview.filter(s => !existingNames.has(s.name.toLowerCase()))
      setReviewItems(reviewFiltered)
      setScanResult({ addedCount, confirmedTotal: confirmed.length, reviewCount: reviewFiltered.length })
    } catch (err) {
      console.error('Scan failed:', err)
      setScanResult({ error: err.message })
    } finally {
      setScanning(false)
    }
  }

  const handleApproveReview = async (item) => {
    try {
      const { _emailCount, _confidence, _domain, ...dbSub } = item
      await createSubscription({ ...dbSub, amount: dbSub.amount || 0, user_id: user.id })
      setReviewItems(prev => prev.filter(r => r.name !== item.name))
      await loadSubscriptions()
    } catch (err) {
      console.warn('Failed to add:', item.name, err)
    }
  }

  const handleDismissReview = (item) => {
    setReviewItems(prev => prev.filter(r => r.name !== item.name))
  }

  // Calculate stats
  const activeCount = subscriptions.filter(s => s.status === 'active').length
  const monthlyTotal = calcMonthlyTotal(subscriptions)
  const upcoming = getUpcomingRenewals(subscriptions, 7)
  const cancelledSavings = subscriptions
    .filter(s => s.status === 'cancelled')
    .reduce((sum, s) => sum + s.amount, 0)

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
    paused: subscriptions.filter(s => s.status === 'paused').length,
    cancelled: subscriptions.filter(s => s.status === 'cancelled').length,
  })
  const counts = getFilterCounts()

  const getStatusBadge = (status) => {
    const styles = {
      active: 'bg-green-100 text-green-700',
      paused: 'bg-orange-100 text-orange-700',
      cancelled: 'bg-gray-100 text-gray-600',
    }
    return (
      <span className={`px-3 py-1 ${styles[status] || 'bg-gray-100 text-gray-600'} text-sm font-medium rounded-full capitalize`}>
        {status}
      </span>
    )
  }

  const formatDate = (dateStr) => {
    if (!dateStr) return '—'
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  const getInitial = (name) => name ? name.charAt(0).toUpperCase() : '?'

  // ─── EMPTY STATE ───
  if (!loadingData && subscriptions.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Your subscription overview at a glance.</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-orange-50 flex items-center justify-center">
            <Inbox size={36} className="text-[#F97316]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 mb-3">No subscriptions yet</h2>
          <p className="text-gray-500 mb-8 max-w-md mx-auto">
            Start by scanning your inbox to automatically find subscriptions, or add one manually.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3 items-center">
              <select
                value={scanMonths}
                onChange={(e) => setScanMonths(Number(e.target.value))}
                disabled={scanning}
                className="px-3 py-3 border border-gray-300 rounded-xl text-sm font-medium text-gray-700"
              >
                <option value={3}>3 months</option>
                <option value={6}>6 months</option>
                <option value={12}>12 months</option>
                <option value={24}>24 months</option>
              </select>
              <button
                onClick={handleScanInbox}
                disabled={scanning}
                className="px-6 py-3 bg-[#F97316] text-white rounded-xl font-semibold hover:bg-[#EA580C] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {scanning ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                {scanning ? 'Scanning...' : 'Scan Inbox'}
              </button>
              <Link
                to="/subscriptions?add=1"
                className="px-6 py-3 border border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Add Manually
              </Link>
            </div>
            {scanning && (
              <div className="text-sm text-gray-600 text-center">
                <p className="font-medium">Phase {scanProgress.phase}/4</p>
                <p>{scanProgress.message}</p>
              </div>
            )}
            {scanResult?.error && (
              <p className="text-sm text-red-500 max-w-md">{scanResult.error}</p>
            )}
            {scanResult && !scanResult.error && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={16} />
                Added {scanResult.addedCount} subscription{scanResult.addedCount !== 1 ? 's' : ''}.
                {scanResult.reviewCount > 0 && ` ${scanResult.reviewCount} need your review.`}
              </p>
            )}
          </div>
        </main>
      </div>
    )
  }

  // ─── LOADING STATE ───
  if (loadingData) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading your subscriptions...</div>
      </div>
    )
  }

  // ─── MAIN DASHBOARD ───
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">
              Your subscription overview at a glance.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <Link
              to="/subscriptions?add=1"
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Manually
            </Link>
            <select
              value={scanMonths}
              onChange={(e) => setScanMonths(Number(e.target.value))}
              disabled={scanning}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700"
            >
              <option value={3}>3 mo</option>
              <option value={6}>6 mo</option>
              <option value={12}>12 mo</option>
              <option value={24}>24 mo</option>
            </select>
            <button
              onClick={handleScanInbox}
              disabled={scanning}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {scanning ? 'Scanning...' : 'Scan Inbox'}
            </button>
          </div>
        </div>
      </header>

      {/* Scanning Progress Banner */}
      {scanning && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="rounded-xl p-4 bg-blue-50 border border-blue-200">
            <div className="flex items-center gap-3">
              <Loader2 size={18} className="animate-spin text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-700">Phase {scanProgress.phase}/4</p>
                <p className="text-sm text-blue-600">{scanProgress.message}</p>
              </div>
            </div>
            {scanProgress.total > 0 && (
              <div className="mt-2 bg-blue-100 rounded-full h-2">
                <div
                  className="bg-blue-500 rounded-full h-2 transition-all duration-300"
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
          <div className={`rounded-xl p-4 flex items-center justify-between ${
            scanResult.error ? 'bg-red-50 border border-red-200' : 'bg-green-50 border border-green-200'
          }`}>
            <p className={`text-sm font-medium flex items-center gap-2 ${
              scanResult.error ? 'text-red-700' : 'text-green-700'
            }`}>
              {scanResult.error ? (
                scanResult.error
              ) : (
                <>
                  <CheckCircle size={16} />
                  Scan complete! Added {scanResult.addedCount} confirmed subscription{scanResult.addedCount !== 1 ? 's' : ''}.
                  {scanResult.reviewCount > 0 && ` ${scanResult.reviewCount} item${scanResult.reviewCount !== 1 ? 's' : ''} need your review below.`}
                </>
              )}
            </p>
            <button onClick={() => setScanResult(null)} className="text-sm text-gray-500 hover:text-gray-700">Dismiss</button>
          </div>
        </div>
      )}

      {/* Review Items Section */}
      {reviewItems.length > 0 && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
          <div className="bg-orange-50 border border-orange-200 rounded-xl p-5">
            <h3 className="font-semibold text-orange-800 mb-3">Possible subscriptions — please confirm</h3>
            <div className="space-y-2">
              {reviewItems.map((item, idx) => (
                <div key={idx} className="bg-white rounded-lg p-3 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {item.logo_url ? (
                      <img src={item.logo_url} alt={item.name} className="w-8 h-8 rounded-full" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-sm">
                        {item.name?.charAt(0) || '?'}
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">
                        {item._emailCount} email{item._emailCount !== 1 ? 's' : ''} found · {item._domain}
                        {item.amount ? ` · $${item.amount.toFixed(2)}/${item.billing_cycle}` : ''}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleApproveReview(item)}
                      className="px-3 py-1 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200"
                    >
                      Add
                    </button>
                    <button
                      onClick={() => handleDismissReview(item)}
                      className="px-3 py-1 bg-gray-100 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-200"
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Total Monthly Cost</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">${monthlyTotal.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Active Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900 mt-2">{activeCount}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Renewing Soon</p>
                <p className="text-3xl font-bold text-orange-500 mt-2">{upcoming.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 text-sm font-medium">Saved This Month</p>
                <p className="text-3xl font-bold text-green-600 mt-2">${cancelledSavings.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6 flex justify-between items-center flex-wrap gap-4">
          <div className="flex gap-2 flex-wrap">
            {[
              { key: 'all', label: 'All', count: counts.all },
              { key: 'active', label: 'Active', count: counts.active },
              { key: 'paused', label: 'Paused', count: counts.paused },
              { key: 'cancelled', label: 'Cancelled', count: counts.cancelled },
            ].map(filter => (
              <button
                key={filter.key}
                onClick={() => setActiveFilter(filter.key)}
                className={`px-4 py-2 rounded-full font-medium text-sm transition-colors ${
                  activeFilter === filter.key
                    ? 'bg-orange-500 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
              className="px-4 py-2 bg-gray-100 rounded-lg border border-gray-300 text-sm font-medium text-gray-700 cursor-pointer appearance-none pr-8 hover:bg-gray-200 transition-colors"
            >
              <option value="renewal">Sort: Renewal Date</option>
              <option value="price">Sort: Price (High to Low)</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 pointer-events-none" />
          </div>
        </div>

        {/* Subscription List */}
        <div className="space-y-3">
          {sorted.length > 0 ? (
            sorted.map(sub => (
              <div
                key={sub.id}
                onMouseEnter={() => setHoveredId(sub.id)}
                onMouseLeave={() => setHoveredId(null)}
                className={`bg-white rounded-xl border border-gray-200 p-5 flex justify-between items-center transition-all ${
                  sub.status === 'cancelled' ? 'opacity-50' : ''
                }`}
              >
                <div className="flex items-center gap-4 flex-1">
                  {sub.logo_url ? (
                    <img src={sub.logo_url} alt={sub.name} className="w-12 h-12 rounded-full object-cover" />
                  ) : (
                    <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
                      {getInitial(sub.name)}
                    </div>
                  )}
                  <div>
                    <p className={`font-semibold text-gray-900 ${sub.status === 'cancelled' ? 'line-through text-gray-500' : ''}`}>
                      {sub.name}
                    </p>
                    <p className="text-sm text-gray-600 capitalize">{sub.category || 'Uncategorized'} · {sub.billing_cycle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {sub.status !== 'cancelled' && sub.next_billing_date && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Next renewal</p>
                      <p className="font-semibold text-gray-900">{formatDate(sub.next_billing_date)}</p>
                    </div>
                  )}
                  {sub.status === 'cancelled' && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Cancelled</p>
                      <p className="font-semibold text-gray-500">—</p>
                    </div>
                  )}

                  <div className="text-right min-w-20">
                    <p className="text-sm text-gray-600">Price</p>
                    <p className="font-semibold text-gray-900">
                      {Number(sub.amount) > 0 ? `$${Number(sub.amount).toFixed(2)}` : '—'}
                    </p>
                  </div>

                  <div className="min-w-32">{getStatusBadge(sub.status)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
              <p className="text-gray-600 font-medium">No subscriptions match this filter.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard
