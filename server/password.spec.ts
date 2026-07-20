// @vitest-environment node
import { describe, test, expect } from "vitest";
import { createHash } from "crypto";
import bcrypt from "bcryptjs";
import { hashPassword, verifyPassword } from "./password";

const sha256hex = (pw: string) => createHash("sha256").update(pw).digest("hex");

describe("verifyPassword", () => {
  test("accepts a correct password against a plain bcrypt hash", async () => {
    // Given: a password stored as plain bcrypt (the new format)
    const stored = await hashPassword("correct horse battery");

    // When/Then: the right password verifies and needs no rehash
    const { ok, needsRehash } = await verifyPassword("correct horse battery", stored);
    expect(ok).toBe(true);
    expect(needsRehash).toBe(false);
  });

  test("rejects a wrong password against a plain bcrypt hash", async () => {
    const stored = await hashPassword("correct horse battery");
    const { ok } = await verifyPassword("wrong password here", stored);
    expect(ok).toBe(false);
  });

  test("accepts a correct password against a wrapped legacy hash and flags rehash", async () => {
    // Given: a legacy sha256 hash wrapped in bcrypt (the at-rest format after boot)
    const wrapped = "sha256-bcrypt$" + (await bcrypt.hash(sha256hex("legacy pw 123"), 12));

    // When/Then: it verifies and asks to be upgraded to plain bcrypt
    const { ok, needsRehash } = await verifyPassword("legacy pw 123", wrapped);
    expect(ok).toBe(true);
    expect(needsRehash).toBe(true);
  });

  test("rejects a wrong password against a wrapped legacy hash", async () => {
    const wrapped = "sha256-bcrypt$" + (await bcrypt.hash(sha256hex("legacy pw 123"), 12));
    const { ok } = await verifyPassword("not the password", wrapped);
    expect(ok).toBe(false);
  });

  test("accepts a correct password against a raw legacy sha256 hash and flags rehash", async () => {
    // Given: a not-yet-wrapped legacy row (raw 64-hex sha256)
    const stored = sha256hex("raw legacy pw");

    const { ok, needsRehash } = await verifyPassword("raw legacy pw", stored);
    expect(ok).toBe(true);
    expect(needsRehash).toBe(true);
  });

  test("rejects a wrong password against a raw legacy sha256 hash", async () => {
    const stored = sha256hex("raw legacy pw");
    const { ok } = await verifyPassword("different pw", stored);
    expect(ok).toBe(false);
  });
});

describe("hashPassword", () => {
  test("produces a verifiable bcrypt hash that differs per call (salted)", async () => {
    const a = await hashPassword("same password");
    const b = await hashPassword("same password");
    expect(a).not.toBe(b);
    expect(a.startsWith("$2")).toBe(true);
    expect(await bcrypt.compare("same password", a)).toBe(true);
  });
});
