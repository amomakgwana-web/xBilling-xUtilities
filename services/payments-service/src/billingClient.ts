const BILLING_SERVICE_URL = process.env.BILLING_SERVICE_URL ?? "http://localhost:4001";

interface InvoiceLite {
  id: string;
  accountNumber: string;
  status: string;
}

/** Thin HTTP client so payments-service never touches billing-service's data directly. */
export async function applyPaymentToOldestInvoice(accountNumber: string, amount: number): Promise<void> {
  const res = await fetch(`${BILLING_SERVICE_URL}/invoices?accountNumber=${encodeURIComponent(accountNumber)}`);
  if (!res.ok) return;
  const body = (await res.json()) as { data: InvoiceLite[] };
  const target = body.data.find((i) => i.status !== "paid");
  if (!target) return;

  await fetch(`${BILLING_SERVICE_URL}/invoices/${target.id}/apply-payment`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ amount }),
  });
}
