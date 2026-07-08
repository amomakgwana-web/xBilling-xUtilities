import type { ComplianceScore, Integration } from "@xplatform/shared-types";

export const integrations: Integration[] = [
  { id: "conlog", name: "Conlog", category: "Metering", status: "connected", endpoint: "api.conlog.co.za/v2", description: "Prepaid STS meter management & token vending" },
  { id: "deeds", name: "Deeds Registry", category: "Compliance", status: "connected", endpoint: "ws.deeds.go.za/soap", description: "Property ownership verification via deeds.go.za" },
  { id: "macro", name: "MacroComm", category: "Comms", status: "connected", endpoint: "api.macrocomm.co.za", description: "Bulk SMS gateway — 10,000 msg/min" },
  { id: "sars", name: "SARS", category: "Compliance", status: "review", endpoint: "secure.sars.gov.za", description: "Tax clearance certificate verification" },
  { id: "treasury", name: "Treasury", category: "Finance", status: "pending", endpoint: "api.treasury.gov.za", description: "Government payment instruction & audit" },
  { id: "swiftpay", name: "SwiftPay", category: "Payments", status: "connected", endpoint: "api.swiftpay.co.za", description: "Card, EFT, DebiCheck, Google Pay, Apple Pay" },
  { id: "capitec", name: "Capitec Pay", category: "Payments", status: "connected", endpoint: "api.capitecpay.co.za", description: "Capitec bank real-time payment rail" },
  { id: "wapay", name: "WhatsApp Pay", category: "Payments", status: "review", endpoint: "api.wa.business", description: "WhatsApp Business payments via Meta" },
  { id: "samsung", name: "Samsung Pay", category: "Payments", status: "pending", endpoint: "api.samsungpay.com", description: "Samsung Pay tokenised payments" },
  { id: "hanis", name: "HANIS", category: "Identity", status: "connected", endpoint: "api.dha.gov.za", description: "SA ID biometric verification — Home Affairs" },
  { id: "credit", name: "TransUnion", category: "Credit", status: "connected", endpoint: "api.transunion.co.za", description: "Consumer credit bureau queries" },
  { id: "kafka", name: "Apache Kafka", category: "Infra", status: "connected", endpoint: "kafka.internal:9092", description: "Event streaming — metering & billing events" },
];

export const complianceScore: ComplianceScore = {
  score: 74,
  frameworks: [
    { name: "ISO27001", status: "in_progress", lastAuditedAt: "2026-03-14" },
    { name: "POPIA", status: "compliant", lastAuditedAt: "2026-05-02" },
    { name: "PCI-DSS", status: "compliant", lastAuditedAt: "2026-06-01" },
  ],
};
