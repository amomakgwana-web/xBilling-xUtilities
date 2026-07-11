const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL ?? "http://localhost:4001";

interface InvoiceLite {
  id: string;
  accountNumber: string;
  status: string;
}

/**
 * Thin HTTP client so payments-service never touches billing-service's data
 * directly. Returns whether the payment was actually applied to an invoice —
 * recon uses this to decide if a suspense transaction is matchable.
 */
export async function applyPaymentToOldestInvoice(accountNumber: string, amount: number): Promise<boolean> {
  const res = await fetch(`${BILLING_SERVICE_URL}/invoices?accountNumber=${encodeURIComponent(accountNumber)}`);
  if (!res.ok) return false;
  const body = (await res.json()) as { data: InvoiceLite[] };
  const target = body.data.find((i) => i.status !== "paid");
  if (!target) return false;

  const applied = await fetch(`${BILLING_SERVICE_URL}/invoices/${target.id}/apply-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
  return applied.ok;
}
