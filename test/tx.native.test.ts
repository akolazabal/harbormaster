import { expect, test } from "vitest";
import { parseEther } from "viem";
import { buildNativeTransfer, buildTransfer, BASE_SEPOLIA_CHAIN_ID } from "../src/settler/tx.js";
import type { SettlementIntent } from "../src/shared/types.js";

const RECIPIENT = "0x1111111111111111111111111111111111111111" as const;
const USDC_CONTRACT = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const ethIntent: SettlementIntent = {
  id: "i",
  shipmentId: "s",
  milestone: "DELIVERY",
  counterpartyName: "Testnet Broker",
  counterpartyAddress: RECIPIENT,
  asset: "ETH",
  chain: "base-sepolia",
  amount: "0.001",
  sourceEventRaw: "{}",
  createdAt: "t",
};

const usdcIntent: SettlementIntent = {
  ...ethIntent,
  asset: "USDC",
  amount: "2500.00",
};

test("buildNativeTransfer: value equals parseEther of amount", () => {
  const tx = buildNativeTransfer(ethIntent);
  expect(tx.value).toBe(parseEther("0.001"));
});

test("buildNativeTransfer: data is 0x", () => {
  const tx = buildNativeTransfer(ethIntent);
  expect(tx.data).toBe("0x");
});

test("buildNativeTransfer: chainId is Base Sepolia (84532)", () => {
  const tx = buildNativeTransfer(ethIntent);
  expect(tx.chainId).toBe(BASE_SEPOLIA_CHAIN_ID);
  expect(tx.chainId).toBe(84532);
});

test("buildNativeTransfer: to and recipient are the checksummed counterparty address", () => {
  const tx = buildNativeTransfer(ethIntent);
  expect(tx.to.toLowerCase()).toBe(RECIPIENT.toLowerCase());
  expect(tx.recipient.toLowerCase()).toBe(RECIPIENT.toLowerCase());
});

test("buildTransfer: ETH asset routes to native transfer (data 0x, value > 0)", () => {
  const tx = buildTransfer(ethIntent, USDC_CONTRACT);
  expect(tx.data).toBe("0x");
  expect(tx.value).toBeGreaterThan(0n);
});

test("buildTransfer: USDC asset routes to ERC-20 transfer (data starts with transfer selector, value 0n)", () => {
  const tx = buildTransfer(usdcIntent, USDC_CONTRACT);
  expect(tx.data.startsWith("0xa9059cbb")).toBe(true);
  expect(tx.value).toBe(0n);
});
