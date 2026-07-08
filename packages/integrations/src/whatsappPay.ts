import { simulateLatency, genRef, IntegrationError } from "./base.js";
import type { PaymentInitiationRequest } from "@xplatform/shared-types";
import type { GatewayPaymentResult } from "./swiftpay.js";

/** Mock of WhatsApp Pay via Meta's Business API — currently under compliance review upstream. */
export class WhatsAppPayAdapter {
  async initiatePayment(req: PaymentInitiationRequest): Promise<GatewayPaymentResult> {
    await simulateLatency(100, 260);
    throw new IntegrationError(
      "WhatsAppPay",
      "UNDER_REVIEW",
      "WhatsApp Pay is under compliance review and cannot accept live payments yet",
    );
  }

  async sendPaymentLink(to: string, amount: number): Promise<{ messageId: string }> {
    await simulateLatency(80, 200);
    return { messageId: genRef("WA-MSG") };
  }
}
