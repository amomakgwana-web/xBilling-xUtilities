import { Router } from "express";
import { forbidConsumers, forbidForeignAccount } from "../identity.js";
import { getAccountByNumber, listAccounts } from "../repository.js";

export const accountsRouter: Router = Router();

accountsRouter.get("/", async (req, res) => {
  if (forbidConsumers(req, res)) return;
  const { municipality, status } = req.query;
  const result = await listAccounts({
    municipality: typeof municipality === "string" ? municipality : undefined,
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
