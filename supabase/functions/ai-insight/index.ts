// Direct port of comms-service/src/routes/insight.ts + src/ai.ts. The only
// reason this is an Edge Function and not a Postgres function like the rest
// of Stage C: it needs to make an outbound HTTPS call to api.anthropic.com,
// which Postgres can't do here. Everything else about it — the system
// prompts, the fallback copy, the optional-key behaviour — is copied
// verbatim from the Express version.
//
// Deploy: mcp__Supabase__deploy_edge_function (or `supabase functions deploy
// ai-insight`). Configure the optional ANTHROPIC_API_KEY as an Edge
// Function secret (`supabase secrets set ANTHROPIC_API_KEY=...`) — without
// it, every caller gets the deterministic fallback text, same as before.
const corsHeaders: Record<string, string> = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface InsightRequest {
  kind: "platform" | "draft-sms";
  summary?: string;
  brief?: string;
}

function decodeClaims(req: Request): Record<string, unknown> | null {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "");
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = payload + "=".repeat((4 - (payload.length % 4)) % 4);
    return JSON.parse(atob(padded));
  } catch {
    return null;
  }
}

async function generateInsight(system: string, prompt: string, fallback: string): Promise<{ text: string; mocked: boolean }> {
  const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
  if (!apiKey) {
    return { text: fallback, mocked: true };
  }

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-5",
        max_tokens: 400,
        system,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return { text: fallback, mocked: true };
    const body = (await res.json()) as { content?: Array<{ text?: string }> };
    const text = body.content?.[0]?.text;
    return text ? { text, mocked: false } : { text: fallback, mocked: true };
  } catch {
    return { text: fallback, mocked: true };
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const claims = decodeClaims(req);
  const persona = claims?.persona;
  if (persona !== "official" && persona !== "operator") {
    return new Response(
      JSON.stringify({ ok: false, data: null, error: { code: "FORBIDDEN", message: "This operation is restricted to municipal staff" } }),
      { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  let body: InsightRequest;
  try {
    body = await req.json();
  } catch {
    return new Response(
      JSON.stringify({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "Invalid JSON body" } }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  const result =
    body.kind === "draft-sms"
      ? await generateInsight(
          "You are xCentral bulk comms. Write a concise, compliant South African municipal billing SMS (max 160 chars). Use placeholders: {{NAME}} {{AMOUNT}} {{DATE}} {{LINK}}. Return only the SMS text.",
          body.brief ?? "Overdue account reminder",
          "{{MUNICIPALITY}}: R{{AMOUNT}} due {{DATE}} on acct {{ACCT}}. Pay: {{LINK}} - Queries: *120#",
        )
      : await generateInsight(
          "You are xLayer — a unified municipal utilities platform AI. Provide a concise 3-sentence executive briefing. Be precise and data-driven.",
          `Platform KPIs: ${body.summary ?? "Platform KPIs unavailable."}`,
          "Collections remain on track and all core services (billing, payments, metering, comms) are reporting live. No action required at this time.",
        );

  return new Response(
    JSON.stringify({ ok: true, data: result, meta: { service: "ai-insight", mocked: result.mocked } }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
