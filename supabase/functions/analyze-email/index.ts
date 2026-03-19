import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";
const MAX_BODY_CHARS = 2500; // per email, allows room for multiple emails

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const SYSTEM_PROMPT = `You are a subscription detection expert. You analyze emails to identify PAID recurring digital/software subscriptions.

You will receive 1-3 emails from the same sender. Read ALL of them carefully to build a complete picture.

## WHAT IS A SUBSCRIPTION (isSubscription: true):
- SaaS tools (Figma, Notion, Slack, Jira, Cursor, etc.)
- AI tools (ChatGPT Plus, Claude Pro, Midjourney, etc.)
- Streaming (Netflix, Spotify, YouTube Premium, Disney+, etc.)
- Cloud storage (Dropbox, Google One, iCloud+, etc.)
- App Store / Google Play app subscriptions — extract the SPECIFIC APP NAME, never "App Store"
- Design/dev tools (Mobbin, Pitch, Canva Pro, GitHub Pro, etc.)
- Paid newsletters, paid creator memberships (Substack, Patreon)
- Domain registrations, hosting services, VPNs
- Any recurring digital service with a fee

## WHAT IS NOT A SUBSCRIPTION (isSubscription: false):
- Physical product purchases or one-time orders (clothing, gear, food, equipment)
- Retail stores, fashion brands (GANNI, Zara, Arc'teryx, MAC Cosmetics, etc.)
- Airlines, hotels, travel bookings, ski passes (e.g. Ikon Pass), event tickets
- Summer camps, one-time courses
- Utility bills (electricity, water, internet ISP)
- Free newsletters, marketing emails, promotional offers with no recurring charge
- Government communications, bank statements, tax forms
- One-time donations, crowdfunding
- Loyalty/membership programs with no recurring charge (e.g. "MAC Lover" membership)
- Personal emails, individual messages from people (not businesses)
- Unknown senders where the email has no clear billing/payment content

## CRITICAL EXTRACTION RULES:
1. READ THE FULL EMAIL BODY CAREFULLY. Look for dollar amounts, prices, totals — they are often in the middle or end of the email, not just the subject line.
2. For amounts: scan for patterns like "$XX.XX", "US$XX", "C$XX", "¥XX", "€XX", "£XX". The amount might appear as "Total: $50.00", "Amount charged: $9.99", "Your plan: $XX/mo", etc.
3. For Apple App Store: extract the SPECIFIC app name, NOT "App Store" or "Apple"
4. For Stripe receipts: identify the actual service being paid for
5. For platform emails (Substack, Patreon): extract the creator/newsletter name
6. Currency: C$ = CAD, US$ or $ = USD (unless context suggests otherwise), ¥ = CNY, € = EUR, £ = GBP
7. IDENTIFY THE REAL SERVICE: Some senders use obscure domain names. Map them to well-known services when possible:
   - GCBD, gc.apple.com → iCloud / Apple
   - Emails from 163.com about Adobe → Adobe (not 163/NetEase)
   - 九点半 / jiudianbantou → 美投 (MeiTou)
   - If the email body mentions a well-known service name, use THAT as the serviceName, not the sender domain
8. SUBSCRIPTION STATUS — analyze across all provided emails:
   - "active": Recent successful payment or active subscription confirmation
   - "cancelled": Email says "cancelled", "cancellation confirmed", "subscription ended", "your plan has been cancelled"
   - "payment_failed": Email says "payment failed", "payment declined", "billing issue", "update your payment method"
   - "expired": Trial ended, subscription expired without renewal
   If the newest email is a payment failure or cancellation notice, the subscription is NOT active.
9. PAYMENT HISTORY: If multiple emails are provided, extract payment info from EACH one:
   - Each payment date and amount
   - This helps determine how long the user has been subscribed
10. BILLING CYCLE: Look for "monthly", "yearly", "annual", "/mo", "/yr", or infer from payment dates if multiple emails show a pattern.

## RESPONSE FORMAT
Return ONLY valid JSON (no markdown, no backticks):
{
  "isSubscription": true/false,
  "confidence": "high"/"medium"/"low",
  "serviceName": "Real service name (not domain)" or null,
  "serviceType": "saas"/"streaming"/"newsletter"/"gaming"/"storage"/"ai-tools"/"design"/"dev-tools"/"vpn"/"other" or null,
  "amount": number or null,
  "currency": "USD"/"CAD"/"CNY"/"EUR"/"GBP" etc or null,
  "billingCycle": "monthly"/"quarterly"/"yearly"/"weekly" or null,
  "nextBillingDate": "YYYY-MM-DD" or null,
  "status": "active"/"cancelled"/"payment_failed"/"expired" or null,
  "reason": "1 sentence explanation",
  "paymentHistory": [{"date": "YYYY-MM-DD", "amount": number, "currency": "USD"}] or []
}

IMPORTANT: paymentHistory should list every payment you can identify from the emails, newest first. If an email is a receipt/invoice with a date and amount, include it.`;

async function analyzeCandidate(candidate: {
  domain: string;
  emails: Array<{ subject: string; bodyText: string; from: string; date?: string }>;
  totalEmailCount?: number;
  lastEmailDate?: string;
  currentDate?: string;
}) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  // Build a prompt with all emails for this candidate
  const emailParts = candidate.emails.map((email, idx) => {
    const truncatedBody = email.bodyText.length > MAX_BODY_CHARS
      ? email.bodyText.slice(0, MAX_BODY_CHARS) + "\n...[truncated]"
      : email.bodyText;
    return `--- Email ${idx + 1} (${email.date || 'unknown date'}) ---
From: ${email.from}
Subject: ${email.subject}

${truncatedBody}`;
  }).join("\n\n");

  const userPrompt = `Domain: ${candidate.domain}
Total emails from this sender: ${candidate.totalEmailCount || candidate.emails.length}
Last email date: ${candidate.lastEmailDate || 'unknown'}
Today's date: ${candidate.currentDate || new Date().toISOString().split('T')[0]}

${emailParts}

Analyze these emails carefully and determine if this is a paid digital subscription. Extract all payment details you can find.`;

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

    // Support both old format (emails array) and new format (candidates array)
    const candidates = body.candidates || null;
    const emails = body.emails || null;

    if (candidates && Array.isArray(candidates) && candidates.length > 0) {
      // New format: each candidate has multiple emails
      const batch = candidates.slice(0, 8); // max 8 candidates per request
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
              serviceType: null,
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

    // Legacy format: single email per item
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
              serviceType: null,
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
