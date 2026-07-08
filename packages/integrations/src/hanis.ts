import { simulateLatency } from "./base.js";
import type { KycCheck } from "@xplatform/shared-types";

/** Mock of the Department of Home Affairs HANIS biometric identity verification API. */
export class HANISAdapter {
  async verifyIdentity(idNumber: string): Promise<KycCheck> {
    await simulateLatency(150, 400);
    const valid = /^\d{13}$/.test(idNumber);
    return {
      provider: "HANIS",
      idNumber,
      result: valid ? "verified" : "not_found",
      checkedAt: new Date().toISOString(),
    };
  }
}
