import { simulateLatency } from "./base.js";
import type { KycCheck } from "@xplatform/shared-types";

/** Mock of SARS tax clearance certificate verification — currently under internal review. */
export class SARSAdapter {
  async verifyTaxClearance(idNumber: string): Promise<KycCheck> {
    await simulateLatency(200, 500);
    return {
      provider: "SARS",
      idNumber,
      result: "verified",
      checkedAt: new Date().toISOString(),
    };
  }
}
