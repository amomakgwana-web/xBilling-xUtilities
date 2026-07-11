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
  accountNumber?: string;
}

export function callerFrom(req: Request): CallerIdentity {
  return {
    sub: req.header("x-user-sub") ?? "",
    role: req.header("x-user-role") ?? "",
    accountNumber: req.header("x-user-account") || undefined,
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
