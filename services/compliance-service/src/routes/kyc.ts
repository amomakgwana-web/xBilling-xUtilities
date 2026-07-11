import { Router } from "express";
import { desc } from "drizzle-orm";
import { HANISAdapter, SARSAdapter, TransUnionAdapter, DeedsRegistryAdapter } from "@xplatform/integrations";
import { db } from "../db/client.js";
import { kycChecks } from "../db/schema.js";

export const kycRouter: Router = Router();

const hanis = new HANISAdapter();
const sars = new SARSAdapter();
const transUnion = new TransUnionAdapter();
const deeds = new DeedsRegistryAdapter();

kycRouter.post("/verify", async (req, res) => {
  const { idNumber, erfNumber } = req.body ?? {};
  if (!idNumber) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: "idNumber is required" } });
    return;
  }

  const [identity, taxClearance, credit, ownership] = await Promise.all([
    hanis.verifyIdentity(idNumber),
    sars.verifyTaxClearance(idNumber),
    transUnion.creditCheck(idNumber),
    erfNumber ? deeds.verifyOwnership(erfNumber, idNumber) : Promise.resolve(null),
  ]);

  const results = [identity.result, taxClearance.result, credit.result, ...(ownership ? [ownership.result] : [])];
  const outcome = results.every((r) => r === "verified") ? "verified" : "review";
  const detail = { identity, taxClearance, credit, ownership };

  // POPIA: every identity check is recorded, whatever its outcome.
  await db.insert(kycChecks).values({
    idNumber,
    erfNumber: erfNumber ?? null,
    requestedBy: req.header("x-user-sub") ?? "unknown",
    outcome,
    detail,
  });

  res.json({
    ok: true,
    data: { outcome, ...detail },
    meta: { service: "compliance-service", tookMs: 0 },
  });
});

kycRouter.get("/checks", async (req, res) => {
  const limit = Math.min(Number(req.query.limit ?? 50) || 50, 200);
  const rows = await db.select().from(kycChecks).orderBy(desc(kycChecks.id)).limit(limit);
  res.json({
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      idNumber: r.idNumber,
      erfNumber: r.erfNumber ?? undefined,
      requestedBy: r.requestedBy,
      outcome: r.outcome,
      createdAt: r.createdAt.toISOString(),
    })),
    meta: { service: "compliance-service", tookMs: 0 },
  });
});
