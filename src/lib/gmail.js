/**
 * Gmail Inbox Scanner for SnipKitty (V1)
 *
 * V1 Scope: Only SaaS software + streaming subscriptions.
 * Excluded: utility bills, one-time purchases, retail orders.
 *
 * Approach:
 * 1. Search Gmail for subscription-related emails
 * 2. Fetch FULL email body to extract real prices
 * 3. Filter using known subscription services + keyword analysis
 * 4. Exclude known retailers, ISPs, utilities
 */

const GMAIL_API = 'https://www.googleapis.com/gmail/v1/users/me'

// ─── KNOWN SUBSCRIPTION SERVICES ───
// These are always recognized as subscriptions
const KNOWN_SUBSCRIPTIONS = {
  // AI Tools
  'openai': { name: 'ChatGPT Plus', category: 'ai-tools' },
  'chatgpt': { name: 'ChatGPT Plus', category: 'ai-tools' },
  'anthropic': { name: 'Claude', category: 'ai-tools' },
  'claude.ai': { name: 'Claude', category: 'ai-tools' },
  'midjourney': { name: 'Midjourney', category: 'ai-tools' },
  'cursor.com': { name: 'Cursor', category: 'ai-tools' },
  'cursor.sh': { name: 'Cursor', category: 'ai-tools' },
  'copilot': { name: 'GitHub Copilot', category: 'ai-tools' },
  'perplexity': { name: 'Perplexity', category: 'ai-tools' },
  'jasper.ai': { name: 'Jasper AI', category: 'ai-tools' },
  'runway': { name: 'Runway', category: 'ai-tools' },
  'eleven labs': { name: 'ElevenLabs', category: 'ai-tools' },
  'elevenlabs': { name: 'ElevenLabs', category: 'ai-tools' },

  // Entertainment / Streaming
  'netflix': { name: 'Netflix', category: 'entertainment' },
  'disney+': { name: 'Disney+', category: 'entertainment' },
  'disneyplus': { name: 'Disney+', category: 'entertainment' },
  'hulu': { name: 'Hulu', category: 'entertainment' },
  'hbo max': { name: 'HBO Max', category: 'entertainment' },
  'paramount+': { name: 'Paramount+', category: 'entertainment' },
  'peacock': { name: 'Peacock', category: 'entertainment' },
  'crunchyroll': { name: 'Crunchyroll', category: 'entertainment' },
  'amazon prime': { name: 'Amazon Prime', category: 'entertainment' },
  'primevideo': { name: 'Amazon Prime Video', category: 'entertainment' },
  'youtube premium': { name: 'YouTube Premium', category: 'entertainment' },
  'youtube music': { name: 'YouTube Music', category: 'music' },
  'apple tv': { name: 'Apple TV+', category: 'entertainment' },

  // Music
  'spotify': { name: 'Spotify', category: 'music' },
  'apple music': { name: 'Apple Music', category: 'music' },
  'tidal': { name: 'Tidal', category: 'music' },
  'deezer': { name: 'Deezer', category: 'music' },
  'soundcloud go': { name: 'SoundCloud Go', category: 'music' },

  // Productivity
  'notion': { name: 'Notion', category: 'productivity' },
  'slack': { name: 'Slack', category: 'productivity' },
  'zoom': { name: 'Zoom', category: 'productivity' },
  'canva': { name: 'Canva', category: 'productivity' },
  'adobe': { name: 'Adobe Creative Cloud', category: 'productivity' },
  'microsoft 365': { name: 'Microsoft 365', category: 'productivity' },
  'office 365': { name: 'Microsoft 365', category: 'productivity' },
  'grammarly': { name: 'Grammarly', category: 'productivity' },
  'todoist': { name: 'Todoist', category: 'productivity' },
  'evernote': { name: 'Evernote', category: 'productivity' },
  'linear': { name: 'Linear', category: 'productivity' },
  '1password': { name: '1Password', category: 'productivity' },
  'lastpass': { name: 'LastPass', category: 'productivity' },
  'dashlane': { name: 'Dashlane', category: 'productivity' },
  'bitwarden': { name: 'Bitwarden', category: 'productivity' },

  // Developer Tools
  'github': { name: 'GitHub', category: 'developer-tools' },
  'gitlab': { name: 'GitLab', category: 'developer-tools' },
  'figma': { name: 'Figma', category: 'developer-tools' },
  'vercel': { name: 'Vercel', category: 'developer-tools' },
  'netlify': { name: 'Netlify', category: 'developer-tools' },
  'heroku': { name: 'Heroku', category: 'developer-tools' },
  'digitalocean': { name: 'DigitalOcean', category: 'developer-tools' },
  'railway': { name: 'Railway', category: 'developer-tools' },
  'render.com': { name: 'Render', category: 'developer-tools' },
  'supabase': { name: 'Supabase', category: 'developer-tools' },
  'firebase': { name: 'Firebase', category: 'developer-tools' },
  'postman': { name: 'Postman', category: 'developer-tools' },
  'jetbrains': { name: 'JetBrains', category: 'developer-tools' },
  'replit': { name: 'Replit', category: 'developer-tools' },

  // Cloud Storage
  'google one': { name: 'Google One', category: 'cloud-storage' },
  'icloud': { name: 'iCloud+', category: 'cloud-storage' },
  'dropbox': { name: 'Dropbox', category: 'cloud-storage' },
  'box.com': { name: 'Box', category: 'cloud-storage' },
  'google workspace': { name: 'Google Workspace', category: 'cloud-storage' },

  // VPN / Security
  'nordvpn': { name: 'NordVPN', category: 'other' },
  'expressvpn': { name: 'ExpressVPN', category: 'other' },
  'surfshark': { name: 'Surfshark', category: 'other' },
  'protonvpn': { name: 'ProtonVPN', category: 'other' },
  'proton mail': { name: 'Proton Mail', category: 'other' },
  'mullvad': { name: 'Mullvad VPN', category: 'other' },

  // Education
  'duolingo': { name: 'Duolingo Plus', category: 'education' },
  'coursera': { name: 'Coursera', category: 'education' },
  'skillshare': { name: 'Skillshare', category: 'education' },
  'masterclass': { name: 'MasterClass', category: 'education' },
  'brilliant': { name: 'Brilliant', category: 'education' },
  'udemy': { name: 'Udemy', category: 'education' },

  // Health
  'headspace': { name: 'Headspace', category: 'health' },
  'calm': { name: 'Calm', category: 'health' },
  'peloton': { name: 'Peloton', category: 'health' },
  'strava': { name: 'Strava', category: 'health' },
  'myfitnesspal': { name: 'MyFitnessPal', category: 'health' },

  // News / Media
  'medium': { name: 'Medium', category: 'news' },
  'substack': { name: 'Substack', category: 'news' },
  'nytimes': { name: 'New York Times', category: 'news' },
  'washingtonpost': { name: 'Washington Post', category: 'news' },
  'the athletic': { name: 'The Athletic', category: 'news' },
  'wall street journal': { name: 'Wall Street Journal', category: 'news' },
}

