import { Router } from "express";
import { HANISAdapter, SARSAdapter, TransUnionAdapter, DeedsRegistryAdapter } from "@xplatform/integrations";

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

  res.json({
    ok: true,
    data: { identity, taxClearance, credit, ownership },
    meta: { service: "compliance-service", tookMs: 0 },
  });
});
