import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const MODEL = "claude-haiku-4-5-20251001";
const MAX_BODY_CHARS = 3000;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
};

const SYSTEM_PROMPT = `You are an expert at analyzing emails to identify PAID digital/software subscriptions.

Your job: Read the email and extract subscription details. Return a JSON object.

WHAT COUNTS AS A SUBSCRIPTION (isSubscription: true):
- SaaS tools (Figma, Notion, Slack, Jira, etc.)
- AI tools (ChatGPT Plus, Claude Pro, Midjourney, Cursor, etc.)
- Streaming (Netflix, Spotify, YouTube Premium, Disney+, etc.)
- Cloud storage (Dropbox, Google One, iCloud+)
- App Store / Google Play app subscriptions (extract the SPECIFIC APP NAME, not just "App Store")
- Design/dev tools (Mobbin, Pitch, Canva Pro, GitHub Pro, etc.)
- Paid newsletters, paid creator memberships (Substack, Patreon)
- Domain registrations, hosting, VPN
- Any recurring digital service with a fee

WHAT IS NOT A SUBSCRIPTION (isSubscription: false):
- Physical product purchases (clothing, gear, equipment, food)
- Retail stores (GANNI, Zara, Arc'teryx, etc.)
- Airlines, hotels, travel bookings
- Summer camps, one-time courses
- Utility bills (electricity, water, internet ISP)
- Free newsletters (no payment involved)
- Marketing/promotional emails
- Government, bank statements
- One-time donations

CRITICAL RULES:
1. For Apple App Store emails: extract the SPECIFIC app name (e.g., "全民K歌", "WPS Office"), NOT "App Store"
2. For Stripe receipts: identify the actual service being paid for
3. For platform emails (Substack, Patreon): extract the creator/newsletter name
4. Extract the exact amount and currency from the email (C$ = CAD, $ = USD unless context says otherwise, ¥ = CNY, € = EUR)
5. If the email mentions cancellation, set status to "cancelled"
6. If no payment/charge is mentioned, look for subscription confirmation or renewal notices

Return ONLY valid JSON (no markdown, no backticks):
{
  "isSubscription": true/false,
  "confidence": "high"/"medium"/"low",
  "serviceName": "exact service name" or null,
  "serviceType": "saas"/"streaming"/"newsletter"/"gaming"/"storage"/"ai-tools"/"other" or null,
  "amount": number or null,
  "currency": "USD"/"CAD"/"CNY"/"EUR" etc or null,
  "billingCycle": "monthly"/"quarterly"/"yearly" or null,
  "nextBillingDate": "YYYY-MM-DD" or null,
  "status": "active"/"cancelled"/"pending" or null,
  "reason": "1 sentence explanation"
}`;

async function analyzeOneEmail(email: { subject: string; bodyText: string; from: string; domain: string }) {
  if (!ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY not set");

  const truncatedBody = email.bodyText.length > MAX_BODY_CHARS
    ? email.bodyText.slice(0, MAX_BODY_CHARS) + "\n...[truncated]"
    : email.bodyText;

  const userPrompt = `From: ${email.from}
Domain: ${email.domain}
Subject: ${email.subject}

Body:
${truncatedBody}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 400,
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
    const { emails } = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(JSON.stringify({ success: false, error: "Missing 'emails' array" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Process up to 10 emails in parallel
    const batch = emails.slice(0, 10);
    const results = await Promise.all(
      batch.map(async (email: any) => {
        try {
          return await analyzeOneEmail(email);
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
          };
        }
      })
    );

    return new Response(JSON.stringify({ success: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({ success: false, error: error instanceof Error ? error.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