// ─── BLOCKLIST: Known non-subscription senders ───
// Retailers, ISPs, utilities, banks, carriers — always excluded
const BLOCKLIST = [
  // Telecom / ISPs / Utilities
  'bell', 'rogers', 'telus', 'fido', 'koodo', 'virgin mobile', 'shaw',
  'at&t', 'verizon', 'tmobile', 't-mobile', 'comcast', 'xfinity', 'spectrum',
  'hydro', 'enbridge', 'fortis', 'bc hydro', 'electricity', 'water bill', 'gas bill',
  // Retailers
  'bestbuy', 'best buy', 'walmart', 'amazon.ca', 'amazon.com', 'costco',
  'target', 'ikea', 'home depot', 'lowes', 'staples', 'winners',
  'aritzia', 'zara', 'h&m', 'uniqlo', 'gap', 'old navy', 'lululemon',
  'oak + fort', 'oak+fort', 'sephora', 'ulta', 'nordstrom',
  // Transportation / Car
  'uber', 'lyft', 'turo', 'enterprise', 'hertz', 'avis',
  'autoinsurance', 'car insurance', 'geico', 'progressive',
  '407etr', '407 etr',
  // Food delivery (one-time)
  'doordash', 'ubereats', 'uber eats', 'skip the dishes', 'grubhub',
  // Banks / Finance
  'paypal', 'venmo', 'interac', 'scotiabank', 'td bank', 'rbc', 'bmo', 'cibc',
  'american express', 'visa', 'mastercard', 'chase',
  // Government / Taxes
  'cra-arc', 'canada revenue', 'irs', 'government',
  // Shipping / Tracking
  'fedex', 'ups', 'usps', 'canada post', 'dhl', 'purolator',
  // Travel (one-time)
  'airbnb', 'booking.com', 'expedia', 'hotels.com', 'airline',
  // Real estate
  'rent', 'mortgage', 'property',
]

// ─── SUBSCRIPTION INDICATOR KEYWORDS ───
// If email contains these, it's more likely a subscription
const SUBSCRIPTION_KEYWORDS = [
  'subscription', 'recurring', 'renewal', 'renew', 'monthly plan',
  'annual plan', 'yearly plan', 'your plan', 'membership',
  'billing period', 'next billing', 'auto-renew', 'auto renew',
  'plan renewal', 'subscription confirmation', 'thank you for subscribing',
  'your .+ subscription', 'premium', 'pro plan', 'plus plan',
  'trial ending', 'trial expired', 'upgrade',
]

