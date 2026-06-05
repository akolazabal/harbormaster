import type { SettlementIntent, PolicyConfig, PolicyDecision, PolicyCheck, DayState } from "../shared/types.js";

const VALID_MILESTONES = new Set(["ORIGIN_LOAD", "CASPIAN_CROSSING", "DELIVERY"]);

export function evaluate(intent: SettlementIntent, config: PolicyConfig, day: DayState): PolicyDecision {
  const checks: PolicyCheck[] = [];
  const addr = intent.counterpartyAddress.toLowerCase();
  const amount = Number(intent.amount);
  const amountValid = Number.isFinite(amount) && amount > 0;

  checks.push({ name: "chain_whitelist", passed: (config.allowedChains as string[]).includes(intent.chain), detail: `chain=${intent.chain}` });
  checks.push({ name: "asset_whitelist", passed: (config.allowedAssets as string[]).includes(intent.asset), detail: `asset=${intent.asset}` });

  const onDenylist = config.denylist.map((a) => a.toLowerCase()).includes(addr);
  checks.push({ name: "denylist_screen", passed: !onDenylist, detail: onDenylist ? "address on denylist" : "clear" });

  const onAllowlist = config.allowlist.some((e) => e.address.toLowerCase() === addr);
  checks.push({ name: "allowlist_membership", passed: onAllowlist, detail: onAllowlist ? "known counterparty" : "unknown counterparty" });

  checks.push({ name: "amount_valid", passed: amountValid, detail: `amount=${intent.amount}` });
  checks.push({ name: "per_tx_cap", passed: amountValid && amount <= config.perTxCapUsdc, detail: `cap=${config.perTxCapUsdc}` });
  checks.push({ name: "daily_cap", passed: amountValid && day.spentUsdc + amount <= config.dailyCapUsdc, detail: `spent=${day.spentUsdc} cap=${config.dailyCapUsdc}` });
  checks.push({ name: "milestone_valid", passed: VALID_MILESTONES.has(intent.milestone), detail: `milestone=${intent.milestone}` });

  const failed = checks.filter((c) => !c.passed);
  return {
    intentId: intent.id,
    decision: failed.length === 0 ? "APPROVED_FOR_REVIEW" : "BLOCKED",
    reasons: failed.map((c) => c.name),
    checks,
    evaluatedAt: new Date().toISOString(),
  };
}
