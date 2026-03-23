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
import { getSubscriptions, createSubscription, updateSubscription, calcMonthlyTotal, getUpcomingRenewals } from '../lib/subscriptions'
import { scanGmailForSubscriptions } from '../lib/gmail'
import { notifyPriceChange } from '../lib/notifications'

const Dashboard = () => {
  const { user, getGoogleToken } = useAuth()
  const [subscriptions, setSubscriptions] = useState([])
  const [loadingData, setLoadingData] = useState(true)
  const [activeFilter, setActiveFilter] = useState('all')
  const [sortBy, setSortBy] = useState('renewal')
  const [hoveredId, setHoveredId] = useState(null)
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState({ current: 0, total: 0 })
  const [scanResult, setScanResult] = useState(null) // { found: number } or { error: string }

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
    setScanProgress({ current: 0, total: 0 })
    try {
      const token = await getGoogleToken()
      if (!token) {
        setScanResult({ error: 'Gmail access not available. Please sign out and sign in again to grant Gmail permission.' })
        setScanning(false)
        return
      }
      const found = await scanGmailForSubscriptions(token, (current, total) => {
        setScanProgress({ current, total })
      })
      // Build lookup map for existing subscriptions by name
      const existingMap = new Map(
        subscriptions.map(s => [s.name.toLowerCase(), s])
      )
      let addedCount = 0
      let priceChanges = 0

      for (const sub of found) {
        const existing = existingMap.get(sub.name.toLowerCase())
        if (!existing) {
          // New subscription — add it
          try {
            await createSubscription({ ...sub, user_id: user.id })
            addedCount++
          } catch (err) {
            console.warn('Failed to add:', sub.name, err)
          }
        } else if (
          sub.amount > 0 &&
          existing.amount > 0 &&
          Math.abs(Number(sub.amount) - Number(existing.amount)) > 0.01
        ) {
          // Price changed — update and notify
          const oldAmount = Number(existing.amount)
          const newAmount = Number(sub.amount)
          try {
            await updateSubscription(existing.id, { amount: newAmount, last_amount: oldAmount })
            await notifyPriceChange({
              subscriptionId: existing.id,
              subscriptionName: existing.name,
              oldAmount,
              newAmount,
            })
            priceChanges++
          } catch (err) {
            console.warn('Failed to update price for:', sub.name, err)
          }
        }
      }
      await loadSubscriptions()
      setScanResult({ found: addedCount, total: found.length, priceChanges })
    } catch (err) {
      console.error('Scan failed:', err)
      setScanResult({ error: err.message })
    } finally {
      setScanning(false)
    }
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
      active: 'bg-green-100 text-green-700 dark:bg-green-500/20 dark:text-green-400',
      paused: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400',
      cancelled: 'bg-gray-100 text-gray-600 dark:bg-gray-500/20 dark:text-gray-400',
    }
    return (
      <span className={`px-3 py-1 ${styles[status] || 'bg-gray-100 dark:bg-gray-500/20 text-gray-600 dark:text-gray-400'} text-sm font-medium rounded-full capitalize`}>
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200 dark:bg-[#1C1F2E]/80 dark:border-[#2A2D3A]">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">Your subscription overview at a glance.</p>
          </div>
        </header>

        <main className="max-w-2xl mx-auto px-4 py-20 text-center">
          <div className="w-20 h-20 mx-auto mb-6 rounded-2xl bg-orange-50 dark:bg-[#F97316]/10 flex items-center justify-center">
            <Inbox size={36} className="text-[#F97316]" />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3">No subscriptions yet</h2>
          <p className="text-gray-500 dark:text-gray-500 mb-8 max-w-md mx-auto">
            Start by scanning your inbox to automatically find subscriptions, or add one manually.
          </p>
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-3">
              <button
                onClick={handleScanInbox}
                disabled={scanning}
                className="px-6 py-3 bg-[#F97316] text-white rounded-xl font-semibold hover:bg-[#EA580C] transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {scanning ? <Loader2 size={18} className="animate-spin" /> : <Mail size={18} />}
                {scanning ? `Scanning... (${scanProgress.current}/${scanProgress.total})` : 'Scan Inbox'}
              </button>
              <Link
                to="/subscriptions?add=1"
                className="px-6 py-3 border border-gray-300 text-gray-700 dark:border-[#2A2D3A] dark:text-gray-300 rounded-xl font-semibold hover:bg-gray-50 dark:hover:bg-[#252836] transition-colors flex items-center gap-2"
              >
                <Plus size={18} />
                Add Manually
              </Link>
            </div>
            {scanResult?.error && (
              <p className="text-sm text-red-500 max-w-md">{scanResult.error}</p>
            )}
            {scanResult && !scanResult.error && (
              <p className="text-sm text-green-600 flex items-center gap-1">
                <CheckCircle size={16} />
                Found {scanResult.total} subscription{scanResult.total !== 1 ? 's' : ''}, added {scanResult.found} new.
                {scanResult.priceChanges > 0 && ` ${scanResult.priceChanges} price change${scanResult.priceChanges !== 1 ? 's' : ''} detected.`}
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
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-gray-400 dark:text-gray-500">Loading your subscriptions...</div>
      </div>
    )
  }

  // ─── MAIN DASHBOARD ───
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200 dark:bg-[#1C1F2E]/80 dark:border-[#2A2D3A]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Your subscription overview at a glance.
            </p>
          </div>
          <div className="flex gap-3">
            <button className="px-4 py-2 border border-gray-300 dark:border-[#2A2D3A] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252836] transition-colors flex items-center gap-2 font-medium">
              <Download className="w-4 h-4" />
              Export CSV
            </button>
            <Link
              to="/subscriptions?add=1"
              className="px-4 py-2 border border-gray-300 dark:border-[#2A2D3A] rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-[#252836] transition-colors flex items-center gap-2 font-medium"
            >
              <Plus className="w-4 h-4" />
              Add Manually
            </Link>
            <button
              onClick={handleScanInbox}
              disabled={scanning}
              className="px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2 font-medium disabled:opacity-50"
            >
              {scanning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
              {scanning ? `Scanning... (${scanProgress.current}/${scanProgress.total})` : 'Scan Inbox'}
            </button>
          </div>
        </div>
      </header>

      {/* Scan Result Banner */}
      {scanResult && (
        <div className={`max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4`}>
          <div className={`rounded-xl p-4 flex items-center justify-between ${
            scanResult.error ? 'bg-red-50 border border-red-200 dark:bg-red-500/10 dark:border-red-500/30' : 'bg-green-50 border border-green-200 dark:bg-green-500/10 dark:border-green-500/30'
          }`}>
            <p className={`text-sm font-medium flex items-center gap-2 ${
              scanResult.error ? 'text-red-700 dark:text-red-400' : 'text-green-700 dark:text-green-400'
            }`}>
              {scanResult.error ? (
                scanResult.error
              ) : (
                <>
                  <CheckCircle size={16} />
                  Scan complete! Found {scanResult.total} subscription{scanResult.total !== 1 ? 's' : ''} in your inbox, added {scanResult.found} new.
                  {scanResult.priceChanges > 0 && ` Detected ${scanResult.priceChanges} price change${scanResult.priceChanges !== 1 ? 's' : ''} — email sent.`}
                </>
              )}
            </p>
            <button onClick={() => setScanResult(null)} className="text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300">Dismiss</button>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-gray-200 dark:border-[#2A2D3A] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Total Monthly Cost</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">${monthlyTotal.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-blue-100 flex items-center justify-center">
                <DollarSign className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-gray-200 dark:border-[#2A2D3A] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Active Subscriptions</p>
                <p className="text-3xl font-bold text-gray-900 dark:text-white mt-2">{activeCount}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-gray-200 dark:border-[#2A2D3A] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Renewing Soon</p>
                <p className="text-3xl font-bold text-orange-500 mt-2">{upcoming.length}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-orange-100 flex items-center justify-center">
                <Clock className="w-6 h-6 text-orange-500" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-gray-200 dark:border-[#2A2D3A] shadow-sm p-6">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-gray-600 dark:text-gray-400 text-sm font-medium">Saved This Month</p>
                <p className="text-3xl font-bold text-green-600 mt-2">${cancelledSavings.toFixed(2)}</p>
              </div>
              <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center">
                <TrendingDown className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white dark:bg-[#1C1F2E] rounded-xl border border-gray-200 dark:border-[#2A2D3A] p-4 mb-6 flex justify-between items-center flex-wrap gap-4">
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
                    : 'bg-gray-100 dark:bg-[#252836] text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#2A2D3A]'
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
              className="px-4 py-2 bg-gray-100 dark:bg-[#252836] rounded-lg border border-gray-300 dark:border-[#2A2D3A] text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer appearance-none pr-8 hover:bg-gray-200 dark:hover:bg-[#2A2D3A] transition-colors"
            >
              <option value="renewal">Sort: Renewal Date</option>
              <option value="price">Sort: Price (High to Low)</option>
              <option value="name">Sort: Name (A-Z)</option>
            </select>
            <ChevronDown className="w-4 h-4 absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-600 dark:text-gray-400 pointer-events-none" />
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
                className={`bg-white dark:bg-[#1C1F2E] rounded-xl border border-gray-200 dark:border-[#2A2D3A] p-5 flex justify-between items-center transition-all ${
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
                    <p className={`font-semibold text-gray-900 dark:text-white ${sub.status === 'cancelled' ? 'line-through text-gray-500 dark:text-gray-500' : ''}`}>
                      {sub.name}
                    </p>
                    <p className="text-sm text-gray-600 dark:text-gray-400 capitalize">{sub.category || 'Uncategorized'} · {sub.billing_cycle}</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {sub.status !== 'cancelled' && sub.next_billing_date && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Next renewal</p>
                      <p className="font-semibold text-gray-900 dark:text-white">{formatDate(sub.next_billing_date)}</p>
                    </div>
                  )}
                  {sub.status === 'cancelled' && (
                    <div className="text-right">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Cancelled</p>
                      <p className="font-semibold text-gray-500 dark:text-gray-500">—</p>
                    </div>
                  )}

                  <div className="text-right min-w-20">
                    <p className="text-sm text-gray-600 dark:text-gray-400">Price</p>
                    <p className="font-semibold text-gray-900 dark:text-white">
                      ${Number(sub.amount).toFixed(2)}
                    </p>
                  </div>

                  <div className="min-w-32">{getStatusBadge(sub.status)}</div>
                </div>
              </div>
            ))
          ) : (
            <div className="bg-white dark:bg-[#1C1F2E] rounded-xl border border-gray-200 dark:border-[#2A2D3A] p-12 text-center">
              <p className="text-gray-600 dark:text-gray-400 font-medium">No subscriptions match this filter.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}

export default Dashboard
