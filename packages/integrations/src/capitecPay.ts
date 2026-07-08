import { simulateLatency, genRef } from "./base.js";
import type { PaymentInitiationRequest } from "@xplatform/shared-types";
import type { GatewayPaymentResult } from "./swiftpay.js";

/** Mock of the Capitec real-time payment rail. */
export class CapitecPayAdapter {
  async initiatePayment(req: PaymentInitiationRequest): Promise<GatewayPaymentResult> {
    await simulateLatency(60, 180);
    return {
      ref: genRef("CAP-PAY"),
      status: "matched",
      settledAt: new Date().toISOString(),
      gateway: "CapitecPay",
    };
  }
}
