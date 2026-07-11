import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export interface AuthedUser {
  sub: string;
  role: "consumer" | "admin" | "service";
  /** Present on consumer tokens: the one billing account this citizen owns. */
  accountNumber?: string;
  name?: string;
  persona?: string;
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

/**
 * Gateway-issued short-lived JWTs, minted only after a bcrypt-verified
 * email+password login against platform.users. Downstream services never
 * see the credential — the gateway forwards the verified identity as
 * x-user-* headers, which is why services must only be reachable through
 * the gateway's network.
 */
export function issueToken(user: AuthedUser): string {
  return jwt.sign(user, config.jwtSecret, { expiresIn: "12h" });
}

export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.header("authorization");
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ ok: false, data: null, error: { code: "UNAUTHENTICATED", message: "Missing bearer token" } });
    return;
  }
  try {
    const token = header.slice("Bearer ".length);
    req.user = jwt.verify(token, config.jwtSecret) as AuthedUser;
    next();
  } catch {
    res.status(401).json({ ok: false, data: null, error: { code: "INVALID_TOKEN", message: "Token is invalid or expired" } });
  }
}

/** Gate a route to specific roles. Must run after requireAuth. */
export function requireRole(...roles: Array<AuthedUser["role"]>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: `Requires one of roles: ${roles.join(", ")}` } });
      return;
    }
    next();
  };
}