// ─── ONE-TIME PURCHASE KEYWORDS (exclude) ───
const ONE_TIME_KEYWORDS = [
  'order confirmation', 'order #', 'order number', 'shipping',
  'shipped', 'delivered', 'tracking number', 'track your',
  'your order', 'purchase confirmation', 'one-time', 'one time',
  'return', 'refund', 'exchange', 'warranty',
]

// ─── GMAIL API HELPERS ───

async function searchMessages(token, query, maxResults = 100) {
  const url = `${GMAIL_API}/messages?q=${encodeURIComponent(query)}&maxResults=${maxResults}`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const err = await res.text()
    throw new Error(`Gmail search failed: ${res.status} ${err}`)
  }
  const data = await res.json()
  return data.messages || []
}

async function getMessage(token, messageId) {
  // Fetch full message to get body content
  const url = `${GMAIL_API}/messages/${messageId}?format=full`
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) return null
  return res.json()
}

function getHeader(message, name) {
  const header = message.payload?.headers?.find(
    h => h.name.toLowerCase() === name.toLowerCase()
  )
  return header?.value || ''
}

/**
 * Decode base64url encoded email body
 */
function decodeBody(payload) {
  let body = ''

  // Try direct body data
  if (payload.body?.data) {
    try {
      body = atob(payload.body.data.replace(/-/g, '+').replace(/_/g, '/'))
    } catch (e) {
      body = ''
    }
  }

  // Try parts (multipart emails)
  if (!body && payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body?.data) {
        try {
          body = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
          break
        } catch (e) { /* skip */ }
      }
    }
    // Fallback to HTML part
    if (!body) {
      for (const part of payload.parts) {
        if (part.mimeType === 'text/html' && part.body?.data) {
          try {
            const html = atob(part.body.data.replace(/-/g, '+').replace(/_/g, '/'))
            // Strip HTML tags for text extraction
            body = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
            break
          } catch (e) { /* skip */ }
        }
        // Nested parts
        if (part.parts) {
          for (const sub of part.parts) {
            if (sub.body?.data) {
              try {
                const decoded = atob(sub.body.data.replace(/-/g, '+').replace(/_/g, '/'))
                if (sub.mimeType === 'text/plain') {
                  body = decoded
                  break
                } else if (sub.mimeType === 'text/html') {
                  body = decoded.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
                }
              } catch (e) { /* skip */ }
            }
          }
          if (body) break
        }
      }
    }
  }

  return body
}

/**
 * Extract dollar amounts from text, return the most likely subscription price
 */
function extractAmount(text) {
  // Match patterns like $9.99, $99.99, $199.00, CA$9.99, USD 9.99
  const patterns = [
    /(?:CA)?\$\s?(\d{1,5}\.\d{2})/g,
    /USD\s?(\d{1,5}\.\d{2})/gi,
    /(\d{1,5}\.\d{2})\s?(?:USD|CAD)/gi,
  ]

  const amounts = []
  for (const pattern of patterns) {
    let match
    while ((match = pattern.exec(text)) !== null) {
      const val = parseFloat(match[1])
      // Filter out unrealistic subscription prices
      if (val > 0 && val < 1000) {
        amounts.push(val)
      }
    }
  }

  if (amounts.length === 0) return null

  // Return most common amount, or if all unique, the first one
  const countMap = {}
  for (const a of amounts) {
    countMap[a] = (countMap[a] || 0) + 1
  }
  const sorted = Object.entries(countMap).sort((a, b) => b[1] - a[1])
  return parseFloat(sorted[0][0])
}

/**
 * Detect billing cycle from email text
 */
function detectBillingCycle(text) {
  const lower = text.toLowerCase()
  if (lower.includes('annual') || lower.includes('yearly') || lower.includes('/year') || lower.includes('per year') || lower.includes('/yr')) return 'yearly'
  if (lower.includes('quarter') || lower.includes('/quarter')) return 'quarterly'
  if (lower.includes('weekly') || lower.includes('/week')) return 'weekly'
  return 'monthly'
}

/**
 * Check if email content looks like a subscription (not one-time purchase)
 */
function isLikelySubscription(from, subject, bodyText) {
  const combined = `${from} ${subject} ${bodyText}`.toLowerCase()

  // Check blocklist first
  for (const blocked of BLOCKLIST) {
    if (combined.includes(blocked.toLowerCase())) return false
  }

  // Check for one-time purchase indicators
  let oneTimeScore = 0
  for (const kw of ONE_TIME_KEYWORDS) {
    if (combined.includes(kw)) oneTimeScore++
  }
  if (oneTimeScore >= 2) return false

  // Check for subscription indicators
  let subScore = 0
  for (const kw of SUBSCRIPTION_KEYWORDS) {
    if (combined.includes(kw)) subScore++
  }

  return subScore >= 1
}

