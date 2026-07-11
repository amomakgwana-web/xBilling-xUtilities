// Integration tests against a running stack (gateway :4000 + 5 services +
// seeded Postgres). CI boots the stack from db/*.sql; locally: pnpm run dev.
// Dependency-free: node:test + global fetch.
import test from "node:test";
import assert from "node:assert/strict";

const API = process.env.API_BASE_URL ?? "http://localhost:4000/api";

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return { status: res.status, body: await res.json() };
}

async function get(path, token) {
  const res = await fetch(`${API}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  return { status: res.status, body: await res.json() };
}

async function post(path, token, data) {
  const res = await fetch(`${API}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

test("login rejects wrong password", async () => {
  const { status, body } = await login("thandi.cele@example.co.za", "not-the-password");
  assert.equal(status, 401);
  assert.equal(body.error.code, "INVALID_CREDENTIALS");
});

test("login rejects unknown user", async () => {
  const { status } = await login("nobody@example.co.za", "whatever");
  assert.equal(status, 401);
});

test("unauthenticated API access is rejected", async () => {
  const { status } = await get("/billing/accounts");
  assert.equal(status, 401);
});

test("citizen: bcrypt login returns account-bound session", async () => {
  const { status, body } = await login("thandi.cele@example.co.za", "Citizen!2026");
  assert.equal(status, 200);
  assert.equal(body.data.user.persona, "citizen");
  assert.equal(body.data.user.accountNumber, "WE-2024-00421");
});

test("citizen: may read own account, not others", async () => {
  const { body: auth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const token = auth.data.token;

  const own = await get("/billing/accounts/WE-2024-00421", token);
  assert.equal(own.status, 200);
  assert.equal(own.body.data.accountNumber, "WE-2024-00421");

  const foreign = await get("/billing/accounts/TSH-2025-00012", token);
  assert.equal(foreign.status, 403);

  const list = await get("/billing/accounts", token);
  assert.equal(list.status, 403);
});

test("citizen: invoice queries are forced onto their own account", async () => {
  const { body: auth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const { status, body } = await get("/billing/invoices?accountNumber=TSH-2025-00012", auth.data.token);
  assert.equal(status, 200);
  for (const invoice of body.data) {
    assert.equal(invoice.accountNumber, "WE-2024-00421");
  }
});

test("citizen: cannot vend a token on someone else's meter", async () => {
  const { body: auth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const { status } = await post("/metering/meters/vend-token", auth.data.token, {
    serial: "MTR-TSH-007812",
    amount: 50,
  });
  assert.equal(status, 403);
});

test("citizen: comms and compliance stay staff-only", async () => {
  const { body: auth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  assert.equal((await get("/comms/campaigns", auth.data.token)).status, 403);
  assert.equal((await get("/compliance/score", auth.data.token)).status, 403);
});

test("operator: full access + payment settles cross-service", async () => {
  const { body: auth } = await login("operator@xplatform.co.za", "Operator!2026");
  const token = auth.data.token;

  assert.equal((await get("/billing/accounts", token)).status, 200);
  assert.equal((await get("/compliance/score", token)).status, 200);

  const before = await get("/billing/accounts/WE-2024-00421", token);
  const pay = await post("/payments/initiate", token, {
    accountNumber: "WE-2024-00421",
    amount: 25,
    method: "card",
    consumerName: "Thandi Cele",
  });
  assert.equal(pay.status, 202);
  assert.equal(pay.body.data.status, "matched");

  // payments-service → billing-service over HTTP; give it a beat to settle.
  await new Promise((r) => setTimeout(r, 500));
  const after = await get("/billing/accounts/WE-2024-00421", token);
  assert.ok(after.body.data.balance <= before.body.data.balance - 24.99);
});

test("billing run prices consumption with tariffs and VAT, and never double-bills", async () => {
  const { body: auth } = await login("operator@xplatform.co.za", "Operator!2026");
  const token = auth.data.token;
  // Unique per run so the test is idempotent against a persistent database.
  const period = `t-${Date.now()}`;

  const first = await post("/billing/billing-runs", token, { municipality: "eThekwini", billingPeriod: period });
  assert.equal(first.status, 201);
  assert.equal(first.body.data.status, "completed");
  assert.ok(first.body.data.accountsProcessed >= 1);
  assert.ok(first.body.data.totalBilled > 0);

  const invoices = await get(`/billing/invoices?accountNumber=ETH-2024-00566`, token);
  const generated = invoices.body.data.find((i) => i.billingPeriod === period);
  assert.ok(generated, "billing run should generate an invoice");
  assert.ok(generated.lines.some((l) => l.description.startsWith("VAT @")));
  const subtotal = generated.lines.filter((l) => !l.description.startsWith("VAT")).reduce((s, l) => s + l.amount, 0);
  const vat = generated.lines.find((l) => l.description.startsWith("VAT")).amount;
  assert.ok(Math.abs(vat - subtotal * 0.15) < 0.02, "VAT should be 15% of subtotal");

  const rerun = await post("/billing/billing-runs", token, { municipality: "eThekwini", billingPeriod: period });
  assert.equal(rerun.body.data.accountsProcessed, 0, "re-run must not double-bill");
});

test("audit chain records mutations and verifies intact", async () => {
  const { body: auth } = await login("operator@xplatform.co.za", "Operator!2026");
  const token = auth.data.token;

  // The mutations above have been audited fire-and-forget; allow them to land.
  await new Promise((r) => setTimeout(r, 500));
  const events = await get("/compliance/audit/events?limit=10", token);
  assert.equal(events.status, 200);
  assert.ok(events.body.data.length >= 1, "mutations should be audited");

  const verify = await get("/compliance/audit/verify", token);
  assert.equal(verify.body.data.intact, true);
});

test("kyc checks are persisted", async () => {
  const { body: auth } = await login("operator@xplatform.co.za", "Operator!2026");
  const token = auth.data.token;
  const run = await post("/compliance/kyc/verify", token, { idNumber: "9001019999087" });
  assert.equal(run.status, 200);
  assert.ok(["verified", "review"].includes(run.body.data.outcome));

  const checks = await get("/compliance/kyc/checks", token);
  assert.ok(checks.body.data.some((c) => c.idNumber === "9001019999087"));
});
