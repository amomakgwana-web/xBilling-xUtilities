import { Router } from "express";
import { accounts } from "../store.js";

export const accountsRouter: Router = Router();

accountsRouter.get("/", (req, res) => {
  const { municipality, status } = req.query;
  let result = accounts;
  if (municipality) result = result.filter((a) => a.municipality === municipality);
  if (status) result = result.filter((a) => a.status === status);
  res.json({ ok: true, data: result, meta: { service: "billing-service", tookMs: 0 } });
});

accountsRouter.get("/:accountNumber", (req, res) => {
  const account = accounts.find((a) => a.accountNumber === req.params.accountNumber);
  if (!account) {
    res.status(404).json({ ok: false, data: null, error: { code: "NOT_FOUND", message: "Account not found" } });
    return;
  }
  res.json({ ok: true, data: account, meta: { service: "billing-service", tookMs: 0 } });
});
