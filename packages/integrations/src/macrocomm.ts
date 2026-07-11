import { simulateLatency, genRef, IntegrationError } from "./base.js";

/**
 * Comms gateway with two modes per channel:
 *
 * - **Live** when credentials are present in the environment — SMS via the
 *   BulkSMS JSON API (`BULKSMS_TOKEN_ID` + `BULKSMS_TOKEN_SECRET`), email via
 *   the Resend API (`RESEND_API_KEY`, optional `RESEND_FROM`). Real HTTP,
 *   real deliveries, provider errors surface as IntegrationError.
 * - **Mock fallback** otherwise: simulated latency and queue counts, so the
 *   platform stays fully demoable without any provider account.
 *
 * Same activation pattern as the Anthropic insight integration: drop a key
 * into the environment and the channel goes live, no code changes.
 */
export class MacroCommAdapter {
  private get bulksmsAuth(): string | null {
    const id = process.env.BULKSMS_TOKEN_ID;
    const secret = process.env.BULKSMS_TOKEN_SECRET;
    return id && secret ? Buffer.from(`${id}:${secret}`).toString("base64") : null;
  }

  private get resendKey(): string | null {
    return process.env.RESEND_API_KEY ?? null;
  }

  async sendSms(to: string, message: string): Promise<{ messageId: string; status: "delivered" | "queued" }> {
    if (message.length > 160) {
      throw new Error("SMS message exceeds 160 characters");
    }
    const result = await this.sendBulkSms([to], message);
    return { messageId: result.batchId, status: this.bulksmsAuth ? "queued" : "delivered" };
  }

  async sendBulkSms(recipients: string[], message: string): Promise<{ batchId: string; queued: number; live: boolean }> {
    const auth = this.bulksmsAuth;
    if (!auth) {
      await simulateLatency(100, 300);
      return { batchId: genRef("SMS-BATCH"), queued: recipients.length, live: false };
    }
    const res = await fetch("https://api.bulksms.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify(recipients.map((to) => ({ to, body: message }))),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new IntegrationError("BulkSMS", `HTTP_${res.status}`, `BulkSMS rejected the batch: ${detail.slice(0, 300)}`);
    }
    const sent = (await res.json()) as Array<{ id: string }>;
    return { batchId: sent[0]?.id ?? genRef("SMS-BATCH"), queued: sent.length, live: true };
  }

  async sendBulkEmail(
    recipients: string[],
    subject: string,
    html: string,
  ): Promise<{ batchId: string; queued: number; live: boolean }> {
    const key = this.resendKey;
    if (!key) {
      await simulateLatency(100, 300);
      return { batchId: genRef("EMAIL-BATCH"), queued: recipients.length, live: false };
    }
    const from = process.env.RESEND_FROM ?? "xBilling <billing@resend.dev>";
    const res = await fetch("https://api.resend.com/emails/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
      body: JSON.stringify(recipients.map((to) => ({ from, to: [to], subject, html }))),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      throw new IntegrationError("Resend", `HTTP_${res.status}`, `Resend rejected the batch: ${detail.slice(0, 300)}`);
    }
    const body = (await res.json()) as { data?: Array<{ id: string }> };
    return { batchId: body.data?.[0]?.id ?? genRef("EMAIL-BATCH"), queued: body.data?.length ?? recipients.length, live: true };
  }
}
