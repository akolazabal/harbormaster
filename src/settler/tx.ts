import { encodeFunctionData, parseUnits, getAddress } from "viem";
import type { SettlementIntent, UnsignedTx } from "../shared/types.js";

export const BASE_SEPOLIA_CHAIN_ID = 84532;
export const USDC_DECIMALS = 6;

const USDC_ABI = [
  {
    type: "function",
    name: "transfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

export function buildUsdcTransfer(intent: SettlementIntent, usdcContract: `0x${string}`): UnsignedTx {
  const recipient = getAddress(intent.counterpartyAddress);
  const amount = parseUnits(intent.amount, USDC_DECIMALS);
  const data = encodeFunctionData({ abi: USDC_ABI, functionName: "transfer", args: [recipient, amount] });
  return {
    to: getAddress(usdcContract),
    data,
    value: 0n,
    chainId: BASE_SEPOLIA_CHAIN_ID,
    recipient,
    amountUsdc: intent.amount,
  };
}
