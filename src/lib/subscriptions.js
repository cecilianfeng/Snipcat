import { supabase } from './supabaseClient'
 
// ─── PROFILES ───
 
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()
  if (error) throw error
  return data
}
 
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select()
    .single()
  if (error) throw error
  return data
}
 
// ─── SUBSCRIPTIONS ───
 
export async function getSubscriptions(userId) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('user_id', userId)
    .order('next_billing_date', { ascending: true })
  if (error) throw error
  return data
}
 
export async function getSubscription(id) {
  const { data, error } = await supabase
    .from('subscriptions')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}
 
export async function createSubscription(subscription) {
  const { data, error } = await supabase
    .from('subscriptions')
    .insert(subscription)
    .select()
    .single()
  if (error) throw error
  return data
}
 
export async function updateSubscription(id, updates) {
  const { data, error } = await supabase
    .from('subscriptions')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
 
export async function deleteSubscription(id) {
  const { error } = await supabase
    .from('subscriptions')
    .delete()
    .eq('id', id)
  if (error) throw error
}
 
// ─── REMINDERS ───
 
export async function getReminders(userId) {
  const { data, error } = await supabase
    .from('reminders')
    .select('*, subscriptions(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}
 
export async function createReminder(reminder) {
  const { data, error } = await supabase
    .from('reminders')
    .insert(reminder)
    .select()
    .single()
  if (error) throw error
  return data
}
 
export async function updateReminder(id, updates) {
  const { data, error } = await supabase
    .from('reminders')
    .update(updates)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}
 
export async function deleteReminder(id) {
  const { error } = await supabase
    .from('reminders')
    .delete()
    .eq('id', id)
  if (error) throw error
}
 
// ─── STATS HELPERS ───
 
export function calcMonthlyTotal(subscriptions) {
  return subscriptions
    .filter(s => s.status === 'active')
    .reduce((sum, s) => {
      switch (s.billing_cycle) {
        case 'yearly': return sum + s.amount / 12
        case 'quarterly': return sum + s.amount / 3
        case 'weekly': return sum + s.amount * 4.33
        default: return sum + s.amount
      }
    }, 0)
}
 
export function getUpcomingRenewals(subscriptions, withinDays = 7) {
  const now = new Date()
  const cutoff = new Date(now.getTime() + withinDays * 24 * 60 * 60 * 1000)
  return subscriptions.filter(s => {
    if (s.status !== 'active' || !s.next_billing_date) return false
    const d = new Date(s.next_billing_date)
    return d >= now && d <= cutoff
  })
}
 
export function groupByCategory(subscriptions) {
  const groups = {}
  for (const sub of subscriptions) {
    const cat = sub.category || 'other'
    if (!groups[cat]) groups[cat] = []
    groups[cat].push(sub)
  }
  return groups
}
 
// Category display config
export const CATEGORIES = {
  'ai-tools': { label: 'AI Tools', color: 'bg-purple-100', textColor: 'text-purple-600' },
  'entertainment': { label: 'Entertainment', color: 'bg-red-100', textColor: 'text-red-500' },
  'productivity': { label: 'Productivity', color: 'bg-blue-100', textColor: 'text-blue-600' },
  'cloud-storage': { label: 'Cloud Storage', color: 'bg-sky-100', textColor: 'text-sky-600' },
  'developer-tools': { label: 'Developer Tools', color: 'bg-indigo-100', textColor: 'text-indigo-600' },
  'music': { label: 'Music', color: 'bg-green-100', textColor: 'text-green-600' },
  'news': { label: 'News & Media', color: 'bg-amber-100', textColor: 'text-amber-600' },
  'health': { label: 'Health & Fitness', color: 'bg-pink-100', textColor: 'text-pink-600' },
  'education': { label: 'Education', color: 'bg-cyan-100', textColor: 'text-cyan-600' },
  'other': { label: 'Other', color: 'bg-gray-100', textColor: 'text-gray-600' },
}
 
