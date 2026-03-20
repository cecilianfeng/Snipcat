import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-sonnet-4-6";
const MAX_BODY_CHARS = 2500;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const SYSTEM_PROMPT = `You are an expert at detecting PAID RECURRING DIGITAL subscriptions from email evidence.

You will receive 1-3 emails from the same sender. Read every email COMPLETELY — amounts and key details are often buried in the middle or bottom of the email body, not in the subject line.

## YOUR TASK
Determine whether these emails provide evidence of a PAID RECURRING DIGITAL subscription. You must find CONCRETE EVIDENCE of ALL THREE criteria:

1. **PAID**: The email must contain evidence of an actual monetary charge, invoice, receipt, or payment. Look for dollar amounts ($XX.XX, US$XX, C$XX, ¥XX, €XX, £XX), "amount charged", "total", "invoice", "receipt", "payment of", "billed", "renewed for". READ THE FULL EMAIL — amounts are often near the bottom.

2. **RECURRING**: The email must indicate this is a repeating charge, not a one-time purchase. Evidence includes: "monthly", "yearly", "annual", "subscription", "renewed", "next billing date", "auto-renew", "/mo", "/yr", "billing period", "recurring". Multiple emails with similar charges on different dates also indicate recurrence.

3. **DIGITAL**: The service must be software, digital content, or an online service. NOT physical goods, NOT in-person services, NOT brick-and-mortar businesses.

## WHAT IS A SUBSCRIPTION (all 3 criteria met):
- SaaS software (Figma, Notion, Slack, Jira, Cursor, WPS Office, etc.)
- AI tools (ChatGPT Plus, Claude Pro, Midjourney, etc.)
- Streaming media (Netflix, Spotify, YouTube Premium, Disney+, etc.)
- Cloud storage (Dropbox, Google One, iCloud+, etc.)
- App store recurring subscriptions (extract the SPECIFIC app name, never just "App Store")
- Design/dev tools (Mobbin, Pitch, Canva Pro, GitHub Pro, Vercel, etc.)
- Paid newsletters or creator memberships (Substack, Patreon paid tiers)
- Domain registrations, web hosting, VPN services
- Online education platforms with recurring billing (not one-time courses)

## WHAT IS NOT A SUBSCRIPTION (fails 1+ criteria):
These should ALWAYS return isSubscription: false regardless of how many emails exist:

NOT PAID (no monetary charge evidence):
- Free newsletters, marketing emails, promotional offers
- Account notifications with no billing info
- Welcome emails, onboarding emails
- Loyalty/rewards program updates (points earned, tier status)

NOT RECURRING (one-time transactions):
- One-time purchases from any store
- Event tickets, conference registrations
- One-time donations or crowdfunding
- Single course purchases

NOT DIGITAL (physical goods or in-person services):
- Clothing, fashion, retail stores (any brand selling physical products)
- Restaurants, food delivery orders
- Veterinary clinics, medical offices, dental offices
- Insurance agents, financial advisors, real estate agents
- Travel bookings, airline tickets, hotel reservations
- Ski passes, sports equipment, outdoor gear
- Summer camps, in-person classes
- Pet services, grooming, boarding
- Home services, repairs, contractors
- Car dealerships, auto services

ALSO NOT SUBSCRIPTIONS:
- Government agencies, tax authorities
- Bank statements, credit card statements
- Personal emails from individuals (not businesses)
- Emails where you cannot determine what service is being charged

## WHEN UNSURE: Default to isSubscription: false. It is MUCH better to miss a real subscription than to include something that isn't one. The user can always add missed subscriptions manually.

## SERVICE IDENTIFICATION
- Identify the real service name, not the email sender domain
- If email sender is obscure but email body mentions a well-known service, use that name
- Examples: gc.apple.com or GCBD → "iCloud+", emails via 163.com about Adobe → "Adobe Creative Cloud"
- For App Store emails: extract the specific app being billed, never just "App Store"
- For Stripe/Paddle receipts: identify the actual product/service name from the email body

## CATEGORY ASSIGNMENT
Assign the most specific category from this exact list:
- "ai-tools": AI assistants, image generators, AI coding tools
- "entertainment": Video streaming, TV, movies
- "music": Music streaming, audio platforms
- "productivity": Office suites, project management, notes, email tools, collaboration
- "cloud-storage": File storage, backup, sync services
- "developer-tools": IDEs, CI/CD, code hosting, APIs, databases
- "design": Design tools, prototyping, stock assets, creative software
- "gaming": Game subscriptions, gaming platforms
- "news": News sites, magazines, media subscriptions
- "health": Fitness apps, meditation, health tracking
- "education": Online learning platforms (recurring only)
- "security": VPN, password managers, antivirus
- "social": Social media tools, communication platforms
- "hosting": Domain registrations, web hosting, DNS
- "other": ONLY if none of the above categories fit

Think carefully about what the service actually does. Cloudflare → "hosting". Google One → "cloud-storage". WPS Office → "productivity". NordVPN → "security".

## STATUS DETECTION
Analyze the newest email first:
- "active": Recent successful payment, renewal confirmation, or active plan notice
- "cancelled": "cancelled", "cancellation confirmed", "subscription ended", "you won't be charged"
- "payment_failed": "payment failed", "declined", "billing issue", "update payment method"
- "expired": Trial ended without conversion, plan expired

## AMOUNT EXTRACTION
This is critical — READ THE ENTIRE EMAIL BODY looking for:
- "$50.00", "US$9.99", "C$14.99", "¥68", "€9.99", "£7.99"
- "Total: $XX", "Amount: $XX", "Charged: $XX", "Plan price: $XX"
- "You were charged $XX", "Payment of $XX", "$XX/month", "$XX/year"
- In tables or formatted sections that list prices
- Near the bottom of receipts where totals often appear

## RESPONSE FORMAT
Return ONLY valid JSON (no markdown, no backticks):
{
  "isSubscription": true/false,
  "confidence": "high"/"medium"/"low",
  "serviceName": "Real service name" or null,
  "category": "exact category key from list above" or null,
  "amount": number or null,
  "currency": "USD"/"CAD"/"CNY"/"EUR"/"GBP" etc or null,
  "billingCycle": "monthly"/"quarterly"/"yearly"/"weekly" or null,
  "nextBillingDate": "YYYY-MM-DD" or null,
  "status": "active"/"cancelled"/"payment_failed"/"expired" or null,
  "reason": "Brief explanation of why this is/isn't a subscription",
  "paymentHistory": [{"date": "YYYY-MM-DD", "amount": number, "currency": "USD"}] or []
}`;

