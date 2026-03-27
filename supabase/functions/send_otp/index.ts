import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const TWILIO_ACCOUNT_SID = Deno.env.get("TWILIO_ACCOUNT_SID");
const TWILIO_AUTH_TOKEN = Deno.env.get("TWILIO_AUTH_TOKEN");
const TWILIO_FROM = Deno.env.get("TWILIO_FROM");
const TWILIO_MESSAGING_SERVICE_SID = Deno.env.get("TWILIO_MESSAGING_SERVICE_SID");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { global: { headers: {} } });

function toHex(buffer: ArrayBuffer) {
  return Array.from(new Uint8Array(buffer)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hashOtp(otp: string) {
  const enc = new TextEncoder();
  const digest = await crypto.subtle.digest("SHA-256", enc.encode(otp));
  return toHex(digest);
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: { ...corsHeaders, "Access-Control-Allow-Methods": "POST, OPTIONS" } });
  }

  try {
    const body = await req.json();
    const phone = String(body.phone || "").trim();
    const profile_id = body.profile_id || null;
    if (!phone) {
      return new Response(JSON.stringify({ error: "phone required" }), { status: 400, headers: corsHeaders });
    }

    // generate 6-digit OTP
    const otp = String(Math.floor(100000 + Math.random() * 900000));
    const otp_hash = await hashOtp(otp);
    const expires_at = new Date(Date.now() + 5 * 60 * 1000).toISOString();

    // store OTP
    const { error: insertError } = await supabase
      .from("phone_otps")
      .insert({ phone, otp_hash, expires_at, profile_id });
    if (insertError) throw insertError;

    // send via Twilio if configured
    if (TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_FROM || TWILIO_MESSAGING_SERVICE_SID)) {
      const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
      const bodyData = new URLSearchParams();
      bodyData.append("To", phone);
      bodyData.append("Body", `Your verification code is ${otp}`);
      if (TWILIO_MESSAGING_SERVICE_SID) {
        bodyData.append("MessagingServiceSid", TWILIO_MESSAGING_SERVICE_SID);
      } else if (TWILIO_FROM) {
        bodyData.append("From", TWILIO_FROM);
      }

      const resp = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Basic ${btoa(TWILIO_ACCOUNT_SID + ":" + TWILIO_AUTH_TOKEN)}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: bodyData.toString(),
      });
      if (!resp.ok) {
        const txt = await resp.text();
        return new Response(JSON.stringify({ error: "twilio_error", details: txt }), {
          status: 502,
          headers: corsHeaders,
        });
      }
      return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
    }

    // test mode - return OTP for developer/testing when Twilio isn't configured
    return new Response(JSON.stringify({ success: true, test_otp: otp }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500, headers: corsHeaders });
  }
});
