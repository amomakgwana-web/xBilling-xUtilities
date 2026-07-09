/**
 * Every adapter in this package simulates a real third-party integration:
 * network-like latency, occasional failures, and response shapes modelled on
 * the provider's real API. None of these call out to the internet — swap the
 * body of a method for a real HTTP client when a production credential
 * becomes available, the public method signatures should not need to change.
 */

export async function simulateLatency(minMs = 40, maxMs = 220): Promise<void> {
  const ms = minMs + Math.random() * (maxMs - minMs);
  await new Promise((resolve) => setTimeout(resolve, ms));
}

export function genRef(prefix: string): string {
  const n = Math.floor(1_000_000 + Math.random() * 9_000_000);
  return `${prefix}-${n}`;
}

export class IntegrationError extends Error {
  constructor(
    public readonly provider: string,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "IntegrationError";
  }
}
