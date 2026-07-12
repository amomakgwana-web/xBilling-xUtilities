import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { db } from "./db/client.js";
import { users } from "./db/schema.js";

export interface PlatformUser {
  id: string;
  email: string;
  name: string;
  persona: "citizen" | "official" | "operator";
  role: "consumer" | "admin";
  accountNumber?: string;
  municipalityId?: string;
}

export async function verifyCredentials(email: string, password: string): Promise<PlatformUser | null> {
  const rows = await db.select().from(users).where(eq(users.email, email.toLowerCase().trim())).limit(1);
  const row = rows[0];
  if (!row) {
    // Burn comparable time so login timing doesn't reveal which emails exist.
    await bcrypt.compare(password, "$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy");
    return null;
  }
  const ok = await bcrypt.compare(password, row.passwordHash);
  if (!ok) return null;
  return {
    id: row.id,
    email: row.email,
    name: row.name,
    persona: row.persona as PlatformUser["persona"],
    role: row.role as PlatformUser["role"],
    accountNumber: row.accountNumber ?? undefined,
    municipalityId: row.municipalityId ?? undefined,
  };
}
