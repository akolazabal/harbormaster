import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SettlementIntent, Milestone } from "../shared/types.js";

export class InvalidEventError extends Error {}

export function parseEvent(raw: string, asset: SettlementIntent["asset"] = "USDC"): SettlementIntent {
  let obj: Record<string, unknown>;
  try {
    obj = JSON.parse(raw);
  } catch {
    throw new InvalidEventError("event is not valid JSON");
  }

  const counterpartyAddress = str(obj.counterpartyAddress, "counterpartyAddress");
  if (!/^0x[0-9a-fA-F]{40}$/.test(counterpartyAddress)) {
    throw new InvalidEventError("counterpartyAddress is not a 20-byte hex address");
  }

  return {
    id: str(obj.id, "id"),
    shipmentId: str(obj.shipmentId, "shipmentId"),
    milestone: str(obj.milestone, "milestone") as Milestone,
    counterpartyName: str(obj.counterpartyName, "counterpartyName"),
    counterpartyAddress: counterpartyAddress as `0x${string}`,
    asset, // set by caller; untrusted input cannot choose the asset
    chain: "base-sepolia", // hardcoded: untrusted input cannot choose the chain
    amount: str(obj.amount, "amount"),
    sourceEventRaw: raw, // retain full untrusted original for audit
    createdAt: new Date().toISOString(),
  };
}

function str(v: unknown, field: string): string {
  if (typeof v !== "string" || v.length === 0) {
    throw new InvalidEventError(`missing or invalid field: ${field}`);
  }
  return v;
}

export function loadEvents(dir: string, asset: SettlementIntent["asset"] = "USDC"): SettlementIntent[] {
  return readdirSync(dir)
    .filter((f) => f.endsWith(".json"))
    .sort()
    .map((f) => parseEvent(readFileSync(join(dir, f), "utf8"), asset));
}
