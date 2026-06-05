import { createHash } from "node:crypto";

export const GENESIS_HASH = "0".repeat(64);

export function canonical(value: unknown): string {
  return JSON.stringify(sortKeys(value));
}

function sortKeys(v: any): any {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v).sort().reduce((acc: any, k) => {
      acc[k] = sortKeys(v[k]);
      return acc;
    }, {});
  }
  return v;
}

export function sha256Hex(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

export function recordHash(prevHash: string, recordWithoutHash: object): string {
  return sha256Hex(prevHash + canonical(recordWithoutHash));
}
