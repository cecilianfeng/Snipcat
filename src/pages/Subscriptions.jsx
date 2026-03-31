import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, Plus, ChevronDown, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  CATEGORIES,
  groupByCategory,
  getMonthlyEquivalent,
  getYearlyEquivalent,
} from '../lib/subscriptions'
import { getServiceLogo, getColorForName, getServiceInitials } from '../lib/serviceLogos'

// ─── ADD / EDIT MODAL ───
function SubscriptionModal({ isOpen, onClose, onSave, editData }) {
  const [form, setForm] = useState({
    name: '',
    category: 'other',
    amount: '',
    currency: 'USD',
    billing_cycle: 'monthly',
    next_billing_date: '',
    status: 'active',
  })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (editData) {
      setForm({
        name: editData.name || '',
        category: editData.category || 'other',
        amount: editData.amount?.toString() || '',
        currency: editData.currency || 'USD',
        billing_cycle: editData.billing_cycle || 'monthly',
        next_billing_date: editData.next_billing_date || '',
        status: editData.status || 'active',
      })
    } else {
      setForm({
        name: '', category: 'other', amount: '', currency: 'USD',
        billing_cycle: 'monthly', next_billing_date: '', status: 'active',
      })
    }
  }, [editData, isOpen])

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
      onClose()
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
            {editData ? 'Edit Subscription' : 'Add Subscription'}
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
              {saving ? 'Saving...' : editData ? 'Save Changes' : 'Add Subscription'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ─── MAIN PAGE ───
export default function Subscriptions() {
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()
  const [subscriptions, setSubscriptions] = useState([])
  const [loading, setLoading] = useState(true)
  const [activeView, setActiveView] = useState('by-category')
  const [sortBy, setSortBy] = useState('price-high')
  const [expandedItems, setExpandedItems] = useState({})
  const [modalOpen, setModalOpen] = useState(false)
  const [editingSub, setEditingSub] = useState(null)
  const [openMenuId, setOpenMenuId] = useState(null)

  // Auto-open modal if ?add=1 from Dashboard
  useEffect(() => {
    if (searchParams.get('add') === '1') {
      setModalOpen(true)
      setSearchParams({}, { replace: true })
    }
  }, [searchParams])

  useEffect(() => {
    if (!user) return
    loadData()
  }, [user])

  const loadData = async () => {
    try {
      const data = await getSubscriptions(user.id)
      setSubscriptions(data)
    } catch (err) {
      console.error('Failed to load:', err)
    } finally {
      setLoading(false)
    }
  }

  // ─── CURRENCY CONVERSION (same as Dashboard) ───
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
  const getYearlyInDominant = (sub) => {
    const yearly = getYearlyEquivalent(sub)
    return convertToDominant(yearly, sub.currency || 'USD')
  }

  const handleSave = async (formData) => {
    try {
      if (editingSub) {
        await updateSubscription(editingSub.id, formData)
      } else {
        await createSubscription({ ...formData, user_id: user.id })
      }
      await loadData()
      setEditingSub(null)
    } catch (err) {
      console.error('Save failed:', err)
      alert('Failed to save subscription: ' + (err.message || 'Unknown error'))
      throw err // re-throw so modal knows it failed
    }
  }

  const handleCancel = async (id) => {
    try {
      await updateSubscription(id, { status: 'cancelled' })
      await loadData()
      setOpenMenuId(null)
    } catch (err) {
      console.error('Cancel failed:', err)
      alert('Failed to cancel subscription: ' + (err.message || 'Unknown error'))
    }
  }

  const handleReactivate = async (id) => {
    try {
      await updateSubscription(id, { status: 'active' })
      await loadData()
      setOpenMenuId(null)
    } catch (err) {
      console.error('Reactivate failed:', err)
    }
  }

  const openEdit = (sub) => {
    setEditingSub(sub)
    setModalOpen(true)
  }

  const openAdd = () => {
    setEditingSub(null)
    setModalOpen(true)
  }

  const toggleExpanded = (id) => {
    setExpandedItems(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case 'active': return 'bg-[#22C55E]/[0.07] text-[#22C55E]/70'
      case 'paused': return 'bg-[#F97316]/10 text-[#F97316]'
      case 'cancelled': return 'bg-[#F3F4F6] text-[#9CA3AF]'
      default: return 'bg-[#F3F4F6] text-[#9CA3AF]'
    }
  }

  const getSortedItems = (items) => {
    const sorted = [...items]
    if (sortBy === 'price-high') return sorted.sort((a, b) => b.amount - a.amount)
    if (sortBy === 'price-low') return sorted.sort((a, b) => a.amount - b.amount)
    if (sortBy === 'renewal') return sorted.sort((a, b) => new Date(a.next_billing_date || '2999') - new Date(b.next_billing_date || '2999'))
    if (sortBy === 'name') return sorted.sort((a, b) => a.name.localeCompare(b.name))
    return sorted
  }

  const formatDate = (d) => {
    if (!d) return '—'
    // Parse YYYY-MM-DD directly to avoid timezone shifting issues
    const parts = d.toString().split('T')[0].split('-')
    if (parts.length === 3) {
      const date = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]))
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
    }
    return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
  }

  // ─── CATEGORY VIEW ───
  const renderCategoryView = () => {
    const groups = groupByCategory(subscriptions)
    const categoryEntries = Object.entries(groups)

    if (categoryEntries.length === 0) {
      return (
        <div className="text-center py-16 text-[#6B7280] dark:text-gray-400">
          No subscriptions yet. Click "Add Subscription" to get started.
        </div>
      )
    }

    return (
      <div className="space-y-8">
        {categoryEntries.map(([catKey, items]) => {
          const catConfig = CATEGORIES[catKey] || CATEGORIES.other
          const sortedItems = getSortedItems(items)
          const catTotal = items.filter(s => s.status === 'active').reduce((s, i) => s + getMonthlyInDominant(i), 0)

          return (
            <div key={catKey} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`${catConfig.color} ${catConfig.textColor} p-2 rounded-lg`}>
                  <div className="w-5 h-5 rounded-full border-2 border-current" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-[#111827] dark:text-white">{catConfig.label}</h3>
                  <p className="text-sm text-[#6B7280] dark:text-gray-400">{items.length} subscription{items.length !== 1 ? 's' : ''}</p>
                </div>
                {items.length > 1 && <p className="ml-4 text-sm font-semibold text-[#111827] dark:text-white">{dominantSymbol}{catTotal.toFixed(2)}/mo</p>}
              </div>

              <div className="space-y-2">
                {sortedItems.map(item => {
                  const isExpanded = expandedItems[item.id]
                  const isCancelled = item.status === 'cancelled'

                  return (
                    <div key={item.id} className="relative border border-[#F3F4F6] dark:border-[#2A2D3A] dark:bg-[#1C1F2E] rounded-2xl overflow-hidden">
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className={`w-full px-5 py-4 flex items-center gap-4 hover:bg-[#F9FAFB] dark:hover:bg-[#252836] transition-colors ${isCancelled ? 'opacity-50' : ''}`}
                      >
                        {(() => {
                          const logoUrl = item.logo_url || getServiceLogo(item.name)?.logo
                          return logoUrl ? (
                            <img src={logoUrl} alt={item.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-gray-50 dark:bg-[#252836]"
                              onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
                          ) : null
                        })()}
                        <div
                          className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
                          style={{
                            display: (item.logo_url || getServiceLogo(item.name)?.logo) ? 'none' : 'flex',
                            backgroundColor: getColorForName(item.name) + '18',
                            color: getColorForName(item.name),
                          }}
                        >
                          {getServiceInitials(item.name)}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className={`font-medium text-[#111827] dark:text-white ${isCancelled ? 'line-through text-[#6B7280] dark:text-gray-500' : ''}`}>
                            {item.name}
                          </p>
                          <p className="text-sm text-[#6B7280] dark:text-gray-400 capitalize">{item.billing_cycle}</p>
                        </div>
                        <div className="text-right min-w-max">
                          <p className="text-xs text-[#9CA3AF] dark:text-gray-500 font-medium">Renews</p>
                          <p className="font-semibold text-[#111827] dark:text-white text-sm">{formatDate(item.next_billing_date)}</p>
                        </div>
                        <div className="text-right min-w-max">
                          {Number(item.amount) > 0 ? (
                            <>
                              <p className="font-semibold text-[#111827] dark:text-white text-sm">
                                {dominantSymbol}{getMonthlyInDominant(item).toFixed(2)}
                                <span className="text-xs text-[#9CA3AF] dark:text-gray-500 font-normal">/mo</span>
                              </p>
                              <p className="text-xs text-[#9CA3AF] dark:text-gray-500">{dominantSymbol}{getYearlyInDominant(item).toFixed(2)}/yr{(item.currency || 'USD') !== dominantCurrency && ' *'}</p>
                            </>
                          ) : (
                            <p className="font-semibold text-[#D1D5DB] dark:text-gray-600">—</p>
                          )}
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(item.status)}`}>
                          {item.status}
                        </div>
                        <ChevronDown
                          size={20}
                          className={`text-[#9CA3AF] flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-[#E5E7EB] dark:border-[#2A2D3A] bg-[#F9FAFB] dark:bg-[#252836] px-5 py-6">
                          <div className="grid grid-cols-2 gap-6 mb-4">
                            <div>
                              <p className="text-xs text-[#6B7280] dark:text-gray-400 mb-1">Start Date</p>
                              <p className="text-sm font-medium text-[#111827] dark:text-white">{formatDate(item.start_date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-[#6B7280] dark:text-gray-400 mb-1">Currency</p>
                              <p className="text-sm font-medium text-[#111827] dark:text-white">{item.currency || 'USD'}</p>
                            </div>
                          </div>
                          {(item.currency || 'USD') !== dominantCurrency && Number(item.amount) > 0 && (
                            <div className="mb-4 px-3 py-2.5 bg-[#FFF5F0] dark:bg-[#1C1F2E] border border-[#F97316]/10 dark:border-[#F97316]/20 rounded-xl">
                              <p className="text-xs font-medium text-[#111827] dark:text-white">
                                Original: {CURRENCY_SYMBOLS[item.currency] || item.currency}{Number(item.amount).toFixed(2)} {item.currency} / {item.billing_cycle || 'month'}
                              </p>
                              <p className="text-xs text-[#6B7280] dark:text-gray-400 mt-0.5">
                                → {dominantSymbol}{getMonthlyInDominant(item).toFixed(2)} {dominantCurrency}/mo · {dominantSymbol}{getYearlyInDominant(item).toFixed(2)} {dominantCurrency}/yr
                              </p>
                              <p className="text-xs text-[#9CA3AF] dark:text-gray-500 mt-0.5">
                                Rate: 1 {item.currency} ≈ {((RATES_TO_USD[item.currency] || 1) / (RATES_TO_USD[dominantCurrency] || 1)).toFixed(4)} {dominantCurrency}
                              </p>
                            </div>
                          )}
                          <div className="flex gap-2 items-center flex-wrap">
                            <button
                              onClick={() => openEdit(item)}
                              className="px-4 py-2 text-sm font-medium text-[#6B7280] dark:text-gray-400 border border-[#E5E7EB] dark:border-[#2A2D3A] rounded-full hover:bg-[#F9FAFB] dark:hover:bg-[#1C1F2E] transition-colors"
                            >
                              Edit
                            </button>
                            {/* ··· overflow menu */}
                            <div className="relative ml-auto">
                              <button
                                onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                                className="px-3 py-2 text-sm font-bold text-[#6B7280] dark:text-gray-400 border border-[#E5E7EB] dark:border-[#2A2D3A] rounded-full hover:bg-[#F9FAFB] dark:hover:bg-[#1C1F2E] transition-colors leading-none"
                              >
                                ···
                              </button>
                              {openMenuId === item.id && (
                                <div className="absolute right-0 mt-1 w-48 bg-white dark:bg-[#1C1F2E] border border-[#E5E7EB] dark:border-[#2A2D3A] rounded-xl shadow-lg z-10">
                                  {item.status !== 'cancelled' ? (
                                    <button
                                      onClick={() => handleCancel(item.id)}
                                      className="w-full px-4 py-2.5 text-sm font-medium text-[#F97316] text-left hover:bg-[#FFF5F0] dark:hover:bg-[#252836] rounded-xl transition-colors"
                                    >
                                      Mark as Cancelled
                                    </button>
                                  ) : (
                                    <button
                                      onClick={() => handleReactivate(item.id)}
                                      className="w-full px-4 py-2.5 text-sm font-medium text-[#22C55E] text-left hover:bg-green-50 dark:hover:bg-[#252836] rounded-xl transition-colors"
                                    >
                                      Mark as Active
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  // ─── ALL LIST VIEW ───
  const renderAllListView = () => {
    const sortedAll = getSortedItems(subscriptions)
    return (
      <div className="space-y-2">
        {sortedAll.map(item => (
          <div key={item.id} className={`bg-white dark:bg-[#1C1F2E] border border-[#F3F4F6] dark:border-[#2A2D3A] rounded-2xl px-5 py-4 flex items-center gap-4 ${item.status === 'cancelled' ? 'opacity-50' : ''}`}>
            {(() => {
              const logoUrl = item.logo_url || getServiceLogo(item.name)?.logo
              return logoUrl ? (
                <img src={logoUrl} alt={item.name} className="w-10 h-10 rounded-full object-cover flex-shrink-0 bg-gray-50 dark:bg-[#252836]"
                  onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'flex' }} />
              ) : null
            })()}
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center font-semibold text-sm flex-shrink-0"
              style={{
                display: (item.logo_url || getServiceLogo(item.name)?.logo) ? 'none' : 'flex',
                backgroundColor: getColorForName(item.name) + '18',
                color: getColorForName(item.name),
              }}
            >
              {getServiceInitials(item.name)}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-semibold text-[#111827] dark:text-white ${item.status === 'cancelled' ? 'line-through' : ''}`}>{item.name}</p>
              <p className="text-sm text-[#6B7280] dark:text-gray-400 capitalize">{CATEGORIES[item.category]?.label || 'Other'}</p>
            </div>
            <div className="text-right min-w-max">
              <p className="text-xs text-[#9CA3AF] dark:text-gray-500 font-medium">Renews</p>
              <p className="font-semibold text-[#111827] dark:text-white text-sm">{formatDate(item.next_billing_date)}</p>
            </div>
            <div className="text-right min-w-max">
              {Number(item.amount) > 0 ? (
                <p className="font-semibold text-[#111827] dark:text-white text-sm">
                  {dominantSymbol}{getMonthlyInDominant(item).toFixed(2)}
                  <span className="text-xs text-[#9CA3AF] dark:text-gray-500 font-normal">/mo</span>
                </p>
              ) : (
                <p className="font-semibold text-[#D1D5DB] dark:text-gray-600">—</p>
              )}
            </div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(item.status)}`}>
              {item.status}
            </div>
          </div>
        ))}
      </div>
    )
  }

  // ─── SPENDING VIEW ───
  const renderSpendingView = () => {
    const activeItems = subscriptions.filter(s => s.status === 'active')
    const monthlyTotal = activeItems.reduce((sum, s) => sum + getMonthlyInDominant(s), 0)
    const yearlyEstimate = activeItems.reduce((sum, s) => sum + getYearlyInDominant(s), 0)

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2D3A] p-6">
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mb-1">Monthly Total</p>
            <p className="text-3xl font-bold text-[#111827] dark:text-white">{dominantSymbol}{monthlyTotal.toFixed(2)}</p>
          </div>
          <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2D3A] p-6">
            <p className="text-sm text-[#6B7280] dark:text-gray-400 mb-1">Yearly Estimate</p>
            <p className="text-3xl font-bold text-[#111827] dark:text-white">{dominantSymbol}{yearlyEstimate.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white dark:bg-[#1C1F2E] rounded-2xl border border-[#E5E7EB] dark:border-[#2A2D3A] p-6">
          <h3 className="text-lg font-semibold text-[#111827] dark:text-white mb-4">Spending by Category</h3>
          {Object.entries(groupByCategory(activeItems)).map(([catKey, items]) => {
            const catConfig = CATEGORIES[catKey] || CATEGORIES.other
            const catTotal = items.reduce((s, i) => s + getMonthlyInDominant(i), 0)
            const pct = monthlyTotal > 0 ? (catTotal / monthlyTotal) * 100 : 0
            return (
              <div key={catKey} className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-[#6B7280] dark:text-gray-400">{catConfig.label}</span>
                  <span className="text-[#6B7280] dark:text-gray-400">{dominantSymbol}{catTotal.toFixed(2)}/mo ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-[#F3F4F6] dark:bg-[#252836] rounded-full overflow-hidden">
                  <div className="h-full bg-[#F97316] rounded-full" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white dark:bg-gray-950 flex items-center justify-center">
        <div className="text-[#6B7280] dark:text-gray-400">Loading subscriptions...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-950">
      <SubscriptionModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSub(null) }}
        onSave={handleSave}
        editData={editingSub}
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/90 dark:bg-[#1C1F2E]/80 backdrop-blur-md border-b border-[#E5E7EB] dark:border-[#2A2D3A]">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-[#111827] dark:text-white">Subscriptions</h1>
              <p className="text-[#6B7280] dark:text-gray-400 mt-1">Manage and track all your subscriptions</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={openAdd}
                className="px-4 py-2 border-2 border-[#E5E7EB] dark:border-[#2A2D3A] rounded-full text-[#6B7280] dark:text-gray-400 hover:bg-[#F9FAFB] dark:hover:bg-[#252836] transition-colors flex items-center gap-2 text-sm font-medium"
              >
                <Plus size={18} />
                Add Subscription
              </button>
            </div>
          </div>

          {/* View Tabs & Sort */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              {['By Category', 'All List', 'Spending'].map(tab => {
                const viewKey = tab.toLowerCase().replace(' ', '-')
                const isActive = activeView === viewKey
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveView(viewKey)}
                    className={`px-4 py-2 rounded-xl font-medium transition-colors ${
                      isActive ? 'bg-[#111827] dark:bg-white text-white dark:text-[#111827]' : 'text-[#6B7280] dark:text-gray-400 hover:text-[#111827] dark:hover:text-white bg-[#F9FAFB] dark:bg-[#252836]'
                    }`}
                  >
                    {tab}
                  </button>
                )
              })}
            </div>

            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="px-4 py-2 border border-[#E5E7EB] dark:border-[#2A2D3A] dark:bg-[#252836] dark:text-gray-300 rounded-xl text-[#6B7280] font-medium hover:bg-[#F9FAFB] dark:hover:bg-[#1C1F2E] transition-colors appearance-none cursor-pointer bg-white"
            >
              <option value="price-high">Price: High to Low</option>
              <option value="price-low">Price: Low to High</option>
              <option value="renewal">Renewal Date</option>
              <option value="name">Name (A-Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {activeView === 'by-category' && renderCategoryView()}
        {activeView === 'all-list' && renderAllListView()}
        {activeView === 'spending' && renderSpendingView()}
      </div>
    </div>
  )
}
