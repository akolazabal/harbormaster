import { expect, test } from "vitest";
import { loadPolicyConfig, loadEnv } from "../src/shared/config.js";

test("loads a valid policy config", () => {
  const c = loadPolicyConfig("config/policy.json");
  expect(c.perTxCapUsdc).toBe(10000);
  expect(c.allowlist.length).toBeGreaterThan(0);
});

test("env has sane defaults", () => {
  const e = loadEnv();
  expect(e.adapter).toBeDefined();
  expect(e.usdcContract).toMatch(/^0x[0-9a-fA-F]{40}$/);
});
