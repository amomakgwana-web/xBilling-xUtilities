import type { Request, Response } from "express";

/**
 * Identity forwarded by the gateway after JWT verification (x-user-*
 * headers). Services are only reachable through the gateway's network, so
 * these headers are trusted here; the gateway overwrites any client-supplied
 * values unconditionally.
 */
export interface CallerIdentity {
  sub: string;
  role: string;
  persona?: string;
  accountNumber?: string;
  municipalityId?: string;
}

export function callerFrom(req: Request): CallerIdentity {
  return {
    sub: req.header("x-user-sub") ?? "",
    role: req.header("x-user-role") ?? "",
    persona: req.header("x-user-persona") || undefined,
    accountNumber: req.header("x-user-account") || undefined,
    municipalityId: req.header("x-user-municipality") || undefined,
  };
}

/**
 * Returns true (and sends the 403) when a consumer tries to touch an account
 * that is not their own. Staff (admin/service) and gateway-less internal
 * calls pass through.
 */
export function forbidForeignAccount(req: Request, res: Response, accountNumber: string | undefined): boolean {
  const caller = callerFrom(req);
  if (caller.role !== "consumer") return false;
  if (accountNumber !== undefined && caller.accountNumber === accountNumber) return false;
  res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: "Consumers may only access their own account" } });
  return true;
}

/** Returns true (and sends the 403) when the caller is a consumer — for staff-only routes. */
export function forbidConsumers(req: Request, res: Response): boolean {
  const caller = callerFrom(req);
  if (caller.role !== "consumer") return false;
  res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: "This operation is restricted to municipal staff" } });
  return true;
}

/**
 * The one municipality an official may see — undefined for anyone with
 * platform-wide reach (operator, service, and consumers, who are scoped by
 * account instead). Officials and operators share the coarser `admin` role,
 * so `persona` is what actually draws this boundary.
 */
export function officialMunicipalityScope(req: Request): string | undefined {
  const caller = callerFrom(req);
  return caller.persona === "official" ? caller.municipalityId : undefined;
}

/**
 * Returns true (and sends the 403) unless the caller is platform-wide staff
 * (operator or service) — for routes covering data that isn't scoped to any
 * one municipality, like the tariff book. Officials, despite sharing the
 * `admin` role with operators, are municipality-scoped by design and must
 * not be able to change a rate every municipality bills against.
 */
export function forbidNonOperators(req: Request, res: Response): boolean {
  const caller = callerFrom(req);
  if (caller.role === "service") return false;
  if (caller.role === "admin" && caller.persona !== "official") return false;
  res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: "This operation is restricted to platform operators" } });
  return true;
}
