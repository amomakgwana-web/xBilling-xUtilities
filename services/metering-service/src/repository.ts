import { and, desc, eq } from "drizzle-orm";
import type { Meter, MeterFault, MeterType, Municipality } from "@xplatform/shared-types";
import { db } from "./db/client.js";
import { meterFaults, meterReadings, meters } from "./db/schema.js";

type MeterRow = typeof meters.$inferSelect;
type MeterFaultRow = typeof meterFaults.$inferSelect;

function toMeter(row: MeterRow): Meter {
  return {
    id: row.id,
    serial: row.serial,
    accountNumber: row.accountNumber,
    municipality: row.municipality as Municipality,
    type: row.type as MeterType,
    lastReading: Number(row.lastReading),
    lastReadingAt: row.lastReadingAt.toISOString(),
    status: row.status as Meter["status"],
  };
}

function toFault(row: MeterFaultRow): MeterFault {
  return {
    id: row.id,
    meterId: row.meterId,
    serial: row.serial,
    description: row.description,
    severity: row.severity as MeterFault["severity"],
    status: row.status as MeterFault["status"],
    reportedAt: row.reportedAt.toISOString(),
  };
}

export async function listMeters(filters: { municipality?: string; status?: string }): Promise<Meter[]> {
  const conditions = [];
  if (filters.municipality) conditions.push(eq(meters.municipality, filters.municipality));
  if (filters.status) conditions.push(eq(meters.status, filters.status));
  const rows = await db
    .select()
    .from(meters)
    .where(conditions.length ? and(...conditions) : undefined);
  return rows.map(toMeter);
}

export async function getMeterBySerial(serial: string): Promise<Meter | null> {
  const rows = await db.select().from(meters).where(eq(meters.serial, serial)).limit(1);
  return rows[0] ? toMeter(rows[0]) : null;
}

export async function updateMeterReading(serial: string, reading: number, readAt: string): Promise<Meter | null> {
  const rows = await db
    .update(meters)
    .set({ lastReading: String(reading), lastReadingAt: new Date(readAt) })
    .where(eq(meters.serial, serial))
    .returning();
  if (!rows[0]) return null;
  // Keep the full history — consumption billing reads the last two entries.
  await db.insert(meterReadings).values({
    meterId: rows[0].id,
    serial,
    reading: String(reading),
    readAt: new Date(readAt),
  });
  return toMeter(rows[0]);
}

export interface MeterConsumption {
  serial: string;
  accountNumber: string;
  municipality: string;
  type: MeterType;
  /** Units used between the two most recent readings (kWh or kl). */
  consumption: number;
  periodStart: string | null;
  periodEnd: string | null;
}

/**
 * Consumption per meter derived from the reading history: the delta between
 * the two most recent readings (0 when fewer than two readings exist —
 * nothing measurable to bill yet).
 */
export async function consumptionByMunicipality(municipality?: string): Promise<MeterConsumption[]> {
  const allMeters = await listMeters({ municipality });
  const result: MeterConsumption[] = [];
  for (const meter of allMeters) {
    const last2 = await db
      .select()
      .from(meterReadings)
      .where(eq(meterReadings.serial, meter.serial))
      .orderBy(desc(meterReadings.id))
      .limit(2);
    const [latest, previous] = last2;
    const consumption =
      latest && previous ? Math.max(0, Number(latest.reading) - Number(previous.reading)) : 0;
    result.push({
      serial: meter.serial,
      accountNumber: meter.accountNumber,
      municipality: meter.municipality,
      type: meter.type,
      consumption,
      periodStart: previous ? previous.readAt.toISOString() : null,
      periodEnd: latest ? latest.readAt.toISOString() : null,
    });
  }
  return result;
}

export async function setMeterStatus(id: string, status: string): Promise<void> {
  await db.update(meters).set({ status }).where(eq(meters.id, id));
}

export async function listFaults(): Promise<MeterFault[]> {
  const rows = await db.select().from(meterFaults);
  return rows.map(toFault);
}

let faultSeq = 100;
export function nextFaultId(): string {
  return `flt-${faultSeq++}`;
}

export async function createFault(input: {
  serial: string;
  description: string;
  severity: MeterFault["severity"];
}): Promise<MeterFault | null> {
  const meter = await getMeterBySerial(input.serial);
  if (!meter) return null;

  const fault: MeterFault = {
    id: nextFaultId(),
    meterId: meter.id,
    serial: meter.serial,
    description: input.description,
    severity: input.severity,
    status: "reported",
    reportedAt: new Date().toISOString(),
  };
  await db.insert(meterFaults).values({
    id: fault.id,
    meterId: fault.meterId,
    serial: fault.serial,
    description: fault.description,
    severity: fault.severity,
    status: fault.status,
    reportedAt: new Date(fault.reportedAt),
  });
  await setMeterStatus(meter.id, "fault");
  return fault;
}

export async function dispatchFault(id: string): Promise<MeterFault | null> {
  const rows = await db.update(meterFaults).set({ status: "dispatched" }).where(eq(meterFaults.id, id)).returning();
  return rows[0] ? toFault(rows[0]) : null;
}

export async function resolveFault(id: string): Promise<MeterFault | null> {
  const rows = await db.update(meterFaults).set({ status: "resolved" }).where(eq(meterFaults.id, id)).returning();
  if (!rows[0]) return null;
  await setMeterStatus(rows[0].meterId, "normal");
  return toFault(rows[0]);
}
