import type { DebiCheckMandate, PaymentMethod, PaymentTransaction } from "@xplatform/shared-types";

export const paymentMethods: PaymentMethod[] = [
  { id: "eft", label: "EFT / Instant EFT", provider: "SwiftPay / NPS", status: "active", txDay: 142, revDay: 248400 },
  { id: "card", label: "Visa / Mastercard", provider: "SwiftPay", status: "active", txDay: 284, revDay: 311200 },
  { id: "debi", label: "DebiCheck", provider: "SwiftPay / PASA", status: "active", txDay: 8402, revDay: 4201000 },
  { id: "gpay", label: "Google Pay", provider: "SwiftPay SDK", status: "active", txDay: 48, revDay: 72400 },
  { id: "apay", label: "Apple Pay", provider: "SwiftPay SDK", status: "active", txDay: 32, revDay: 58000 },
  { id: "samsung", label: "Samsung Pay", provider: "Samsung SDK", status: "pending", txDay: 0, revDay: 0 },
  { id: "capitec", label: "Capitec Pay", provider: "Capitec API", status: "active", txDay: 210, revDay: 189000 },
  { id: "wapay", label: "WhatsApp Pay", provider: "Meta WABA", status: "review", txDay: 0, revDay: 0 },
  { id: "ussd", label: "USSD *120#", provider: "NexCore", status: "active", txDay: 1840, revDay: 1920000 },
];

export const reconTransactions: PaymentTransaction[] = [
  { ref: "SP-PAY-7403821", accountNumber: "WE-2024-00421", consumerName: "Thandi Cele", amount: 1240.5, gateway: "SwiftPay", method: "card", status: "matched", erpStatus: "posted", createdAt: "2026-07-08T08:14:00.000Z" },
  { ref: "SP-PAY-9900312", accountNumber: "WE-2024-00421", consumerName: "Thandi Cele", amount: 890.0, gateway: "SwiftPay", method: "gpay", status: "matched", erpStatus: "posted", createdAt: "2026-07-08T08:15:00.000Z" },
  { ref: "NX-PAY-9912044", accountNumber: "WE-2024-00887", consumerName: "W. Engelbrecht", amount: 500.0, gateway: "xPayments", method: "eft", status: "suspense", erpStatus: "pending", createdAt: "2026-07-08T07:55:00.000Z" },
  { ref: "XP-PAY-3301122", accountNumber: "COJ-2024-01133", consumerName: "Sipho Dlamini", amount: 620.0, gateway: "xPayments", method: "apay", status: "matched", erpStatus: "posted", createdAt: "2026-07-07T23:41:00.000Z" },
  { ref: "CAP-PAY-1100234", accountNumber: "EKR-4401-209", consumerName: "T. Dlamini", amount: 1200.0, gateway: "CapitecPay", method: "capitec", status: "matched", erpStatus: "posted", createdAt: "2026-07-08T11:03:00.000Z" },
];

export const debiCheckMandates: DebiCheckMandate[] = [
  { id: "DC-0001", accountNumber: "WE-2024-00421", consumerName: "Thandi Cele", amount: 1240.5, collectionDay: 1, status: "active" },
  { id: "DC-0002", accountNumber: "WE-2024-00887", consumerName: "W. Engelbrecht", amount: 890.0, collectionDay: 15, status: "active" },
  { id: "DC-0003", accountNumber: "TSH-2025-00012", consumerName: "Naledi Mokoena", amount: 640.25, collectionDay: 25, status: "pending" },
];
