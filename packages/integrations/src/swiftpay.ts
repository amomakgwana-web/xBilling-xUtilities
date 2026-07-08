import { simulateLatency, genRef, IntegrationError } from "./base.js";
import type { PaymentInitiationRequest } from "@xplatform/shared-types";

export interface GatewayPaymentResult {
  ref: string;
  status: "matched" | "suspense" | "failed";
  settledAt: string;
  gateway: "SwiftPay" | "xPayments" | "CapitecPay" | "WhatsAppPay";
}

/** Mock of SwiftPay's card / EFT / Google Pay / Apple Pay rail. */
export class SwiftPayAdapter {
  async initiatePayment(req: PaymentInitiationRequest): Promise<GatewayPaymentResult> {
    await simulateLatency(80, 220);
    if (req.amount <= 0) {
      throw new IntegrationError("SwiftPay", "INVALID_AMOUNT", "Amount must be positive");
    }
    const failed = Math.random() < 0.02;
    return {
      ref: genRef("SP-PAY"),
      status: failed ? "failed" : "matched",
      settledAt: new Date().toISOString(),
      gateway: "SwiftPay",
    };
  }

  async checkStatus(ref: string): Promise<{ ref: string; status: string }> {
    await simulateLatency(20, 60);
    return { ref, status: "settled" };
  }
}
