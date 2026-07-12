import { Router } from "express";
import { asyncHandler } from "../asyncHandler.js";
import { forbidConsumers, forbidForeignAccount, officialMunicipalityScope } from "../identity.js";
import { getAccountByNumber, listAccounts, setAccountStatus } from "../repository.js";

export const accountsRouter: Router = Router();

accountsRouter.get("/", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const scope = officialMunicipalityScope(req);
  const { municipality, status } = req.query;
  const result = await listAccounts({
    // An official's own municipality always wins over whatever the query
    // string says — the arrears book they see is theirs, not the platform's.
    municipality: scope ?? (typeof municipality === "string" ? municipality : undefined),
    status: typeof status === "string" ? status : undefined,
  });
  res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
});

accountsRouter.get("/:accountNumber", async (req, res) => {
  if (forbidForeignAccount(req, res, req.params.accountNumber)) return;
  const account = await getAccountByNumber(req.params.accountNumber);
  if (!account) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Account not found" } });
    return;
  }
  res.json({ ok: true, data: account, meta: { service: "billing-service", tookMs: 0 } });
});

/**
 * Escalates a severely delinquent account to legal/debt-collection handover.
 * Staff-only, and municipality-scoped the same way the arrears book itself
 * is — an official cannot hand over an account outside their own book. This
 * only flips a status flag; there is no actual collections integration
 * behind it, matching the rest of the platform's mocked third-party edges.
 */
accountsRouter.post(
  "/:accountNumber/handover",
  asyncHandler(async (req, res) => {
    if (forbidConsumers(req, res)) return;
    const accountNumber = req.params.accountNumber;
    if (!accountNumber) {
      res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "accountNumber is required" } });
      return;
    }

    const account = await getAccountByNumber(accountNumber);
    if (!account) {
      res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Account not found" } });
      return;
    }

    const scope = officialMunicipalityScope(req);
    if (scope && account.municipality !== scope) {
      res.status(403).json({ ok: false, data: null, error: { code: "FORBIDDEN", message: "This account belongs to another municipality" } });
      return;
    }

    // Toggle: send to handover, or pull back out of it if it's already there.
    const nextStatus = account.status === "handover" ? "overdue" : "handover";
    const updated = await setAccountStatus(accountNumber, nextStatus);
    res.json({ ok: true, data: updated, meta: { service: "billing-service", tookMs: 0 } });
  }),
);
