import { expect, test } from "vitest";
import { evaluate } from "../src/policy/policy.js";
import type { SettlementIntent, PolicyConfig, DayState } from "../src/shared/types.js";

const config: PolicyConfig = {
  allowlist: [{ name: "Caspian", address: "0x1111111111111111111111111111111111111111" }],
  denylist: ["0x000000000000000000000000000000000000dEaD"],
  perTxCapUsdc: 10000,
  dailyCapUsdc: 25000,
  allowedChains: ["base-sepolia"],
  allowedAssets: ["USDC"],
};
const day: DayState = { date: "2026-06-04", spentUsdc: 0 };

function intent(over: Partial<SettlementIntent> = {}): SettlementIntent {
  return {
    id: "i1", shipmentId: "s1", milestone: "DELIVERY", counterpartyName: "Caspian",
    counterpartyAddress: "0x1111111111111111111111111111111111111111",
    asset: "USDC", chain: "base-sepolia", amount: "2500.00",
    sourceEventRaw: "{}", createdAt: "2026-06-04T00:00:00Z", ...over,
  };
}

test("approves a clean, allowlisted, in-cap intent", () => {
  const d = evaluate(intent(), config, day);
  expect(d.decision).toBe("APPROVED_FOR_REVIEW");
  expect(d.reasons).toEqual([]);
});

test("blocks unknown (non-allowlisted) counterparty", () => {
  const d = evaluate(intent({ counterpartyAddress: "0x9999999999999999999999999999999999999999" }), config, day);
  expect(d.decision).toBe("BLOCKED");
  expect(d.reasons).toContain("allowlist_membership");
});

test("blocks denylisted address (case-insensitive)", () => {
  const d = evaluate(intent({ counterpartyAddress: "0x000000000000000000000000000000000000dead" }), config, day);
  expect(d.reasons).toContain("denylist_screen");
});

test("blocks over per-tx cap", () => {
  const d = evaluate(intent({ amount: "10000.01" }), config, day);
  expect(d.reasons).toContain("per_tx_cap");
});

test("blocks when daily cap would be exceeded", () => {
  const d = evaluate(intent({ amount: "5000" }), config, { date: "2026-06-04", spentUsdc: 22000 });
  expect(d.reasons).toContain("daily_cap");
});

test("blocks invalid amount", () => {
  const d = evaluate(intent({ amount: "not-a-number" }), config, day);
  expect(d.reasons).toContain("amount_valid");
});

test("blocks non-whitelisted chain", () => {
  const d = evaluate(intent({ chain: "ethereum" as any }), config, day);
  expect(d.reasons).toContain("chain_whitelist");
});

test("every decision includes a full check trace", () => {
  const d = evaluate(intent(), config, day);
  const names = d.checks.map((c) => c.name);
  expect(names).toEqual([
    "chain_whitelist", "asset_whitelist", "denylist_screen", "allowlist_membership",
    "amount_valid", "per_tx_cap", "daily_cap", "milestone_valid",
  ]);
});
