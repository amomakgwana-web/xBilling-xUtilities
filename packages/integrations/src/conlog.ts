import { simulateLatency, genRef } from "./base.js";
import type { TokenVendRequest } from "@xplatform/shared-types";

/** Mock of Conlog's prepaid STS meter management & token vending API. */
export class ConlogAdapter {
  async vendToken(req: TokenVendRequest): Promise<{ token: string; units: number; ref: string }> {
    await simulateLatency(150, 400);
    const tariffPerUnit = 2.1;
    const units = Math.round((req.amount / tariffPerUnit) * 100) / 100;
    const token = Array.from({ length: 4 }, () =>
      Math.floor(1000 + Math.random() * 9000),
    ).join(" ");
    return { token, units, ref: genRef("STS-TOK") };
  }

  async readMeter(serial: string): Promise<{ serial: string; reading: number; readAt: string }> {
    await simulateLatency(60, 150);
    return { serial, reading: Math.round(Math.random() * 5000), readAt: new Date().toISOString() };
  }
}
