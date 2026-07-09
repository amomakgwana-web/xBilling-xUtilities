import type { PlatformStatus, ServiceHealth } from "@xplatform/shared-types";
import { config } from "./config.js";

async function probe(name: string, baseUrl: string): Promise<ServiceHealth> {
  const started = Date.now();
  try {
    const res = await fetch(`${baseUrl}/health`, { signal: AbortSignal.timeout(2000) });
    const latencyMs = Date.now() - started;
    return {
      name,
      url: baseUrl,
      status: res.ok ? "live" : "degraded",
      uptime: res.ok ? "100%" : "—",
      latencyMs,
    };
  } catch {
    return { name, url: baseUrl, status: "down", uptime: "—" };
  }
}

export async function getPlatformStatus(): Promise<PlatformStatus> {
  const services = await Promise.all(
    Object.entries(config.services).map(([name, url]) => probe(name, url)),
  );
  return { services, checkedAt: new Date().toISOString() };
}
