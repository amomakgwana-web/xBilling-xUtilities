import type { Meter, MeterFault } from "@xplatform/shared-types";

export const meters: Meter[] = [
  { id: "mtr-1", serial: "MTR-TSH-007812", accountNumber: "TSH-2025-00012", municipality: "Tshwane", type: "prepaid_electricity", lastReading: 4820, lastReadingAt: "2026-07-08T06:00:00.000Z", status: "alert" },
  { id: "mtr-2", serial: "MTR-WE-004421", accountNumber: "WE-2024-00421", municipality: "Ekurhuleni", type: "conventional_electricity", lastReading: 12040, lastReadingAt: "2026-07-08T06:00:00.000Z", status: "normal" },
  { id: "mtr-3", serial: "MTR-WE-004887", accountNumber: "WE-2024-00887", municipality: "Ekurhuleni", type: "water", lastReading: 812, lastReadingAt: "2026-07-08T06:00:00.000Z", status: "fault" },
  { id: "mtr-4", serial: "MTR-ETH-009566", accountNumber: "ETH-2024-00566", municipality: "eThekwini", type: "water", lastReading: 240, lastReadingAt: "2026-07-08T06:00:00.000Z", status: "normal" },
  { id: "mtr-5", serial: "MTR-COJ-011133", accountNumber: "COJ-2024-01133", municipality: "CoJ", type: "prepaid_electricity", lastReading: 3320, lastReadingAt: "2026-07-08T06:00:00.000Z", status: "normal" },
];

export const meterFaults: MeterFault[] = [
  { id: "flt-1", meterId: "mtr-1", serial: "MTR-TSH-007812", description: "520 kWh anomaly flagged — possible tamper", severity: "medium", status: "dispatched", reportedAt: "2026-07-08T08:15:00.000Z" },
  { id: "flt-2", meterId: "mtr-3", serial: "MTR-WE-004887", description: "Meter offline — no readings for 48h", severity: "high", status: "dispatched", reportedAt: "2026-07-08T08:55:00.000Z" },
];

let faultSeq = 3;
export function nextFaultId(): string {
  return `flt-${faultSeq++}`;
}
