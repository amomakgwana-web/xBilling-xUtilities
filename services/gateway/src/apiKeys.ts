import { randomBytes, createHash } from "node:crypto";
import { eq } from "drizzle-orm";
import type { ApiKey, ApiKeyCreated } from "@xplatform/shared-types";
import { db } from "./db/client.js";
import { apiKeys } from "./db/schema.js";

type ApiKeyRow = typeof apiKeys.$inferSelect;

function toApiKey(row: ApiKeyRow): ApiKey {
  return {
    id: row.id,
    name: row.name,
    keyPrefix: row.keyPrefix,
    createdBy: row.createdBy,
    createdAt: row.createdAt.toISOString(),
    revokedAt: row.revokedAt?.toISOString(),
  };
}

function hashKey(key: string): string {
  return createHash("sha256").update(key).digest("hex");
}

export async function listApiKeys(): Promise<ApiKey[]> {
  const rows = await db.select().from(apiKeys);
  return rows.map(toApiKey).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

/**
 * Generates a new secret, stores only its sha256 hash, and returns the
 * plaintext exactly once — the same pattern as GitHub/Stripe tokens. There
 * is no downstream verifier wired up to actually authenticate requests with
 * these keys yet; this is key lifecycle management (issue/list/revoke), not
 * a second auth path into the platform.
 */
export async function createApiKey(name: string, createdBy: string): Promise<ApiKeyCreated> {
  const secret = randomBytes(24).toString("base64url");
  const key = `xpk_${secret}`;
  const id = `key-${randomBytes(6).toString("hex")}`;
  const rows = await db
    .insert(apiKeys)
    .values({
      id,
      name,
      keyPrefix: key.slice(0, 12),
      keyHash: hashKey(key),
      createdBy,
    })
    .returning();
  const row = rows[0];
  if (!row) throw new Error("Failed to create API key");
  return { ...toApiKey(row), key };
}

export async function revokeApiKey(id: string): Promise<ApiKey | null> {
  const rows = await db.update(apiKeys).set({ revokedAt: new Date() }).where(eq(apiKeys.id, id)).returning();
  return rows[0] ? toApiKey(rows[0]) : null;
}
