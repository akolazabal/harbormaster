import { expect, test } from "vitest";
import { buildUsdcTransfer, BASE_SEPOLIA_CHAIN_ID } from "../src/settler/tx.js";
import type { SettlementIntent } from "../src/shared/types.js";

const intent: SettlementIntent = {
  id: "i", shipmentId: "s", milestone: "DELIVERY", counterpartyName: "Caspian",
  counterpartyAddress: "0x1111111111111111111111111111111111111111",
  asset: "USDC", chain: "base-sepolia", amount: "2500.00", sourceEventRaw: "{}", createdAt: "t",
};
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

test("encodes an ERC-20 transfer with the right selector and chain", () => {
  const tx = buildUsdcTransfer(intent, USDC);
  expect(tx.to.toLowerCase()).toBe(USDC.toLowerCase());
  expect(tx.value).toBe(0n);
  expect(tx.chainId).toBe(BASE_SEPOLIA_CHAIN_ID);
  expect(tx.data.startsWith("0xa9059cbb")).toBe(true); // transfer(address,uint256)
  expect(tx.recipient.toLowerCase()).toBe(intent.counterpartyAddress.toLowerCase());
  expect(tx.amountUsdc).toBe("2500.00");
});

test("amount uses 6 decimals (USDC)", () => {
  const tx = buildUsdcTransfer({ ...intent, amount: "1" }, USDC);
  // 1 USDC = 1_000_000 base units = 0x0f4240, right-padded in the 32-byte word
  expect(tx.data.endsWith("00000000000000000000000000000000000000000000000000000000000f4240")).toBe(true);
});
