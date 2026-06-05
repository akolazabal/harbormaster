import * as DMKCore from "@ledgerhq/device-management-kit";
import * as DMKSpeculos from "@ledgerhq/device-transport-kit-speculos";
import * as DMKEth from "@ledgerhq/device-signer-kit-ethereum";
import { firstValueFrom } from "rxjs";
import { createPublicClient, http, serializeTransaction, parseGwei, hexToBytes, keccak256 } from "viem";
import { baseSepolia } from "viem/chains";
import type { SigningAdapter } from "./adapter.js";
import type { UnsignedTx, SigningResult } from "../shared/types.js";

// The DMK packages ship dual CJS/ESM builds; merge named + default exports so the
// classes/factories resolve regardless of how the runtime loads them.
const core: any = { ...(DMKCore as any), ...((DMKCore as any).default ?? {}) };
const spec: any = { ...(DMKSpeculos as any), ...((DMKSpeculos as any).default ?? {}) };
const ethm: any = { ...(DMKEth as any), ...((DMKEth as any).default ?? {}) };
const { DeviceManagementKitBuilder, DeviceActionStatus } = core;
const { speculosTransportFactory, speculosIdentifier } = spec;
const { SignerEthBuilder } = ethm;

const DERIVATION = "44'/60'/0'/0/0";
const isDone = (s: any) => s.status === (DeviceActionStatus?.Completed ?? "completed") || s.status === "completed";
const isErr = (s: any) => s.status === (DeviceActionStatus?.Error ?? "error") || s.status === "error";

/** Run a DMK device-action observable to completion and return its output. */
function runDeviceAction<T>(da: { observable: any }): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    da.observable.subscribe({
      next: (s: any) => { if (isDone(s)) resolve(s.output as T); else if (isErr(s)) reject(s.error ?? new Error("DMK device action error")); },
      error: reject,
    });
  });
}

/**
 * Signs via the genuine Ledger Device Management Kit (DMK) over the Speculos HTTP transport.
 * The device review (approve/reject) is driven externally (a human, or demo/device.ts).
 */
export function dmkAdapter(opts: { rpcUrl: string; speculosUrl?: string }): SigningAdapter {
  return {
    name: "dmk",
    async signAndBroadcast(tx: UnsignedTx): Promise<SigningResult> {
      const client = createPublicClient({ chain: baseSepolia, transport: http(opts.rpcUrl) });
      const dmk = new DeviceManagementKitBuilder()
        .addTransport(speculosTransportFactory(opts.speculosUrl ?? process.env.SPECULOS_API ?? "http://127.0.0.1:5005"))
        .build();
      let sessionId: any;
      try {
        const device = await firstValueFrom(dmk.startDiscovering({ transport: speculosIdentifier }));
        sessionId = await dmk.connect({ device });
        let signer: any;
        try { signer = new SignerEthBuilder({ dmk, sessionId }).build(); }
        catch { signer = new SignerEthBuilder({ sdk: dmk, sessionId }).build(); }
        const { address } = await runDeviceAction<{ address: string }>(signer.getAddress(DERIVATION, { checkOnDevice: false }));
        const account = address as `0x${string}`;
        const nonce = await client.getTransactionCount({ address: account });
        const fees = await client.estimateFeesPerGas();
        const gas = tx.data === "0x" ? 21000n : await client.estimateGas({ account, to: tx.to, data: tx.data, value: tx.value }).catch(() => 100000n);

        const unsigned = {
          to: tx.to, data: tx.data, value: tx.value, nonce, gas,
          maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? parseGwei("1"),
          chainId: tx.chainId, type: "eip1559" as const,
        };
        const txBytes = hexToBytes(serializeTransaction(unsigned));

        // Device prompts here; the external driver (or a human) approves or rejects.
        const sig = await runDeviceAction<{ r: `0x${string}`; s: `0x${string}`; v: number }>(signer.signTransaction(DERIVATION, txBytes, {}));

        const signed = serializeTransaction(unsigned, { r: sig.r, s: sig.s, v: BigInt(sig.v) });
        if (process.env.HM_BROADCAST === "0") return { status: "APPROVED", txHash: keccak256(signed) };
        const txHash = await client.sendRawTransaction({ serializedTransaction: signed });
        return { status: "APPROVED", txHash };
      } catch (e: any) {
        // 6985 = user declined on device ("Condition not satisfied").
        const code = String(e?.errorCode ?? "");
        const text = `${e?.message ?? ""} ${e?._tag ?? ""}`;
        if (code === "6985" || /6985|reject|refus|denied|condition not satisfied/i.test(text)) return { status: "REJECTED" };
        throw e;
      } finally {
        try { await dmk.close?.(); } catch { /* ignore */ }
      }
    },
  };
}
