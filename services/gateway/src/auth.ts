import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { config } from "./config.js";

export interface AuthedUser {
  sub: string;
  role: "consumer" | "admin" | "service";
}

declare module "express-serve-static-core" {
  interface Request {
    user?: AuthedUser;
  }
}

/**
 * Dev-mode gateway auth: issues/validates short-lived JWTs signed with a
 * local secret. Swap for a real IdP (Auth0/Cognito/Keycloak) by replacing
 * `issueToken` and the verify call below — downstream services only ever
 * see the decoded `req.user`, never the raw credential.
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
