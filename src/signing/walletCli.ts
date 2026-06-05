import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { SigningAdapter } from "./adapter.js";
import type { UnsignedTx, SigningResult } from "../shared/types.js";

const pexec = promisify(execFile);

// NOTE: confirm exact `send` flags + JSON shape from docs/PHASE0-NOTES.md (Task 0.5).
export function walletCliAdapter(opts: { label: string; bin?: string }): SigningAdapter {
  return {
    name: "wallet-cli",
    async signAndBroadcast(tx: UnsignedTx): Promise<SigningResult> {
      const bin = opts.bin ?? "wallet-cli";
      const args = ["send", opts.label, "--to", tx.recipient, "--amount", `${tx.amountUsdc} USDC`, "--format", "json"];
      try {
        const { stdout } = await pexec(bin, args, { timeout: 180_000 });
        const out = JSON.parse(stdout);
        const txHash = out.txHash ?? out.hash ?? out.operationHash;
        return txHash ? { status: "APPROVED", txHash } : { status: "REJECTED" };
      } catch (e: any) {
        if (/reject|denied|cancel/i.test(String(e?.stderr ?? e?.message ?? ""))) return { status: "REJECTED" };
        throw e;
      }
    },
  };
}
