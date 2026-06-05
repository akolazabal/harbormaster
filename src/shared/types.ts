export type Milestone = "ORIGIN_LOAD" | "CASPIAN_CROSSING" | "DELIVERY";

export type SettlementIntent = {
  id: string;
  shipmentId: string;
  milestone: Milestone;
  counterpartyName: string;
  counterpartyAddress: `0x${string}`;
  asset: "USDC" | "ETH";
  chain: "base-sepolia";
  amount: string; // decimal USDC, e.g. "2500.00"
  sourceEventRaw: string; // untrusted original, retained for audit
  createdAt: string; // ISO 8601
};

export type PolicyCheck = { name: string; passed: boolean; detail: string };

export type PolicyDecision = {
  intentId: string;
  decision: "APPROVED_FOR_REVIEW" | "BLOCKED";
  reasons: string[];
  checks: PolicyCheck[];
  evaluatedAt: string;
};

export type PolicyConfig = {
  allowlist: { name: string; address: `0x${string}` }[];
  denylist: `0x${string}`[];
  perTxCapUsdc: number;
  dailyCapUsdc: number;
  allowedChains: ["base-sepolia"];
  allowedAssets: ("USDC" | "ETH")[];
};

export type DayState = { date: string; spentUsdc: number };

export type UnsignedTx = {
  to: `0x${string}`; // USDC contract
  data: `0x${string}`; // encoded transfer(recipient, amount)
  value: bigint; // 0n for ERC-20
  chainId: number; // 84532 = Base Sepolia
  recipient: `0x${string}`; // surfaced for display/audit
  amountUsdc: string;
};

export type SigningResult =
  | { status: "APPROVED"; txHash: `0x${string}` }
  | { status: "REJECTED" };

export type AuditRecord = {
  seq: number;
  prevHash: string;
  intent: SettlementIntent;
  policy: PolicyDecision;
  signing: { status: "APPROVED" | "REJECTED" | "NOT_ATTEMPTED"; txHash?: string };
  hash: string;
  recordedAt: string;
};
