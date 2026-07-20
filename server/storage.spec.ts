// @vitest-environment node
import { describe, test, expect } from "vitest";
import { pick } from "./storage";

describe("pick (mass-assignment whitelist)", () => {
  const allowed = ["name", "balance"] as const;

  test("keeps only whitelisted keys", () => {
    const result = pick({ name: "Checking", balance: 100 }, allowed);
    expect(result).toEqual({ name: "Checking", balance: 100 });
  });

  test("strips id, userId, budgetId, and unknown keys", () => {
    const result = pick(
      {
        name: "Checking",
        id: "evil-id",
        userId: "other-user",
        budgetId: "other-budget",
        isAdmin: true,
      },
      allowed,
    );
    expect(result).toEqual({ name: "Checking" });
    expect(result).not.toHaveProperty("id");
    expect(result).not.toHaveProperty("userId");
    expect(result).not.toHaveProperty("budgetId");
    expect(result).not.toHaveProperty("isAdmin");
  });

  test("omits whitelisted keys that are undefined", () => {
    const result = pick({ name: undefined, balance: 0 }, allowed);
    expect(result).toEqual({ balance: 0 });
    expect(result).not.toHaveProperty("name");
  });

  test("returns an empty object when nothing matches", () => {
    const result = pick({ id: "x", userId: "y" }, allowed);
    expect(Object.keys(result)).toHaveLength(0);
  });
});
