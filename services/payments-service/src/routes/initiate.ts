import { Router } from "express";
import { PaymentInitiationRequestSchema, type PaymentInitiationRequest, type PaymentTransaction } from "@xplatform/shared-types";
import { SwiftPayAdapter, CapitecPayAdapter, WhatsAppPayAdapter, SamsungPayAdapter, platformEventBus, IntegrationError } from "@xplatform/integrations";
import { insertTransaction } from "../repository.js";
import { applyPaymentToOldestInvoice } from "../billingClient.js";

export const initiateRouter: Router = Router();

const swiftPay = new SwiftPayAdapter();
const capitecPay = new CapitecPayAdapter();
const whatsAppPay = new WhatsAppPayAdapter();
const samsungPay = new SamsungPayAdapter();

initiateRouter.post("/", async (req, res) => {
  const parsed = PaymentInitiationRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ ok: false, data: null, error: { code: "INVALID_REQUEST", message: parsed.error.message } });
    return;
  }
  const { accountNumber, amount, method } = parsed.data;

  try {
    const gatewayResult = await routeToGateway(method, parsed.data);

    const tx: PaymentTransaction = {
      ref: gatewayResult.ref,
      accountNumber,
      consumerName: req.body?.consumerName ?? "Unknown",
      amount,
      gateway: gatewayResult.gateway,
      method,
      status: gatewayResult.status,
      erpStatus: gatewayResult.status === "matched" ? "posted" : "pending",
      createdAt: gatewayResult.settledAt,
    };
    await insertTransaction(tx);
    platformEventBus.publish("payment.settled", tx);

    if (tx.status === "matched") {
      await applyPaymentToOldestInvoice(accountNumber, amount);
    }

    res.status(202).json({ ok: true, data: tx, meta: { service: "payments-service", tookMs: 0 } });
  } catch (err) {
    if (err instanceof IntegrationError) {
      res.status(502).json({ ok: false, data: null, error: { code: err.code, message: err.message } });
      return;
    }
    throw err;
  }
});

async function routeToGateway(method: string, req: PaymentInitiationRequest) {
  switch (method) {
    case "capitec":
      return capitecPay.initiatePayment(req);
    case "wapay":
      return whatsAppPay.initiatePayment(req);
    case "samsung":
      return samsungPay.initiatePayment(req);
    default:
      return swiftPay.initiatePayment(req);
  }
}
