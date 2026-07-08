import { IntegrationError } from "./base.js";
import type { PaymentInitiationRequest } from "@xplatform/shared-types";

/** Mock of Samsung Pay — integration pending, not yet configured upstream. */
export class SamsungPayAdapter {
  async initiatePayment(_req: PaymentInitiationRequest): Promise<never> {
    throw new IntegrationError(
      "SamsungPay",
      "NOT_CONFIGURED",
      "Samsung Pay integration is pending configuration",
    );
  }
}
