import { simulateLatency, genRef } from "./base.js";

/** Mock of the MacroComm bulk SMS gateway (10,000 msg/min). */
export class MacroCommAdapter {
  async sendSms(to: string, message: string): Promise<{ messageId: string; status: "delivered" }> {
    await simulateLatency(20, 90);
    if (message.length > 160) {
      throw new Error("SMS message exceeds 160 characters");
    }
    return { messageId: genRef("SMS"), status: "delivered" };
  }

  async sendBulkSms(recipients: string[], message: string): Promise<{ batchId: string; queued: number }> {
    await simulateLatency(100, 300);
    return { batchId: genRef("SMS-BATCH"), queued: recipients.length };
  }

  async sendBulkEmail(
    recipients: string[],
    subject: string,
    html: string,
  ): Promise<{ batchId: string; queued: number }> {
    await simulateLatency(100, 300);
    return { batchId: genRef("EMAIL-BATCH"), queued: recipients.length };
  }
}
