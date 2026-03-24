import { serve } from "https://deno.land/std@0.208.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

const STRIPE_SECRET_KEY = Deno.env.get("STRIPE_SECRET_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");

if (!STRIPE_SECRET_KEY) throw new Error("STRIPE_SECRET_KEY not set");
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("SUPABASE_URL and SUPABASE_ANON_KEY not set");
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
    // Get authorization header to verify user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { user_id, price_id } = body;

    if (!user_id || !price_id) {
      return new Response(
        JSON.stringify({ error: "Missing user_id or price_id" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Initialize Supabase client to get user's email
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    // Verify the token and get user email
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (user.id !== user_id) {
      return new Response(
        JSON.stringify({ error: "User ID mismatch" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userEmail = user.email;

    // Check if user already has a Stripe customer ID in profiles
    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user_id)
      .single();

    // Build checkout session params
    const params: Record<string, string> = {
      "mode": "subscription",
      "payment_method_types[]": "card",
      "line_items[0][price]": price_id,
      "line_items[0][quantity]": "1",
      "success_url": `https://www.snipcat.app/settings?session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": `https://www.snipcat.app/settings`,
      "client_reference_id": user_id,
      "metadata[user_id]": user_id,
    };

    // Use existing customer if available, otherwise use email
    if (profile?.stripe_customer_id) {
      params["customer"] = profile.stripe_customer_id;
    } else {
      params["customer_email"] = userEmail;
    }

    // Create Stripe checkout session
    const checkoutSessionResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams(params),
      }
    );

    if (!checkoutSessionResponse.ok) {
      const errorBody = await checkoutSessionResponse.text();
      console.error("Stripe API error:", errorBody);
      let errorMessage = "Failed to create checkout session";
      try {
        const parsed = JSON.parse(errorBody);
        if (parsed.error?.message) {
          errorMessage = parsed.error.message;
        }
      } catch (_) {
        // keep default message
      }
      return new Response(
        JSON.stringify({ error: errorMessage }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const checkoutSession = await checkoutSessionResponse.json();

    return new Response(
      JSON.stringify({
        url: checkoutSession.url,
        session_id: checkoutSession.id,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "Unknown error",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
