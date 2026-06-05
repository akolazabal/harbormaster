import { join } from "node:path";
import { loadEvents } from "../src/watcher/watcher.js";
import { settleOne } from "../src/settler/settler.js";
import { appendAudit, buildRecord } from "../src/settler/audit.js";
import { evaluate } from "../src/policy/policy.js";
import { buildNativeTransfer } from "../src/settler/tx.js";
import { loadPolicyConfig, loadEnv } from "../src/shared/config.js";
import { selectAdapter } from "../src/signing/select.js";
import { driveDevice, clearEvents } from "./device.js";
import type { AuditRecord, DayState } from "../src/shared/types.js";

const AUDIT = "demo/audit.log.jsonl";

async function main() {
  // Demo policy: native-ETH settlement with ETH-scale caps. (Production config is config/policy.json — USDC.)
  const config = loadPolicyConfig("config/policy.demo.json");
  const env = loadEnv();
  const adapter = selectAdapter();
  const useDevice = adapter.name === "speculos";
  // Testnet demo settles in native Base Sepolia ETH (clear-signs the recipient on-device).
  // Production Tide settles in USDC; testnet USDC isn't in Ledger's clear-signing registry.
  const intents = loadEvents(join("demo", "events"), "ETH");
  let day: DayState = { date: new Date().toISOString().slice(0, 10), spentUsdc: 0 };
  let prev: AuditRecord | null = null;

  console.log(`\n⚓ Harbormaster — adapter=${adapter.name} chain=base-sepolia${process.env.HM_BROADCAST === "0" ? " (sign-only)" : ""}\n`);

  // ACT 1 + normal pipeline: each event flows watcher → policy → (device) → audit
  for (const intent of intents) {
    console.log(`— event ${intent.id} → ${intent.counterpartyName} ${intent.amount} ${intent.asset}`);
    let driver: Promise<boolean> | null = null;
    if (useDevice && evaluate(intent, config, day).decision === "APPROVED_FOR_REVIEW") {
      await clearEvents();
      driver = driveDevice("approve"); // simulate the human approving a legitimate payout on the device
    }
    const { record, day: d2 } = await settleOne(intent, { config, usdcContract: env.usdcContract, adapter }, day, prev);
    if (driver) await driver;
    day = d2;
    prev = record;
    appendAudit(AUDIT, record);
    const r = record;
    console.log(`   policy=${r.policy.decision}${r.policy.reasons.length ? " [" + r.policy.reasons.join(",") + "]" : ""} → signing=${r.signing.status}${r.signing.txHash ? " " + r.signing.txHash : ""}\n`);
  }

  // ACT 2 / Layer 2 — simulate a COMPROMISED agent that bypasses the policy layer
  // and assembles a malicious tx directly. The device is the last line of defense.
  if (process.argv.includes("--compromised")) {
    console.log("\n‼️  Simulating a compromised agent: bypassing policy, sending straight to the device…");
    const evil = intents.find((i) => i.id === "evt-002")!; // attacker address
    const tx = buildNativeTransfer(evil); // native transfer → device clear-signs the attacker address
    let driver: Promise<boolean> | null = null;
    if (useDevice) {
      await clearEvents();
      driver = driveDevice("reject"); // the human reviews 0x…dEaD on screen and declines
    }
    const result = await adapter.signAndBroadcast(tx);
    if (driver) await driver;
    const policy = evaluate(evil, config, day); // recorded for the audit trail
    const record = buildRecord(prev, evil, policy, result.status === "APPROVED" ? { status: "APPROVED", txHash: result.txHash } : { status: "REJECTED" });
    appendAudit(AUDIT, record);

    if (result.status === "REJECTED") {
      console.log(`   device verdict = REJECTED. The hardware held the final authority — the attacker address never received funds.\n`);
    } else {
      console.log(`   device verdict = APPROVED. Note: this ran without a human in the loop (${adapter.name} / no-device mode). With a real Ledger device, a human reviewing the recipient address on screen is the control that stops this payout.\n`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
