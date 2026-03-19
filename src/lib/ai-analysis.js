/**
 * AI Email Analysis — calls Supabase Edge Function → Claude Haiku API
 * Used in Phase 4 of Gmail scanner as the PRIMARY extraction method.
 * AI reads the email and determines: is it a subscription? what's the name/amount/cycle?
 */

const EDGE_FUNCTION_URL = 'https://zxhgviraiiytpdjbuhpy.supabase.co/functions/v1/analyze-email'
const SUPABASE_ANON_KEY = 'sb_publishable_c3MRfQVEtQUt6SdQFYq5Kw_kURhd3S8'
const BATCH_SIZE = 10

/**
 * Send a batch of emails to the Edge Function for AI analysis.
 * @param {Array<{subject, bodyText, from, domain}>} emails — max 10 per call
 * @returns {Promise<Array>} analysis results in same order as input
 */
async function callAnalyzeEmail(emails) {
  const response = await fetch(EDGE_FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'apikey': SUPABASE_ANON_KEY,
    },
    body: JSON.stringify({ emails }),
  })

  if (!response.ok) {
    const text = await response.text()
    throw new Error(`Edge Function error ${response.status}: ${text}`)
  }

  const data = await response.json()
  if (!data.success) throw new Error(data.error || 'Edge Function returned error')
  return data.results || []
}

/**
 * Run AI analysis on a list of candidate items.
 * This is the MAIN extraction method — replaces regex-based extraction.
 *
 * For each candidate:
 * - Sends email content to Claude AI
 * - AI determines if it's a subscription
 * - AI extracts name, amount, currency, cycle, status
 * - Non-subscriptions are filtered out
 *
 * @param {Array<{domain, emails, frequency, isKnown, emailData}>} candidates
 *   Each candidate has emailData: { subject, bodyText, from, domain }
 * @param {Function} onProgress — progress callback
 * @returns {Promise<{confirmed: Array, needsReview: Array}>}
 */
export async function analyzeWithAI(candidates, onProgress) {
  const confirmed = []
  const needsReview = []

  if (!candidates || candidates.length === 0) {
    return { confirmed, needsReview }
  }

  // Prepare all email data for AI
  const emailsToAnalyze = candidates.map(c => c.emailData)

  if (onProgress) onProgress({
    phase: 4,
    message: `AI analyzing ${emailsToAnalyze.length} candidates...`,
    current: 0,
    total: emailsToAnalyze.length,
  })

  // Send in batches of BATCH_SIZE, process batches in parallel where safe
  const allResults = []
  for (let b = 0; b < emailsToAnalyze.length; b += BATCH_SIZE) {
    const batch = emailsToAnalyze.slice(b, b + BATCH_SIZE)
    try {
      const results = await callAnalyzeEmail(batch)
      allResults.push(...results)
    } catch (err) {
      console.warn(`AI batch ${Math.floor(b / BATCH_SIZE) + 1} failed:`, err)
      // Fill with fallback for this batch
      for (let j = 0; j < batch.length; j++) {
        allResults.push(null) // null = AI failed, use regex fallback
      }
    }

    if (onProgress) onProgress({
      phase: 4,
      message: `AI analyzed ${Math.min(b + BATCH_SIZE, emailsToAnalyze.length)} of ${emailsToAnalyze.length}`,
      current: Math.min(b + BATCH_SIZE, emailsToAnalyze.length),
      total: emailsToAnalyze.length,
    })
  }

  // Process results
  for (let i = 0; i < candidates.length; i++) {
    const candidate = candidates[i]
    const aiResult = allResults[i]

    if (!aiResult) {
      // AI failed for this item — use the regex fallback data
      if (candidate.regexSubscription) {
        needsReview.push(candidate.regexSubscription)
      }
      continue
    }

    // AI says NOT a subscription → filter it out
    if (!aiResult.isSubscription && aiResult.confidence !== 'low') {
      console.log(`AI filtered: ${candidate.emailData.domain} — ${aiResult.reason}`)
      continue
    }

    // AI says IS a subscription (or low confidence — keep for review)
    const sub = candidate.regexSubscription || {}

    // AI-extracted values override regex values
    const aiName = aiResult.serviceName || sub.name
    const aiAmount = aiResult.amount ?? sub.amount
    const aiCurrency = aiResult.currency || sub.currency || 'USD'
    const aiCycle = aiResult.billingCycle || sub.billing_cycle
    const aiStatus = aiResult.status || sub.status || 'active'
    const aiNextDate = aiResult.nextBillingDate || sub.next_billing_date

    const subscription = {
      name: aiName,
      category: aiResult.serviceType || sub.category || 'other',
      amount: aiAmount,
      currency: aiCurrency,
      billing_cycle: aiCycle,
      status: aiStatus,
      next_billing_date: aiNextDate,
      last_email_date: sub.last_email_date,
      logo_url: sub.logo_url,
      notes: `Found via inbox scan (AI: ${aiResult.confidence})`,
      _emailCount: sub._emailCount,
      _confidence: aiResult.confidence,
      _domain: sub._domain || candidate.emailData.domain,
      _singleEmail: sub._singleEmail,
      _isPending: aiStatus === 'pending',
      _aiVerified: true,
    }

    // High confidence known services → confirmed; everything else → review
    if (candidate.isKnown && aiResult.confidence === 'high' && aiResult.isSubscription) {
      confirmed.push(subscription)
    } else {
      needsReview.push(subscription)
    }
  }

  if (onProgress) onProgress({
    phase: 4,
    message: `AI done — ${confirmed.length} confirmed, ${needsReview.length} for review`,
    current: emailsToAnalyze.length,
    total: emailsToAnalyze.length,
  })

  return { confirmed, needsReview }
}
