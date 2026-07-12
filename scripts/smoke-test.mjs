#!/usr/bin/env node
// Post-deploy sanity check against a live gateway URL. Read-only by default
// — it proves the deployment is wired correctly (services reachable, auth
// works, each service answers through the gateway for both a citizen and an
// operator identity) without mutating any data on what might be a real
// deployment. Pass --with-write to additionally exercise one real
// cross-service write (a small payment) the same way the integration
// suite's "operator: full access + payment settles cross-service" test does.
//
// Usage:
//   API_BASE_URL=https://gateway-production-xxxx.up.railway.app/api node scripts/smoke-test.mjs
//   API_BASE_URL=... node scripts/smoke-test.mjs --with-write
//
// Exits non-zero on any failure, with a summary of what passed/failed.

const API = process.env.API_BASE_URL ?? "http://localhost:4000/api";
const WITH_WRITE = process.argv.includes("--with-write");

// Demo identities seeded by db/002_seed.sql + db/004_seed_real.sql. Override
// via env if this deploy's Supabase project has different seed data.
const CITIZEN_EMAIL = process.env.SMOKE_CITIZEN_EMAIL ?? "thandi.cele@example.co.za";
const CITIZEN_PASSWORD = process.env.SMOKE_CITIZEN_PASSWORD ?? "Citizen!2026";
const CITIZEN_ACCOUNT = process.env.SMOKE_CITIZEN_ACCOUNT ?? "WE-2024-00421";
const OPERATOR_EMAIL = process.env.SMOKE_OPERATOR_EMAIL ?? "operator@xplatform.co.za";
const OPERATOR_PASSWORD = process.env.SMOKE_OPERATOR_PASSWORD ?? "Operator!2026";

const results = [];

async function check(name, fn) {
  const started = Date.now();
  try {
    await fn();
    results.push({ name, ok: true, ms: Date.now() - started });
    console.log(`  ok   ${name} (${Date.now() - started}ms)`);
  } catch (err) {
    results.push({ name, ok: false, ms: Date.now() - started, error: err.message });
    console.log(`  FAIL ${name}: ${err.message}`);
  }
}

async function req(path, { method = "GET", token, body } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await res.json().catch(() => null);
  return { status: res.status, body: json };
}

function assert(cond, message) {
  if (!cond) throw new Error(message);
}

async function login(email, password) {
  const { status, body } = await req("/auth/login", { method: "POST", body: { email, password } });
  assert(status === 200, `login failed for ${email}: HTTP ${status} ${JSON.stringify(body)}`);
  assert(body?.data?.token, "login response missing token");
  return body.data.token;
}

console.log(`Smoke-testing ${API}${WITH_WRITE ? " (with write check)" : ""}\n`);

let citizenToken, operatorToken;

await check("platform status reports all backend services live", async () => {
  const { status, body } = await req("/platform/status");
  assert(status === 200, `HTTP ${status}`);
  const services = body?.data?.services ?? [];
  assert(services.length >= 5, `expected at least 5 services reported, got ${services.length}`);
  const down = services.filter((s) => s.status !== "live");
  assert(down.length === 0, `services not live: ${down.map((s) => `${s.name}=${s.status}`).join(", ")}`);
});

await check("unauthenticated request is rejected", async () => {
  const { status } = await req("/billing/accounts");
  assert(status === 401, `expected 401, got ${status}`);
});

await check("citizen login issues an account-bound token", async () => {
  citizenToken = await login(CITIZEN_EMAIL, CITIZEN_PASSWORD);
});

await check("citizen can read their own account", async () => {
  const { status, body } = await req(`/billing/accounts/${CITIZEN_ACCOUNT}`, { token: citizenToken });
  assert(status === 200, `HTTP ${status}`);
  assert(body?.data?.accountNumber === CITIZEN_ACCOUNT, "account number mismatch");
});

await check("citizen is forbidden from staff-only routes", async () => {
  const { status } = await req("/compliance/score", { token: citizenToken });
  assert(status === 403, `expected 403, got ${status}`);
});

await check("operator login issues a platform-wide token", async () => {
  operatorToken = await login(OPERATOR_EMAIL, OPERATOR_PASSWORD);
});

await check("operator can reach billing", async () => {
  const { status, body } = await req("/billing/accounts", { token: operatorToken });
  assert(status === 200, `HTTP ${status}`);
  assert(Array.isArray(body?.data) && body.data.length > 0, "expected at least one account");
});

await check("operator can reach payments", async () => {
  const { status } = await req("/payments/methods", { token: operatorToken });
  assert(status === 200, `HTTP ${status}`);
});

await check("operator can reach metering", async () => {
  const { status } = await req("/metering/meters", { token: operatorToken });
  assert(status === 200, `HTTP ${status}`);
});

await check("operator can reach comms", async () => {
  const { status } = await req("/comms/campaigns", { token: operatorToken });
  assert(status === 200, `HTTP ${status}`);
});

await check("operator can reach compliance", async () => {
  const { status } = await req("/compliance/score", { token: operatorToken });
  assert(status === 200, `HTTP ${status}`);
});

await check("operator can reach platform municipalities", async () => {
  const { status, body } = await req("/platform/municipalities", { token: operatorToken });
  assert(status === 200, `HTTP ${status}`);
  assert(Array.isArray(body?.data) && body.data.length > 0, "expected at least one municipality");
});

if (WITH_WRITE) {
  await check("a payment settles cross-service (billing balance decreases)", async () => {
    const before = await req(`/billing/accounts/${CITIZEN_ACCOUNT}`, { token: operatorToken });
    const pay = await req("/payments/initiate", {
      method: "POST",
      token: operatorToken,
      body: { accountNumber: CITIZEN_ACCOUNT, amount: 1, method: "card", consumerName: "Smoke Test" },
    });
    assert(pay.status === 202, `payment initiate: HTTP ${pay.status}`);
    await new Promise((r) => setTimeout(r, 800));
    const after = await req(`/billing/accounts/${CITIZEN_ACCOUNT}`, { token: operatorToken });
    assert(after.body.data.balance <= before.body.data.balance - 0.99, "balance did not decrease after payment settled");
  });
}

const failed = results.filter((r) => !r.ok);
console.log(`\n${results.length - failed.length}/${results.length} checks passed.`);
if (failed.length > 0) {
  console.log("\nFailed checks:");
  for (const f of failed) console.log(`  - ${f.name}: ${f.error}`);
  process.exit(1);
}
