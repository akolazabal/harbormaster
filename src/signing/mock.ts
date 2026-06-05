import type { SigningAdapter } from "./adapter.js";
import type { UnsignedTx, SigningResult } from "../shared/types.js";

export function mockAdapter(opts: { approve: boolean; txHash?: `0x${string}` }): SigningAdapter {
  return {
    name: "mock",
    async signAndBroadcast(_tx: UnsignedTx): Promise<SigningResult> {
      return opts.approve
        ? { status: "APPROVED", txHash: opts.txHash ?? (("0x" + "ab".repeat(32)) as `0x${string}`) }
        : { status: "REJECTED" };
    },
  };
}
