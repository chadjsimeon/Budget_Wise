import bcrypt from "bcryptjs";
import { createHash, timingSafeEqual } from "crypto";
import { sql, and, eq } from "drizzle-orm";
import { db } from "./db";
import { users } from "@shared/schema";

// Hash format history:
//   1. unsalted sha256 hex (legacy rows, pre-bcrypt)
//   2. "sha256-bcrypt$" + bcrypt(sha256hex)  — legacy rows wrapped at boot so
//      they are bcrypt-protected at rest without forcing a password reset
//   3. plain bcrypt of the password — all new hashes, and what wrapped rows
//      are upgraded to on the user's next successful login
const WRAPPED_PREFIX = "sha256-bcrypt$";
const BCRYPT_ROUNDS = 12;
const LEGACY_SHA256_RE = /^[0-9a-f]{64}$/;

function sha256hex(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(
  plain: string,
  stored: string,
): Promise<{ ok: boolean; needsRehash: boolean }> {
  if (stored.startsWith(WRAPPED_PREFIX)) {
    const ok = await bcrypt.compare(sha256hex(plain), stored.slice(WRAPPED_PREFIX.length));
    return { ok, needsRehash: ok };
  }
  if (LEGACY_SHA256_RE.test(stored)) {
    // Legacy row the boot-time wrap hasn't reached yet.
    const a = Buffer.from(sha256hex(plain));
    const b = Buffer.from(stored);
    const ok = a.length === b.length && timingSafeEqual(a, b);
    return { ok, needsRehash: ok };
  }
  return { ok: await bcrypt.compare(plain, stored), needsRehash: false };
}

/**
 * One-time, idempotent boot step: wrap unsalted sha256 hashes in bcrypt so a
 * database leak no longer exposes instantly crackable hashes. Safe to re-run;
 * rows already wrapped or fully bcrypt-hashed don't match the legacy pattern.
 */
export async function wrapLegacyPasswordHashes(): Promise<void> {
  const legacy = await db
    .select({ id: users.id, password: users.password })
    .from(users)
    .where(sql`${users.password} ~ '^[0-9a-f]{64}$'`);

  for (const user of legacy) {
    const wrapped = WRAPPED_PREFIX + (await bcrypt.hash(user.password, BCRYPT_ROUNDS));
    await db
      .update(users)
      .set({ password: wrapped })
      // Guard against a concurrent login-triggered rehash of the same row.
      .where(and(eq(users.id, user.id), eq(users.password, user.password)));
  }
  if (legacy.length > 0) {
    console.log(`[auth] wrapped ${legacy.length} legacy password hash(es)`);
  }
}
