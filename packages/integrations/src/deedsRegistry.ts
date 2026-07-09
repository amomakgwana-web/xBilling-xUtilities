import { simulateLatency } from "./base.js";
import type { KycCheck } from "@xplatform/shared-types";

/** Mock of the Deeds Registry (deeds.go.za) property ownership verification service. */
export class DeedsRegistryAdapter {
  async verifyOwnership(erfNumber: string, idNumber: string): Promise<KycCheck> {
    await simulateLatency(200, 450);
    return {
      provider: "DeedsRegistry",
      idNumber,
      result: erfNumber ? "verified" : "not_found",
      checkedAt: new Date().toISOString(),
    };
  }
}