/**
 * Match email to known subscription service
 */
function matchKnownService(from, subject, bodyText) {
  const combined = `${from} ${subject} ${bodyText}`.toLowerCase()
  for (const [keyword, info] of Object.entries(KNOWN_SUBSCRIPTIONS)) {
    if (combined.includes(keyword.toLowerCase())) {
      return info
    }
  }
  return null
}

/**
 * Extract sender domain for logo URL
 */
function extractDomain(from) {
  const match = from.match(/@([^\s>]+)/)
  return match ? match[1] : null
}

/**
 * Get logo URL for a domain using Google Favicon API
 */
function getLogoUrl(from) {
  const domain = extractDomain(from)
  if (!domain) return null
  // Google's favicon service - reliable and free
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`
}

/**
 * Extract a clean service name from From header
 */
function extractServiceName(from) {
  const nameMatch = from.match(/^"?([^"<]+)"?\s*</)
  if (nameMatch) {
    const name = nameMatch[1].trim()
    const skipNames = ['noreply', 'billing', 'no-reply', 'receipt', 'support', 'payments', 'info', 'team', 'hello', 'notifications', 'mailer']
    if (!skipNames.some(g => name.toLowerCase().includes(g))) {
      return name
    }
  }
  // Try domain name
  const domainMatch = from.match(/@([^.>]+)/)
  if (domainMatch) {
    const domain = domainMatch[1]
    const skipDomains = ['gmail', 'yahoo', 'outlook', 'hotmail', 'mail', 'email']
    if (!skipDomains.includes(domain.toLowerCase())) {
      return domain.charAt(0).toUpperCase() + domain.slice(1)
    }
  }
  return null
}

/**
 * Main scan function — searches Gmail for real subscriptions
 *
 * @param {string} token - Google OAuth access token
 * @param {function} onProgress - callback(current, total) for progress updates
 * @returns {Array} Found subscriptions with logo_url
 */
export async function scanGmailForSubscriptions(token, onProgress) {
  if (!token) throw new Error('No Google token available. Please sign out and sign in again.')

  // Search specifically for subscription-related emails (last 6 months)
  const query = '(subject:(subscription OR renewal OR "your plan" OR "billing period" OR "auto-renew" OR "membership" OR "premium" OR "pro plan") OR from:(subscription OR billing OR noreply)) newer_than:6m -category:promotions'

  const messages = await searchMessages(token, query, 100)
  if (messages.length === 0) return []

  const found = new Map() // key: normalized name → subscription data
  const total = Math.min(messages.length, 100)

  for (let i = 0; i < total; i++) {
    if (onProgress) onProgress(i + 1, total)

    const msg = await getMessage(token, messages[i].id)
    if (!msg) continue

    const from = getHeader(msg, 'From')
    const subject = getHeader(msg, 'Subject')
    const bodyText = decodeBody(msg.payload)

    // First: check if it's a known subscription service
    const known = matchKnownService(from, subject, bodyText)

    if (known) {
      const key = known.name.toLowerCase()
      if (found.has(key)) continue

      const fullText = `${subject} ${bodyText}`
      found.set(key, {
        name: known.name,
        category: known.category,
        amount: extractAmount(fullText) || 0,
        currency: 'USD',
        billing_cycle: detectBillingCycle(fullText),
        status: 'active',
        next_billing_date: null,
        logo_url: getLogoUrl(from),
        notes: 'Found via inbox scan',
      })
      continue
    }

    // Not a known service — check if it's likely a subscription
    if (!isLikelySubscription(from, subject, bodyText)) continue

    const serviceName = extractServiceName(from)
    if (!serviceName) continue

    const key = serviceName.toLowerCase()
    if (found.has(key)) continue

    const fullText = `${subject} ${bodyText}`
    found.set(key, {
      name: serviceName,
      category: 'other',
      amount: extractAmount(fullText) || 0,
      currency: 'USD',
      billing_cycle: detectBillingCycle(fullText),
      status: 'active',
      next_billing_date: null,
      logo_url: getLogoUrl(from),
      notes: 'Found via inbox scan',
    })
  }

  return [...found.values()]
}

/**
 * Quick check if we have a valid Gmail token
 */
export async function testGmailAccess(token) {
  try {
    const url = `${GMAIL_API}/profile`
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
    })
    return res.ok
  } catch {
    return false
  }
}
