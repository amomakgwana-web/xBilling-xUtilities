/**
 * Must be the FIRST import in index.ts. ESM imports are evaluated in
 * declaration order before the importing module's own code runs, so this
 * file's side effects (loading .env, deriving BILLING_SERVICE_URL from the
 * assigned PORT) complete before any of the mounted service routers —
 * several import-hops away — read those same env vars at their own module
 * top-level (see e.g. payments-service/src/billingClient.ts).
 */
try {
  process.loadEnvFile();
} catch {
  // no .env file — fall back to whatever the environment already provides
}

const port = Number(process.env.PORT ?? 3000);
process.env.PORT = String(port);

// payments-service calls billing-service over HTTP to apply settled
// payments to invoices. In this consolidated process both routers share one
// port, so point it at itself over loopback instead of a separate host.
process.env.BILLING_SERVICE_URL ??= `http://127.0.0.1:${port}/api/billing`;
