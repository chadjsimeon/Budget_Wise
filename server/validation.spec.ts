// @vitest-environment node
import { describe, test, expect } from "vitest";
import {
  registerSchema,
  loginSchema,
  upsertAssignmentSchema,
  parseBody,
} from "./validation";

describe("registerSchema", () => {
  test("accepts a valid email and 8+ char password, normalizing the email", () => {
    const result = parseBody(registerSchema, { email: "  User@Example.COM ", password: "goodpass1" });
    expect(result.error).toBeUndefined();
    expect(result.data?.email).toBe("user@example.com");
  });

  test("rejects a password shorter than 8 characters", () => {
    const result = parseBody(registerSchema, { email: "user@example.com", password: "short12" });
    expect(result.data).toBeUndefined();
    expect(result.error).toMatch(/at least 8/i);
  });

  test("rejects an invalid email", () => {
    const result = parseBody(registerSchema, { email: "not-an-email", password: "goodpass1" });
    expect(result.error).toMatch(/invalid email/i);
  });

  test("rejects a missing password", () => {
    const result = parseBody(registerSchema, { email: "user@example.com" });
    expect(result.error).toBeDefined();
  });
});

describe("loginSchema", () => {
  test("accepts any non-empty password (length rules are for registration only)", () => {
    const result = parseBody(loginSchema, { email: "user@example.com", password: "x" });
    expect(result.error).toBeUndefined();
  });

  test("rejects an empty password", () => {
    const result = parseBody(loginSchema, { email: "user@example.com", password: "" });
    expect(result.error).toBeDefined();
  });
});

describe("upsertAssignmentSchema", () => {
  test("accepts a well-formed assignment", () => {
    const result = parseBody(upsertAssignmentSchema, {
      budgetId: "b1",
      monthKey: "2026-07",
      categoryId: "c1",
      amount: 200,
    });
    expect(result.error).toBeUndefined();
  });

  test("rejects a malformed month key", () => {
    const result = parseBody(upsertAssignmentSchema, {
      budgetId: "b1",
      monthKey: "July",
      categoryId: "c1",
      amount: 200,
    });
    expect(result.error).toMatch(/month key/i);
  });

  test("rejects a non-numeric amount", () => {
    const result = parseBody(upsertAssignmentSchema, {
      budgetId: "b1",
      monthKey: "2026-07",
      categoryId: "c1",
      amount: "lots",
    });
    expect(result.error).toBeDefined();
  });
});
