import { serve } from "https://deno.land/std@0.201.0/http/server.ts";
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

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
    const otp = String(body.otp || "").trim();
    const profile_id = body.profile_id || null;
    if (!phone || !otp) {
      return new Response(JSON.stringify({ error: "phone and otp required" }), { status: 400, headers: corsHeaders });
    }

    // fetch latest unused OTP
    const { data, error } = await supabase
      .from("phone_otps")
      .select("*")
      .eq("phone", phone)
      .eq("used", false)
      .order("created_at", { ascending: false })
      .limit(1);
    if (error) throw error;
    if (!data || data.length === 0) {
      return new Response(JSON.stringify({ error: "no_otp_found" }), { status: 404, headers: corsHeaders });
    }

    const row: any = data[0];
    const now = new Date();
    if (new Date(row.expires_at) < now) {
      // mark used
      await supabase.from("phone_otps").update({ used: true }).eq("id", row.id);
      return new Response(JSON.stringify({ error: "expired" }), { status: 400, headers: corsHeaders });
    }

    const otp_hash = await hashOtp(otp);
    if (otp_hash !== row.otp_hash) {
      // increment attempts
      await supabase.from("phone_otps").update({ attempts: (row.attempts || 0) + 1 }).eq("id", row.id);
      if ((row.attempts || 0) + 1 >= 5) {
        await supabase.from("phone_otps").update({ used: true }).eq("id", row.id);
      }
      return new Response(JSON.stringify({ error: "invalid" }), { status: 400, headers: corsHeaders });
    }

    // mark OTP used and set profile phone/verified if profile_id provided
    await supabase.from("phone_otps").update({ used: true }).eq("id", row.id);
    if (profile_id) {
      await supabase.from("profiles").update({ phone: phone }).eq("id", profile_id);
    }

    return new Response(JSON.stringify({ success: true }), { headers: corsHeaders });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: String(err?.message ?? err) }), { status: 500, headers: corsHeaders });
  }
});
