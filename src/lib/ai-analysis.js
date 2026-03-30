/**
 * AI Email Analysis — calls Supabase Edge Function → Claude Haiku API
 * Used in Phase 4 of Gmail scanner as the PRIMARY extraction method.
 *
 * V2 changes:
 * - Sends up to 3 emails per candidate (not just newest) for better context
 * - Supports payment history extraction
 * - Cancelled subscription detection (AI + time-based heuristic)
 * - New "candidates" API format for Edge Function
 */

const EDGE_FUNCTION_URL = 'https://zxhgviraiiytpdjbuhpy.supabase.co/functions/v1/analyze-email'
const SUPABASE_ANON_KEY = 'sb_publishable_c3MRfQVEtQUt6SdQFYq5Kw_kURhd3S8'
const BATCH_SIZE = 8 // reduced from 10 since each candidate now has multiple emails

/**
 * Send a batch of candidates to the Edge Function for AI analysis.
 * Each candidate contains 1-3 emails from the same sender.
 * @param {Array} candidates — max BATCH_SIZE per call
 * @returns {Promise<Array>} analysis results in same order as input
 */
async function callAnalyzeEmail(candidates) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ candidates }),
  })

  if (!response.ok) {
    const text = await response.text()
    console.error(`Edge Function error ${response.status}:`, text)
    throw new Error(`AI analysis failed (${response.status}). The service may be temporarily unavailable.`)
  }

  const data = await response.json()
  if (!data.success) throw new Error(data.error || 'Edge Function returned error')
  return data.results || []
}

/**
 * Determine if a subscription is likely cancelled based on time gap.
 * If last email was > 2x the billing cycle ago, it's probably cancelled.
 */
function isLikelyCancelled(lastEmailDate, billingCycle) {
  if (!lastEmailDate) return false
  const last = new Date(lastEmailDate)
  const now = new Date()
  const daysSinceLast = (now - last) / (1000 * 60 * 60 * 24)

  const cycleDays = {
    weekly: 7,
    monthly: 30,
    quarterly: 90,
    yearly: 365,
  }

  const expectedDays = cycleDays[billingCycle] || 30 // default monthly
  // If more than 2x the cycle has passed, likely cancelled
  return daysSinceLast > expectedDays * 2.5
}

/**
 * Run AI analysis on a list of candidate items.
 * This is the MAIN extraction method.
 *
 * Each candidate now includes multiple emails (emailDataList) for richer context.
 *
 * @param {Array} candidates — each has:
 *   - domain, emails, frequency, isKnown
 *   - emailDataList: Array<{subject, bodyText, from, date}> (up to 3 emails)
 *   - regexSubscription: fallback data
 *   - totalEmailCount: total emails from this sender
 *   - lastEmailDate: ISO date of most recent email
 * @param {Function} onProgress
 * @returns {Promise<{confirmed: Array, needsReview: Array}>}
 */
