import { expect, test } from "vitest";
import type { SettlementIntent } from "../src/shared/types.js";

test("SettlementIntent shape compiles and is constructible", () => {
  const i: SettlementIntent = {
    id: "x", shipmentId: "s", milestone: "DELIVERY", counterpartyName: "n",
    counterpartyAddress: "0x1111111111111111111111111111111111111111",
    asset: "USDC", chain: "base-sepolia", amount: "1.00",
    sourceEventRaw: "{}", createdAt: new Date().toISOString(),
  };
  expect(i.asset).toBe("USDC");
});
