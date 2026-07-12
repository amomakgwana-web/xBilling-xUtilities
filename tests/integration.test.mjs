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

async function patch(path, token, data) {
  const res = await fetch(`${API}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: data ? JSON.stringify(data) : undefined,
  });
  return { status: res.status, body: await res.json() };
}

async function put(path, token, data) {
  const res = await fetch(`${API}${path}`, {
    method: "PUT",
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

test("operator sees every municipality; official sees only their own", async () => {
  const { body: opAuth } = await login("operator@xplatform.co.za", "Operator!2026");
  const opList = await get("/platform/municipalities", opAuth.data.token);
  assert.equal(opList.status, 200);
  assert.ok(opList.body.data.length >= 4);

  const { body: offAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  assert.equal(offAuth.data.user.municipalityId, "Ekurhuleni");
  const offList = await get("/platform/municipalities", offAuth.data.token);
  assert.equal(offList.status, 200);
  assert.deepEqual(offList.body.data.map((m) => m.id), ["Ekurhuleni"]);
});

test("an official's book is scoped to their own municipality, even with a query override", async () => {
  const { body: offAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  const token = offAuth.data.token;

  const accounts = await get("/billing/accounts?municipality=Tshwane", token);
  assert.equal(accounts.status, 200);
  for (const a of accounts.body.data) assert.equal(a.municipality, "Ekurhuleni");

  const meters = await get("/metering/meters?municipality=CoJ", token);
  assert.equal(meters.status, 200);
  for (const m of meters.body.data) assert.equal(m.municipality, "Ekurhuleni");

  // Invoices don't carry municipality directly (resolved via account), which
  // is exactly why this route was the one gap Phase 2's scoping pass missed
  // — an official could read invoices for any citizen on the platform.
  const ekurhuleniAccounts = new Set(accounts.body.data.map((a) => a.accountNumber));
  const invoices = await get("/billing/invoices", token);
  assert.equal(invoices.status, 200);
  assert.ok(invoices.body.data.length > 0, "fixture must have at least one invoice in Ekurhuleni to make this test meaningful");
  for (const inv of invoices.body.data) assert.ok(ekurhuleniAccounts.has(inv.accountNumber));
});

test("an operator's book is unrestricted across municipalities", async () => {
  const { body: opAuth } = await login("operator@xplatform.co.za", "Operator!2026");
  const accounts = await get("/billing/accounts", opAuth.data.token);
  const municipalitiesSeen = new Set(accounts.body.data.map((a) => a.municipality));
  assert.ok(municipalitiesSeen.size > 1, "operator should see accounts across more than one municipality");
});

test("an official may edit their own municipality's contact details, not its branding or another's", async () => {
  const { body: offAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  const token = offAuth.data.token;

  const ok = await patch("/platform/municipalities/Ekurhuleni", token, { contactPhone: "+27 11 000 1111" });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.data.contactPhone, "+27 11 000 1111");

  const otherMunicipality = await patch("/platform/municipalities/Tshwane", token, { contactPhone: "+27 12 000 0000" });
  assert.equal(otherMunicipality.status, 403);

  // Only forbidden fields in the body — must be rejected cleanly (400), not
  // crash the gateway (this exact request took the whole process down
  // before the empty-patch guard was added).
  const onlyForbiddenFields = await patch("/platform/municipalities/Ekurhuleni", token, { brandColor: "#000000" });
  assert.equal(onlyForbiddenFields.status, 400);

  const stillUp = await get("/platform/municipalities", token);
  assert.equal(stillUp.status, 200, "gateway must still be responding after a rejected patch");
});

test("banking details: citizen may save and read only their own, always masked", async () => {
  const { body: auth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const token = auth.data.token;

  const saved = await put("/billing/banking/WE-2024-00421", token, {
    bankName: "Capitec",
    accountHolder: "Thandi Cele",
    accountNumber: "4070123456",
    branchCode: "470010",
    accountType: "cheque",
    debitDay: 1,
  });
  assert.equal(saved.status, 200);
  assert.equal(saved.body.data.maskedAccountNumber, "••••3456");
  assert.ok(!JSON.stringify(saved.body.data).includes("4070123456"), "raw bank account number must never round-trip in the response");

  // Editing without a new number keeps the one already on file.
  const edited = await put("/billing/banking/WE-2024-00421", token, {
    bankName: "Capitec",
    accountHolder: "Thandi Cele",
    branchCode: "470011",
    accountType: "cheque",
    debitDay: 5,
  });
  assert.equal(edited.status, 200);
  assert.equal(edited.body.data.maskedAccountNumber, "••••3456");
  assert.equal(edited.body.data.branchCode, "470011");

  const foreign = await put("/billing/banking/TSH-2025-00012", token, {
    bankName: "FNB",
    accountHolder: "Someone Else",
    accountNumber: "1234567890",
    branchCode: "250655",
    accountType: "savings",
    debitDay: 1,
  });
  assert.equal(foreign.status, 403);
});

test("payment plans: citizen sets up an instalment plan and cannot double up", async () => {
  const { body: auth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const token = auth.data.token;

  const account = await get("/billing/accounts/WE-2024-00421", token);
  assert.ok(account.body.data.balance > 0, "fixture account must carry a balance for this test to be meaningful");

  // Idempotent against a persistent database: an earlier run against this
  // same fixture account may already have an active plan on file, which
  // the one-active-plan-per-account rule should reject just as validly as
  // the explicit duplicate attempt below.
  const attempt = await post("/payments/plans", token, {
    accountNumber: "WE-2024-00421",
    consumerName: "Thandi Cele",
    totalAmount: account.body.data.balance,
    installments: 6,
  });
  assert.ok([201, 409].includes(attempt.status));
  if (attempt.status === 201) {
    assert.equal(attempt.body.data.status, "active");
    assert.ok(Math.abs(attempt.body.data.installmentAmount * 6 - account.body.data.balance) < 0.02);
  }

  const duplicate = await post("/payments/plans", token, {
    accountNumber: "WE-2024-00421",
    consumerName: "Thandi Cele",
    totalAmount: account.body.data.balance,
    installments: 3,
  });
  assert.equal(duplicate.status, 409);

  const { body: opAuth } = await login("operator@xplatform.co.za", "Operator!2026");
  const allPlans = await get("/payments/plans", opAuth.data.token);
  assert.equal(allPlans.status, 200);
  assert.ok(allPlans.body.data.some((p) => p.accountNumber === "WE-2024-00421" && p.status === "active"));
});

test("indigent subsidy: tiered eligibility is computed server-side, not trusted from the client", async () => {
  const { body: auth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const token = auth.data.token;

  const lowIncome = await post("/billing/subsidy/apply", token, {
    accountNumber: "WE-2024-00421",
    householdIncome: 3000,
    householdSize: 4,
  });
  assert.equal(lowIncome.status, 201);
  assert.equal(lowIncome.body.data.status, "approved");
  assert.equal(lowIncome.body.data.subsidyPercent, 100);

  const midIncome = await post("/billing/subsidy/apply", token, {
    accountNumber: "WE-2024-00421",
    householdIncome: 6000,
    householdSize: 3,
  });
  assert.equal(midIncome.body.data.subsidyPercent, 25);

  const tooHigh = await post("/billing/subsidy/apply", token, {
    accountNumber: "WE-2024-00421",
    householdIncome: 20000,
    householdSize: 2,
  });
  assert.equal(tooHigh.body.data.status, "rejected");

  const foreign = await post("/billing/subsidy/apply", token, { accountNumber: "TSH-2025-00012", householdIncome: 1000, householdSize: 1 });
  assert.equal(foreign.status, 403);
});

test("disputes: citizen raises against their own invoice; official in the same municipality resolves it", async () => {
  const { body: citizenAuth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const citizenToken = citizenAuth.data.token;

  const foreignInvoice = await post("/billing/disputes", citizenToken, {
    accountNumber: "WE-2024-00421",
    invoiceId: "does-not-exist",
    reason: "Incorrect meter reading",
    description: "Test",
  });
  assert.equal(foreignInvoice.status, 404);

  const raised = await post("/billing/disputes", citizenToken, {
    accountNumber: "WE-2024-00421",
    invoiceId: "inv-1001",
    reason: "Incorrect meter reading",
    description: "Meter reading looks too high for this period",
  });
  assert.equal(raised.status, 201);
  assert.equal(raised.body.data.status, "open");

  const consumerResolveAttempt = await post(`/billing/disputes/${raised.body.data.id}/resolve`, citizenToken, {
    status: "resolved",
    resolutionNote: "n/a",
  });
  assert.equal(consumerResolveAttempt.status, 403);

  const { body: officialAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  const resolved = await post(`/billing/disputes/${raised.body.data.id}/resolve`, officialAuth.data.token, {
    status: "resolved",
    resolutionNote: "Reading verified correct against the meter log.",
  });
  assert.equal(resolved.status, 200);
  assert.equal(resolved.body.data.status, "resolved");

  const citizenView = await get("/billing/disputes?accountNumber=WE-2024-00421", citizenToken);
  const seen = citizenView.body.data.find((d) => d.id === raised.body.data.id);
  assert.equal(seen.status, "resolved");
  assert.equal(seen.resolutionNote, "Reading verified correct against the meter log.");
});

test("tariffs: everyone can read the book, only operators may schedule a rate change", async () => {
  const { body: citizenAuth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const readAsCitizen = await get("/billing/tariffs", citizenAuth.data.token);
  assert.equal(readAsCitizen.status, 200);
  assert.ok(readAsCitizen.body.data.length > 0);

  const { body: officialAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  const officialAttempt = await post("/billing/tariffs", officialAuth.data.token, {
    code: "RES-STD",
    description: "Residential standard",
    electricityPerKwh: 2.5,
    waterPerKl: 29,
    refuseMonthly: 215,
    sewerMonthly: 190,
    vatRate: 0.15,
    validFrom: "2099-01-01",
  });
  assert.equal(officialAttempt.status, 403);

  const { body: opAuth } = await login("operator@xplatform.co.za", "Operator!2026");
  const period = `test-tariff-${Date.now()}`;
  const created = await post("/billing/tariffs", opAuth.data.token, {
    code: period,
    description: "Test tariff",
    electricityPerKwh: 3,
    waterPerKl: 30,
    refuseMonthly: 200,
    sewerMonthly: 180,
    vatRate: 0.15,
    validFrom: "2099-01-01",
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.data.code, period);

  const list = await get("/billing/tariffs", opAuth.data.token);
  assert.ok(list.body.data.some((t) => t.code === period));
});

test("legal/handover: staff may escalate and pull back an account, scoped to the official's municipality", async () => {
  const { body: officialAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  const officialToken = officialAuth.data.token;

  const { body: citizenAuth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const citizenAttempt = await post("/billing/accounts/WE-2024-00421/handover", citizenAuth.data.token);
  assert.equal(citizenAttempt.status, 403);

  const foreignAccount = await post("/billing/accounts/TSH-2025-00012/handover", officialToken);
  assert.equal(foreignAccount.status, 403);

  const escalated = await post("/billing/accounts/WE-2024-00421/handover", officialToken);
  assert.equal(escalated.status, 200);
  assert.equal(escalated.body.data.status, "handover");

  const listed = await get("/billing/accounts?status=handover", officialToken);
  assert.ok(listed.body.data.some((a) => a.accountNumber === "WE-2024-00421"));

  const pulledBack = await post("/billing/accounts/WE-2024-00421/handover", officialToken);
  assert.equal(pulledBack.status, 200);
  assert.equal(pulledBack.body.data.status, "overdue");
});

test("API keys: operator-only lifecycle, secret shown once, officials forbidden", async () => {
  const { body: officialAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  const officialAttempt = await get("/platform/api-keys", officialAuth.data.token);
  assert.equal(officialAttempt.status, 403);

  const { body: opAuth } = await login("operator@xplatform.co.za", "Operator!2026");
  const opToken = opAuth.data.token;

  const created = await post("/platform/api-keys", opToken, { name: `test-key-${Date.now()}` });
  assert.equal(created.status, 201);
  assert.ok(created.body.data.key.startsWith("xpk_"));
  assert.equal(created.body.data.keyPrefix, created.body.data.key.slice(0, 12));

  const list = await get("/platform/api-keys", opToken);
  assert.equal(list.status, 200);
  const listed = list.body.data.find((k) => k.id === created.body.data.id);
  assert.ok(listed);
  assert.equal(listed.key, undefined, "the plaintext secret must never appear in the list response");

  const revoked = await post(`/platform/api-keys/${created.body.data.id}/revoke`, opToken);
  assert.equal(revoked.status, 200);
  assert.ok(revoked.body.data.revokedAt);
});

test("electricity: vending a prepaid token persists it to history, visible to the account holder and staff", async () => {
  const { body: citizenAuth } = await login("thandi.cele@example.co.za", "Citizen!2026");
  const citizenToken = citizenAuth.data.token;

  const vend = await post("/metering/meters/vend-token", citizenToken, { serial: "MTR-WE-004421", amount: 50 });
  assert.equal(vend.status, 200);

  const ownHistory = await get("/metering/meters/vended-tokens", citizenToken);
  assert.equal(ownHistory.status, 200);
  assert.ok(ownHistory.body.data.some((t) => t.token === vend.body.data.token));
  assert.ok(ownHistory.body.data.every((t) => t.accountNumber === "WE-2024-00421"));

  const { body: officialAuth } = await login("official@ekurhuleni.gov.za", "Official!2026");
  const staffHistory = await get("/metering/meters/vended-tokens", officialAuth.data.token);
  assert.equal(staffHistory.status, 200);
  assert.ok(staffHistory.body.data.some((t) => t.token === vend.body.data.token));
});