export async function analyzeWithAI(candidates, onProgress) {
  const confirmed = []
  const needsReview = []

  if (!candidates || candidates.length === 0) {
    return { confirmed, needsReview }
  }

  if (onProgress) onProgress({
    phase: 4,
    message: `AI analyzing ${candidates.length} candidates...`,
    current: 0,
    total: candidates.length,
  })

  // Build the candidate payloads for the Edge Function
  const today = new Date().toISOString().split('T')[0]
  const aiPayloads = candidates.map(c => ({
    domain: c.emailDataList?.[0]?.domain || c.domain,
    emails: (c.emailDataList || [c.emailData]).map(e => ({
      subject: e.subject || '',
      bodyText: e.bodyText || '',
      from: e.from || '',
      date: e.date || '',
    })),
    totalEmailCount: c.totalEmailCount || c.emails?.length || 1,
    lastEmailDate: c.lastEmailDate || '',
    currentDate: today,
  }))

  // Send in batches
  const allResults = []
  for (let b = 0; b < aiPayloads.length; b += BATCH_SIZE) {
    const batch = aiPayloads.slice(b, b + BATCH_SIZE)
    try {
      const results = await callAnalyzeEmail(batch)
      allResults.push(...results)
    } catch (err) {
      console.warn(`AI batch ${Math.floor(b / BATCH_SIZE) + 1} failed:`, err)
      for (let j = 0; j < batch.length; j++) {
        allResults.push(null)
      }
    }

    if (onProgress) onProgress({
      phase: 4,
      message: `AI analyzed ${Math.min(b + BATCH_SIZE, aiPayloads.length)} of ${aiPayloads.length}`,
      current: Math.min(b + BATCH_SIZE, aiPayloads.length),
      total: aiPayloads.length,
    })
  }

  // Process results
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const aiResult = allResults[i]

    if (!aiResult) {
      // AI failed — use regex fallback
      if (candidate.regexSubscription) {
        needsReview.push(candidate.regexSubscription)
      }
      continue
    }

    // AI says NOT a subscription → filter out (regardless of confidence)
    if (!aiResult.isSubscription) {
      console.log(`AI filtered: ${candidate.domain} — ${aiResult.reason}`)
      continue
    }

    // AI says IS a subscription
    const sub = candidate.regexSubscription || {}

    // AI-extracted values override regex values
    const aiName = aiResult.serviceName || sub.name
    const aiAmount = aiResult.amount ?? sub.amount
    const aiCurrency = aiResult.currency || sub.currency || 'USD'
    const aiCycle = aiResult.billingCycle || sub.billing_cycle
    const aiNextDate = aiResult.nextBillingDate || sub.next_billing_date

    // Determine status with multiple signals
    let aiStatus = aiResult.status || 'active'

    // If AI detected payment_failed or cancelled, use that
    if (aiStatus === 'payment_failed' || aiStatus === 'cancelled' || aiStatus === 'expired') {
      // AI caught it from email content — trust it
    } else {
      // Time-based cancelled detection as backup
      const lastDate = candidate.lastEmailDate || sub.last_email_date
      if (isLikelyCancelled(lastDate, aiCycle || sub.billing_cycle)) {
        aiStatus = 'possibly_cancelled'
      }
    }

    // Payment history from AI
    const paymentHistory = aiResult.paymentHistory || []

    // Use AI serviceName to get correct logo
    // This fixes cases like Adobe emails from 163.com, GCBD → iCloud, etc.
    let logoUrl = sub.logo_url
    const serviceNameLower = (aiName || '').toLowerCase()
    const knownLogoDomains = {
      'icloud': 'apple.com', 'icloud+': 'apple.com',
      'adobe': 'adobe.com', 'creative cloud': 'adobe.com',
      'youtube': 'youtube.com', 'youtube premium': 'youtube.com',
      'dropbox': 'dropbox.com', 'grammarly': 'grammarly.com',
      'jira': 'atlassian.com', 'confluence': 'atlassian.com',
      'framer': 'framer.com', 'mobbin': 'mobbin.com',
      'pitch': 'pitch.com', 'webflow': 'webflow.com',
      'nordvpn': 'nordvpn.com', 'screen studio': 'screen.studio',
      'figma': 'figma.com', 'notion': 'notion.so',
      'slack': 'slack.com', 'spotify': 'spotify.com',
      'netflix': 'netflix.com', 'disney': 'disney.com',
      'chatgpt': 'openai.com', 'openai': 'openai.com',
      'claude': 'claude.ai', 'cursor': 'cursor.com',
      'canva': 'canva.com', 'github': 'github.com',
      'vercel': 'vercel.com', 'cloudflare': 'cloudflare.com',
      'google one': 'google.com', 'google workspace': 'google.com',
      'medium': 'medium.com', 'substack': 'substack.com',
      'wps': 'wps.com', 'wps office': 'wps.com',
      'microsoft 365': 'microsoft.com', 'office 365': 'microsoft.com',
      '1password': '1password.com', 'bitwarden': 'bitwarden.com',
      'linear': 'linear.app', 'supabase': 'supabase.com',
      'netlify': 'netlify.com', 'heroku': 'heroku.com',
      'aws': 'aws.amazon.com', 'digitalocean': 'digitalocean.com',
    }
    for (const [name, domain] of Object.entries(knownLogoDomains)) {
      if (serviceNameLower.includes(name)) {
        logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
        break
      }
    }

    const subscription = {
      name: aiName,
      category: aiResult.category || sub.category || 'other',
      amount: aiAmount,
      currency: aiCurrency,
      billing_cycle: aiCycle,
      status: aiStatus,
      next_billing_date: aiNextDate,
      last_email_date: candidate.lastEmailDate || sub.last_email_date,
      logo_url: logoUrl,
      notes: `Found via inbox scan (AI: ${aiResult.confidence})`,
      _emailCount: candidate.totalEmailCount || sub._emailCount,
      _confidence: aiResult.confidence,
      _domain: sub._domain || candidate.domain,
      _singleEmail: sub._singleEmail,
      _isPending: aiStatus === 'pending',
      _aiVerified: true,
      _paymentHistory: paymentHistory,
      _aiStatus: aiStatus, // preserve original AI status for UI
    }

    // Known services OR AI high-confidence unknowns → confirmed; everything else → review
    if ((candidate.isKnown || aiResult.confidence === 'high') && aiResult.isSubscription && aiStatus === 'active') {
      confirmed.push(subscription)
    } else {
      needsReview.push(subscription)
    }
  }

  if (onProgress) onProgress({
    phase: 4,
    message: `AI done — ${confirmed.length} confirmed, ${needsReview.length} for review`,
    current: candidates.length,
    total: candidates.length,
  })

  return { confirmed, needsReview }
}
