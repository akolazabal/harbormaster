import { expect, test } from "vitest";
import { settleOne } from "../src/settler/settler.js";
import { mockAdapter } from "../src/signing/mock.js";
import type { SettlementIntent, PolicyConfig, DayState } from "../src/shared/types.js";

const config: PolicyConfig = {
  allowlist: [{ name: "Caspian", address: "0x1111111111111111111111111111111111111111" }],
  denylist: ["0x000000000000000000000000000000000000dEaD"],
  perTxCapUsdc: 10000, dailyCapUsdc: 25000,
  allowedChains: ["base-sepolia"], allowedAssets: ["USDC"],
};
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;
const day: DayState = { date: "2026-06-04", spentUsdc: 0 };
const good: SettlementIntent = {
  id: "i1", shipmentId: "s", milestone: "DELIVERY", counterpartyName: "Caspian",
  counterpartyAddress: "0x1111111111111111111111111111111111111111",
  asset: "USDC", chain: "base-sepolia", amount: "2500", sourceEventRaw: "{}", createdAt: "t",
};

test("approved + device-approved → APPROVED record, day debited", async () => {
  const { record, day: d2 } = await settleOne(good, { config, usdcContract: USDC, adapter: mockAdapter({ approve: true, txHash: "0xfeed" }) }, day, null);
  expect(record.policy.decision).toBe("APPROVED_FOR_REVIEW");
  expect(record.signing.status).toBe("APPROVED");
  expect(record.signing.txHash).toBe("0xfeed");
  expect(d2.spentUsdc).toBe(2500);
});

test("blocked by policy → no signing attempt, day unchanged", async () => {
  const bad = { ...good, counterpartyAddress: "0x9999999999999999999999999999999999999999" as const };
  const { record, day: d2 } = await settleOne(bad, { config, usdcContract: USDC, adapter: mockAdapter({ approve: true }) }, day, null);
  expect(record.policy.decision).toBe("BLOCKED");
  expect(record.signing.status).toBe("NOT_ATTEMPTED");
  expect(d2.spentUsdc).toBe(0);
});

test("device-rejected → REJECTED record, day unchanged", async () => {
  const { record, day: d2 } = await settleOne(good, { config, usdcContract: USDC, adapter: mockAdapter({ approve: false }) }, day, null);
  expect(record.signing.status).toBe("REJECTED");
  expect(d2.spentUsdc).toBe(0);
});
