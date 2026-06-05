import type { SettlementIntent, PolicyConfig, DayState, AuditRecord } from "../shared/types.js";
import { evaluate } from "../policy/policy.js";
import { buildUsdcTransfer } from "./tx.js";
import { buildRecord } from "./audit.js";
import type { SigningAdapter } from "../signing/adapter.js";

export type SettleDeps = {
  config: PolicyConfig;
  usdcContract: `0x${string}`;
  adapter: SigningAdapter;
};

export async function settleOne(
  intent: SettlementIntent,
  deps: SettleDeps,
  day: DayState,
  prev: AuditRecord | null,
): Promise<{ record: AuditRecord; day: DayState }> {
  const policy = evaluate(intent, deps.config, day);

  if (policy.decision === "BLOCKED") {
    return { record: buildRecord(prev, intent, policy, { status: "NOT_ATTEMPTED" }), day };
  }

  const tx = buildUsdcTransfer(intent, deps.usdcContract);
  const result = await deps.adapter.signAndBroadcast(tx);

  if (result.status === "REJECTED") {
    return { record: buildRecord(prev, intent, policy, { status: "REJECTED" }), day };
  }

  const newDay: DayState = { ...day, spentUsdc: day.spentUsdc + Number(intent.amount) };
  const record = buildRecord(prev, intent, policy, { status: "APPROVED", txHash: result.txHash });
  return { record, day: newDay };
}
