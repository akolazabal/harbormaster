import { expect, test } from "vitest";
import { writeFileSync, chmodSync, mkdtempSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { walletCliAdapter } from "../src/signing/walletCli.js";

function stub(script: string): string {
  const dir = mkdtempSync(join(tmpdir(), "hm-"));
  const p = join(dir, "wallet-cli");
  writeFileSync(p, script);
  chmodSync(p, 0o755);
  return p;
}
const tx = { to: "0x0", data: "0x0", value: 0n, chainId: 84532, recipient: "0x1111111111111111111111111111111111111111", amountUsdc: "1" } as any;

test("parses txHash from JSON stdout as APPROVED", async () => {
  const bin = stub('#!/usr/bin/env bash\necho \'{"txHash":"0xdeadbeef"}\'\n');
  const r = await walletCliAdapter({ label: "x", bin }).signAndBroadcast(tx);
  expect(r).toEqual({ status: "APPROVED", txHash: "0xdeadbeef" });
});

test("treats reject stderr as REJECTED", async () => {
  const bin = stub('#!/usr/bin/env bash\necho "user rejected on device" >&2\nexit 1\n');
  const r = await walletCliAdapter({ label: "x", bin }).signAndBroadcast(tx);
  expect(r).toEqual({ status: "REJECTED" });
});

test("treats explicit JSON rejection on exit 0 as REJECTED", async () => {
  const bin = stub('#!/usr/bin/env bash\necho \'{"status":"rejected"}\'\n');
  const r = await walletCliAdapter({ label: "x", bin }).signAndBroadcast(tx);
  expect(r).toEqual({ status: "REJECTED" });
});

test("throws a diagnostic when CLI exits 0 but returns no tx hash", async () => {
  const bin = stub('#!/usr/bin/env bash\necho \'{"status":"ok"}\'\n');
  await expect(walletCliAdapter({ label: "x", bin }).signAndBroadcast(tx)).rejects.toThrow(/no tx hash/);
});
