import { simulateLatency } from "./base.js";
import type { KycCheck } from "@xplatform/shared-types";

/** Mock of a TransUnion consumer credit bureau query. */
export class TransUnionAdapter {
  async creditCheck(idNumber: string): Promise<KycCheck & { score: number }> {
    await simulateLatency(150, 350);
    return {
      provider: "TransUnion",
      idNumber,
      result: "verified",
      checkedAt: new Date().toISOString(),
      score: 550 + Math.floor(Math.random() * 300),
    };
  }
}
