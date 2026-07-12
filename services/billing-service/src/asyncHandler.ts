import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Express 4 does not route a rejected promise from an async handler to
 * error middleware on its own — an uncaught throw takes down the whole
 * process (found the hard way in the gateway's municipality routes).
 * Wrap every async route body in this so a thrown error becomes a clean
 * 500 via the final error handler instead of a crash.
 */
export function asyncHandler(fn: (req: Request, res: Response, next: NextFunction) => Promise<void>): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}
