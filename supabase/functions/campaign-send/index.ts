// Direct port of comms-service/src/routes/campaigns.ts POST / + the
// MacroCommAdapter's live BulkSMS/Resend paths (packages/integrations/src/
// macrocomm.ts) — the one adapter in this platform that really did make
// outbound HTTP calls when credentials were present, which is the only
// reason this needs an Edge Function instead of a plain Postgres function.
//
// The DB writes (insert the campaign row, then mark it sent) go through the
// same public.create_campaign / public.mark_campaign_sent RPCs the rest of
// Stage C uses, called with the caller's own JWT forwarded — so the
// staff-only check and the audit trail entry live in exactly one place
// (the SQL functions), not duplicated here.
//
// Deploy: mcp__Supabase__deploy_edge_function. Configure BULKSMS_TOKEN_ID /
// BULKSMS_TOKEN_SECRET and/or RESEND_API_KEY / RESEND_FROM as Edge Function
// secrets to go live — without them every campaign uses the same simulated
// mock dispatch the Express version fell back to.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface CampaignSendRequest {
  name: string;
  type: "SMS" | "Email";
  municipality?: string;
  recipients?: string[];
  message?: string;
  subject?: string;
  html?: string;
}

interface DispatchResult {
  batchId: string;
  queued: number;
  live: boolean;
}

function genRef(prefix: string): string {
  const n = Math.floor(1_000_000 + Math.random() * 9_000_000);
  return `${prefix}-${n}`;
}

async function sendBulkSms(recipients: string[], message: string): Promise<DispatchResult> {
  const id = Deno.env.get("BULKSMS_TOKEN_ID");
  const secret = Deno.env.get("BULKSMS_TOKEN_SECRET");
  if (!id || !secret) {
    return { batchId: genRef("SMS-BATCH"), queued: recipients.length, live: false };
  }
  const auth = btoa(`${id}:${secret}`);
  const res = await fetch("https://api.bulksms.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
    body: JSON.stringify(recipients.map((to) => ({ to, body: message }))),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`BulkSMS rejected the batch: ${detail.slice(0, 300)}`);
  }
  const sent = (await res.json()) as Array<{ id: string }>;
  return { batchId: sent[0]?.id ?? genRef("SMS-BATCH"), queued: sent.length, live: true };
}

async function sendBulkEmail(recipients: string[], subject: string, html: string): Promise<DispatchResult> {
  const key = Deno.env.get("RESEND_API_KEY");
  if (!key) {
    return { batchId: genRef("EMAIL-BATCH"), queued: recipients.length, live: false };
  }
  const from = Deno.env.get("RESEND_FROM") ?? "xBilling <billing@resend.dev>";
  const res = await fetch("https://api.resend.com/emails/batch", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify(recipients.map((to) => ({ from, to: [to], subject, html }))),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend rejected the batch: ${detail.slice(0, 300)}`);
  }
  const body = (await res.json()) as { data?: Array<{ id: string }> };
  return { batchId: body.data?.[0]?.id ?? genRef("EMAIL-BATCH"), queued: body.data?.length ?? recipients.length, live: true };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let body: CampaignSendRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "Invalid JSON body" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
  if (!body.name || !body.type) {
    return new Response(
      JSON.stringify({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "name and type are required" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  // Forwards the caller's own JWT so create_campaign/mark_campaign_sent see
  // the same auth.jwt() claims a direct supabase.rpc() call would — the
  // staff-only check happens exactly once, inside those functions.
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: req.headers.get("authorization") ?? "" } } },
  );

  const { data: campaign, error: createError } = await supabase.rpc("create_campaign", {
    p_name: body.name,
    p_type: body.type,
    p_municipality: body.municipality ?? "All",
  });
  if (createError) {
    return new Response(
      JSON.stringify({ ok: false, data: null, error: { code: "CAMPAIGN_CREATE_FAILED", message: createError.message } }),
      { status: createError.code === "42501" ? 403 : 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const recipients = body.recipients ?? [];
  let result = campaign;
  if (recipients.length > 0) {
    try {
      const dispatch =
        body.type === "SMS"
          ? await sendBulkSms(recipients, body.message ?? "")
          : await sendBulkEmail(recipients, body.subject ?? "", body.html ?? "");

      const { data: updated, error: markError } = await supabase.rpc("mark_campaign_sent", {
        p_id: campaign.id,
        p_sent: dispatch.queued,
      });
      if (markError) throw new Error(markError.message);
      result = updated;
    } catch (err) {
      // The campaign row already exists (status: scheduled) — dispatch
      // failure doesn't roll that back, matching the Express version, which
      // never wrapped campaign creation + dispatch in a single transaction.
      return new Response(
        JSON.stringify({ ok: false, data: campaign, error: { code: "DISPATCH_FAILED", message: err instanceof Error ? err.message : "Dispatch failed" } }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }
  }

  return new Response(
    JSON.stringify({ ok: true, data: result, meta: { service: "campaign-send" } }),
    { status: 201, headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
