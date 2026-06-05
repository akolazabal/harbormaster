import { appendFileSync, existsSync, readFileSync } from "node:fs";
import type { AuditRecord, SettlementIntent, PolicyDecision } from "../shared/types.js";
import { recordHash, GENESIS_HASH } from "../shared/hash.js";

export function buildRecord(
  prev: AuditRecord | null,
  intent: SettlementIntent,
  policy: PolicyDecision,
  signing: AuditRecord["signing"],
  now: () => string = () => new Date().toISOString(),
): AuditRecord {
  const seq = prev ? prev.seq + 1 : 0;
  const prevHash = prev ? prev.hash : GENESIS_HASH;
  const base = { seq, prevHash, intent, policy, signing, recordedAt: now() };
  return { ...base, hash: recordHash(prevHash, base) };
}

export function verifyChain(records: AuditRecord[]): boolean {
  let prevHash = GENESIS_HASH;
  for (const r of records) {
    const { hash, ...base } = r;
    if (r.prevHash !== prevHash) return false;
    if (recordHash(prevHash, base) !== hash) return false;
    prevHash = hash;
  }
  return true;
}

export function appendAudit(path: string, record: AuditRecord): void {
  appendFileSync(path, JSON.stringify(record) + "\n");
}

export function readAudit(path: string): AuditRecord[] {
  if (!existsSync(path)) return [];
  return readFileSync(path, "utf8").trim().split("\n").filter(Boolean).map((l) => JSON.parse(l));
}
