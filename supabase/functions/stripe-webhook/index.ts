import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, stripe-signature",
};

const STRIPE_WEBHOOK_SECRET = Deno.env.get("STRIPE_WEBHOOK_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!STRIPE_WEBHOOK_SECRET) throw new Error("STRIPE_WEBHOOK_SECRET not set");
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY not set");
}

// Verify Stripe webhook signature
// deno-lint-ignore no-explicit-any
function verifyWebhookSignature(payload: string, signature: string): any {
  // Import crypto utilities
  const encoder = new TextEncoder();
  const keyData = encoder.encode(STRIPE_WEBHOOK_SECRET);
  const messageData = encoder.encode(payload);

  // Note: Stripe signatures are computed as HMAC-SHA256
  // We'll use the crypto API to verify
  return crypto.subtle.sign("HMAC", keyData, messageData).then((sig) => {
    const signatureHex = Array.from(new Uint8Array(sig))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    const expectedSignature = `t=${Math.floor(Date.now() / 1000)},v1=${signatureHex}`;
    return signature === expectedSignature;
  });
}

// Verify Stripe webhook using correct signed payload format
async function verifyStripeSignature(
  payload: string,
  signature: string
): Promise<boolean> {
  // Parse the signature header: t=timestamp,v1=hash[,v1=hash...]
  const elements = signature.split(",");
  const timestampStr = elements
    .find((e) => e.startsWith("t="))
    ?.slice(2);
  const signatures = elements
    .filter((e) => e.startsWith("v1="))
    .map((e) => e.slice(3));

  if (!timestampStr || signatures.length === 0) {
    console.error("No timestamp or v1 signature found");
    return false;
  }

  // Stripe signs: "timestamp.payload" (not just payload)
  const signedPayload = `${timestampStr}.${payload}`;

  const encoder = new TextEncoder();
  const keyData = encoder.encode(STRIPE_WEBHOOK_SECRET);
  const messageData = encoder.encode(signedPayload);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const computedSignature = await crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    messageData
  );

  const computedHex = Array.from(new Uint8Array(computedSignature))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Check against all v1 signatures (Stripe may send multiple)
  return signatures.some((sig) => computedHex === sig);
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    // Get the raw body
    const payload = await req.text();
    const signature = req.headers.get("stripe-signature");

    if (!signature) {
      return new Response(
        JSON.stringify({ error: "Missing stripe-signature header" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verify webhook signature
    const isValid = await verifyStripeSignature(payload, signature);
    if (!isValid) {
      console.error("Invalid webhook signature");
      return new Response(
        JSON.stringify({ error: "Invalid signature" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse the event
    const event = JSON.parse(payload);
    const eventType = event.type;

    // Initialize Supabase client with service role key (for admin operations)
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string | null = null;

    if (eventType === "checkout.session.completed") {
      // Handle successful checkout
      const session = event.data.object;
      userId = session.client_reference_id;
      const stripeCustomerId = session.customer;
      const stripeSubscriptionId = session.subscription;

      if (!userId) {
        console.error("No client_reference_id in checkout session");
        return new Response(
          JSON.stringify({ error: "No user ID" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Update user profile: set plan to 'pro', store stripe IDs
      const { error } = await supabase
        .from("profiles")
        .update({
          plan: "pro",
          stripe_customer_id: stripeCustomerId,
          stripe_subscription_id: stripeSubscriptionId,
        })
        .eq("id", userId);

      if (error) {
        console.error("Error updating profile on checkout:", error);
        return new Response(
          JSON.stringify({ error: "Failed to update profile" }),
          { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`User ${userId} upgraded to Pro plan`);
    } else if (eventType === "customer.subscription.deleted") {
      // Handle subscription cancellation
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      // Find user by stripe_customer_id and set plan back to 'free'
      const { data: profiles, error: findError } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", stripeCustomerId)
        .limit(1);

      if (findError || !profiles || profiles.length === 0) {
        console.error("Could not find profile for subscription deletion:", findError);
        return new Response(
          JSON.stringify({ success: true }), // Still return 200 to avoid Stripe retries
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = profiles[0].id;

      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          plan: "free",
          stripe_customer_id: null,
          stripe_subscription_id: null,
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Error downgrading profile on subscription deletion:", updateError);
        return new Response(
          JSON.stringify({ success: true }), // Still return 200 to avoid Stripe retries
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      console.log(`User ${userId} subscription cancelled, downgraded to Free`);
    } else if (eventType === "customer.subscription.updated") {
      // Handle subscription updates (plan changes, etc.)
      const subscription = event.data.object;
      const stripeCustomerId = subscription.customer;

      // Find user and update their stripe_subscription_id
      const { data: profiles, error: findError } = await supabase
        .from("profiles")
        .select("id")
        .eq("stripe_customer_id", stripeCustomerId)
        .limit(1);

      if (findError || !profiles || profiles.length === 0) {
        console.log("Could not find profile for subscription update (may be normal for updates)");
        return new Response(
          JSON.stringify({ success: true }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      userId = profiles[0].id;

      // Update the subscription ID (in case it changed) and ensure plan is 'pro'
      const { error: updateError } = await supabase
        .from("profiles")
        .update({
          stripe_subscription_id: subscription.id,
          plan: subscription.status === "active" ? "pro" : "free",
        })
        .eq("id", userId);

      if (updateError) {
        console.error("Error updating subscription:", updateError);
      } else {
        console.log(`User ${userId} subscription updated`);
      }
    }

    // Return success for all event types
    return new Response(
      JSON.stringify({ success: true, event_type: eventType, user_id: userId }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Webhook error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
