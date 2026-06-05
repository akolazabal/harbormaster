import { expect, test } from "vitest";
import { buildRecord, verifyChain } from "../src/settler/audit.js";
import type { SettlementIntent, PolicyDecision } from "../src/shared/types.js";

const intent: SettlementIntent = {
  id: "i1", shipmentId: "s", milestone: "DELIVERY", counterpartyName: "Caspian",
  counterpartyAddress: "0x1111111111111111111111111111111111111111",
  asset: "USDC", chain: "base-sepolia", amount: "100", sourceEventRaw: "{}", createdAt: "t",
};
const policy: PolicyDecision = { intentId: "i1", decision: "APPROVED_FOR_REVIEW", reasons: [], checks: [], evaluatedAt: "t" };

test("builds a genesis-linked first record", () => {
  const r = buildRecord(null, intent, policy, { status: "APPROVED", txHash: "0xabc" }, () => "t");
  expect(r.seq).toBe(0);
  expect(r.prevHash).toBe("0".repeat(64));
  expect(r.hash).toMatch(/^[0-9a-f]{64}$/);
});

test("chains records and verifies integrity", () => {
  const r0 = buildRecord(null, intent, policy, { status: "APPROVED", txHash: "0xabc" }, () => "t");
  const r1 = buildRecord(r0, intent, policy, { status: "NOT_ATTEMPTED" }, () => "t");
  expect(r1.prevHash).toBe(r0.hash);
  expect(verifyChain([r0, r1])).toBe(true);
});

test("detects tampering", () => {
  const r0 = buildRecord(null, intent, policy, { status: "APPROVED", txHash: "0xabc" }, () => "t");
  const r1 = buildRecord(r0, intent, policy, { status: "NOT_ATTEMPTED" }, () => "t");
  const tampered = { ...r1, signing: { status: "APPROVED" as const, txHash: "0xEVIL" } };
  expect(verifyChain([r0, tampered])).toBe(false);
});
