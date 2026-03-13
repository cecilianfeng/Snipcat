import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Filter, Plus, ChevronDown, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import {
  getSubscriptions,
  createSubscription,
  updateSubscription,
  deleteSubscription,
  CATEGORIES,
  groupByCategory,
} from '../lib/subscriptions'

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
    notes: '',
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
        notes: editData.notes || '',
      })
    } else {
      setForm({
        name: '', category: 'other', amount: '', currency: 'USD',
        billing_cycle: 'monthly', next_billing_date: '', status: 'active', notes: '',
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
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">
            {editData ? 'Edit Subscription' : 'Add Subscription'}
          </h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X size={20} className="text-gray-500" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
            <input
              type="text"
              required
              placeholder="e.g. Netflix, Spotify, Claude..."
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] focus:border-transparent"
            />
          </div>

          {/* Category + Billing Cycle */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] bg-white"
              >
                {Object.entries(CATEGORIES).map(([key, { label }]) => (
                  <option key={key} value={key}>{label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Billing Cycle</label>
              <select
                value={form.billing_cycle}
                onChange={e => setForm(f => ({ ...f, billing_cycle: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] bg-white"
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
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Amount</label>
              <input
                type="number"
                step="0.01"
                required
                placeholder="9.99"
                value={form.amount}
                onChange={e => setForm(f => ({ ...f, amount: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Currency</label>
              <select
                value={form.currency}
                onChange={e => setForm(f => ({ ...f, currency: e.target.value }))}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] bg-white"
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (\u20ac)</option>
                <option value="GBP">GBP (\u00a3)</option>
                <option value="CNY">CNY (\u00a5)</option>
                <option value="JPY">JPY (\u00a5)</option>
              </select>
            </div>
          </div>

          {/* Next Billing Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Next Billing Date</label>
            <input
              type="date"
              value={form.next_billing_date}
              onChange={e => setForm(f => ({ ...f, next_billing_date: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316]"
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Status</label>
            <div className="flex gap-2">
              {['active', 'paused', 'cancelled'].map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setForm(f => ({ ...f, status: s }))}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors capitalize ${
                    form.status === s
                      ? 'bg-[#F97316] text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  {s}
                </button>
              ))}
            </div>
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Notes (optional)</label>
            <textarea
              rows={2}
              placeholder="Any notes about this subscription..."
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F97316] resize-none"
            />
          </div>

          {/* Buttons */}
          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2.5 bg-[#F97316] text-white rounded-lg font-medium hover:bg-[#EA580C] transition-colors disabled:opacity-50"
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

  const handleDelete = async (id) => {
    if (!confirm('Delete this subscription?')) return
    await deleteSubscription(id)
    await loadData()
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
      case 'active': return 'bg-green-100 text-green-700'
      case 'paused': return 'bg-orange-100 text-orange-700'
      case 'cancelled': return 'bg-gray-200 text-gray-600'
      default: return 'bg-gray-100 text-gray-600'
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
        <div className="text-center py-16 text-gray-500">
          No subscriptions yet. Click "Add Manually" to get started.
        </div>
      )
    }

    return (
      <div className="space-y-8">
        {categoryEntries.map(([catKey, items]) => {
          const catConfig = CATEGORIES[catKey] || CATEGORIES.other
          const sortedItems = getSortedItems(items)
          const catTotal = items.filter(s => s.status === 'active').reduce((s, i) => s + Number(i.amount), 0)

          return (
            <div key={catKey} className="space-y-4">
              <div className="flex items-center gap-3">
                <div className={`${catConfig.color} ${catConfig.textColor} p-2 rounded-lg`}>
                  <div className="w-5 h-5 rounded-full border-2 border-current" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold text-gray-900">{catConfig.label}</h3>
                  <p className="text-sm text-gray-600">{items.length} subscription{items.length !== 1 ? 's' : ''}</p>
                </div>
                <p className="ml-4 text-sm font-semibold text-gray-900">${catTotal.toFixed(2)}/mo</p>
              </div>

              <div className="space-y-2">
                {sortedItems.map(item => {
                  const isExpanded = expandedItems[item.id]
                  const isCancelled = item.status === 'cancelled'

                  return (
                    <div key={item.id} className="border border-gray-200 rounded-lg overflow-hidden">
                      <button
                        onClick={() => toggleExpanded(item.id)}
                        className={`w-full px-5 py-4 flex items-center gap-4 hover:bg-gray-50 transition-colors ${isCancelled ? 'opacity-50' : ''}`}
                      >
                        <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
                          {item.name?.charAt(0).toUpperCase()}
                        </div>
                        <div className="flex-1 text-left min-w-0">
                          <p className={`font-medium text-gray-900 ${isCancelled ? 'line-through text-gray-500' : ''}`}>
                            {item.name}
                          </p>
                          <p className="text-sm text-gray-600 capitalize">{item.billing_cycle}</p>
                        </div>
                        <div className="text-sm text-gray-600 min-w-max">
                          <p className="text-xs text-gray-500">Renews</p>
                          <p className="font-medium">{formatDate(item.next_billing_date)}</p>
                        </div>
                        <div className="text-right min-w-max">
                          <p className="text-lg font-semibold text-gray-900">${Number(item.amount).toFixed(2)}</p>
                          <p className="text-xs text-gray-500">{item.billing_cycle}</p>
                        </div>
                        <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(item.status)}`}>
                          {item.status}
                        </div>
                        <ChevronDown
                          size={20}
                          className={`text-gray-400 flex-shrink-0 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                        />
                      </button>

                      {isExpanded && (
                        <div className="border-t border-gray-200 bg-gray-50 px-5 py-6">
                          <div className="grid grid-cols-2 gap-6 mb-4">
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Start Date</p>
                              <p className="text-sm font-medium text-gray-900">{formatDate(item.start_date)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-gray-600 mb-1">Currency</p>
                              <p className="text-sm font-medium text-gray-900">{item.currency}</p>
                            </div>
                          </div>
                          {item.notes && (
                            <div className="mb-4">
                              <p className="text-xs text-gray-600 mb-1">Notes</p>
                              <p className="text-sm text-gray-900">{item.notes}</p>
                            </div>
                          )}
                          <div className="flex gap-2">
                            <button
                              onClick={() => openEdit(item)}
                              className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors"
                            >
                              Edit
                            </button>
                            {item.status !== 'cancelled' && (
                              <button
                                onClick={() => handleSave({ ...item, status: 'cancelled' })}
                                className="px-4 py-2 text-sm font-medium text-orange-600 border border-orange-300 rounded-lg hover:bg-orange-50 transition-colors"
                              >
                                Cancel Sub
                              </button>
                            )}
                            <button
                              onClick={() => handleDelete(item.id)}
                              className="px-4 py-2 text-sm font-medium text-red-600 border border-red-300 rounded-lg hover:bg-red-50 transition-colors"
                            >
                              Delete
                            </button>
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
          <div key={item.id} className={`bg-white border border-gray-200 rounded-lg px-5 py-4 flex items-center gap-4 ${item.status === 'cancelled' ? 'opacity-50' : ''}`}>
            <div className="w-10 h-10 rounded-full bg-orange-100 text-orange-700 flex items-center justify-center font-semibold text-sm flex-shrink-0">
              {item.name?.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className={`font-medium text-gray-900 ${item.status === 'cancelled' ? 'line-through' : ''}`}>{item.name}</p>
              <p className="text-sm text-gray-500 capitalize">{CATEGORIES[item.category]?.label || 'Other'}</p>
            </div>
            <div className="text-sm text-gray-600">{formatDate(item.next_billing_date)}</div>
            <div className="font-semibold text-gray-900">${Number(item.amount).toFixed(2)}</div>
            <div className={`px-3 py-1 rounded-full text-xs font-medium capitalize ${getStatusBadgeColor(item.status)}`}>
              {item.status}
            </div>
            <button onClick={() => openEdit(item)} className="text-sm text-[#F97316] font-medium hover:underline">Edit</button>
          </div>
        ))}
      </div>
    )
  }

  // ─── SPENDING VIEW ───
  const renderSpendingView = () => {
    const activeItems = subscriptions.filter(s => s.status === 'active')
    const monthlyTotal = activeItems.reduce((sum, s) => sum + Number(s.amount), 0)
    const yearlyEstimate = monthlyTotal * 12

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-1">Monthly Total</p>
            <p className="text-3xl font-bold text-gray-900">${monthlyTotal.toFixed(2)}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-600 mb-1">Yearly Estimate</p>
            <p className="text-3xl font-bold text-gray-900">${yearlyEstimate.toFixed(2)}</p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Spending by Category</h3>
          {Object.entries(groupByCategory(activeItems)).map(([catKey, items]) => {
            const catConfig = CATEGORIES[catKey] || CATEGORIES.other
            const catTotal = items.reduce((s, i) => s + Number(i.amount), 0)
            const pct = monthlyTotal > 0 ? (catTotal / monthlyTotal) * 100 : 0
            return (
              <div key={catKey} className="mb-4">
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-gray-700">{catConfig.label}</span>
                  <span className="text-gray-600">${catTotal.toFixed(2)}/mo ({pct.toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
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
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-400">Loading subscriptions...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <SubscriptionModal
        isOpen={modalOpen}
        onClose={() => { setModalOpen(false); setEditingSub(null) }}
        onSave={handleSave}
        editData={editingSub}
      />

      {/* Sticky Header */}
      <div className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Subscriptions</h1>
              <p className="text-gray-600 mt-1">Manage and track all your subscriptions</p>
            </div>
            <div className="flex gap-3">
              <button
                onClick={openAdd}
                className="px-4 py-2 bg-orange-500 text-white rounded-lg font-medium hover:bg-orange-600 flex items-center gap-2 transition-colors"
              >
                <Plus size={18} />
                Add Manually
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
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      isActive ? 'bg-orange-100 text-orange-700' : 'text-gray-600 hover:bg-gray-100'
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
              className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 transition-colors appearance-none cursor-pointer bg-white"
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