async function analyzeCandidate(candidate: {
  domain: string;
  emails: Array<{ subject: string; bodyText: string; from: string; date?: string }>;
  totalEmailCount?: number;
  lastEmailDate?: string;
  currentDate?: string;
}) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const emailParts = candidate.emails.map((email, idx) => {
    const truncatedBody = email.bodyText.length > MAX_BODY_CHARS
      ? email.bodyText.slice(0, MAX_BODY_CHARS) + "\n...[truncated]"
      : email.bodyText;
    return `--- Email ${idx + 1} (${email.date || 'unknown date'}) ---\nFrom: ${email.from}\nSubject: ${email.subject}\n\n${truncatedBody}`;
  }).join("\n\n");

  const userPrompt = `Domain: ${candidate.domain}
Total emails from this sender: ${candidate.totalEmailCount || candidate.emails.length}
Last email date: ${candidate.lastEmailDate || 'unknown'}
Today's date: ${candidate.currentDate || new Date().toISOString().split('T')[0]}

${emailParts}

Analyze these emails. Is this a PAID RECURRING DIGITAL subscription? Extract all details you can find. Remember: read the FULL email body for amounts, and default to isSubscription: false when unsure.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 600,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    }),
  });

  if (!response.ok) {
    const err = await response.text();
    throw new Error(`Anthropic API ${response.status}: ${err}`);
  }

  const data = await response.json();
  const text = data.content[0]?.text || "";
  const cleaned = text.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();
  return JSON.parse(cleaned);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ success: false, error: "Method not allowed" }), {
      status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await req.json();
    const candidates = body.candidates || null;
    const emails = body.emails || null;

    if (candidates && Array.isArray(candidates) && candidates.length > 0) {
      const batch = candidates.slice(0, 8);
      const results = await Promise.all(
        batch.map(async (candidate: any) => {
          try {
            return await analyzeCandidate(candidate);
          } catch (error) {
            console.error("Error analyzing candidate:", candidate.domain, error);
            return {
              isSubscription: false,
              confidence: "low",
              serviceName: null,
              category: null,
              amount: null,
              currency: null,
              billingCycle: null,
              nextBillingDate: null,
              status: null,
              reason: `Analysis error: ${error instanceof Error ? error.message : "unknown"}`,
              paymentHistory: [],
            };
          }
        })
      );
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (emails && Array.isArray(emails) && emails.length > 0) {
      const batch = emails.slice(0, 10);
      const results = await Promise.all(
        batch.map(async (email: any) => {
          try {
            return await analyzeCandidate({
              domain: email.domain,
              emails: [{ subject: email.subject, bodyText: email.bodyText, from: email.from }],
            });
          } catch (error) {
            console.error("Error analyzing:", email.domain, error);
            return {
              isSubscription: false,
              confidence: "low",
              serviceName: null,
              category: null,
              amount: null,
              currency: null,
              billingCycle: null,
              nextBillingDate: null,
              status: null,
              reason: `Analysis error: ${error instanceof Error ? error.message : "unknown"}`,
              paymentHistory: [],
            };
          }
        })
      );
      return new Response(JSON.stringify({ success: true, results }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: false, error: "Missing 'candidates' or 'emails' array" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
