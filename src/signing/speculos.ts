import SpeculosTransport from "@ledgerhq/hw-transport-node-speculos";
import Eth from "@ledgerhq/hw-app-eth";
import type { SpeculosTransportOpts } from "@ledgerhq/hw-transport-node-speculos";
import { createPublicClient, http, serializeTransaction, parseGwei, keccak256 } from "viem";
import { baseSepolia } from "viem/chains";
import type { SigningAdapter } from "./adapter.js";
import type { UnsignedTx, SigningResult } from "../shared/types.js";

// ── Typed boundaries for SDK classes ──────────────────────────────────────────
// TypeScript NodeNext resolves @ledgerhq/* to their lib-es/ ESM paths.  The
// compiled d.ts files use `export default class` which tsc treats as the
// *module namespace type* rather than the class type, so `SpeculosTransport.open`
// and `new Eth(...)` are invisible to the type checker.  Per the plan's guidance
// we isolate ONLY these two SDK entry-points behind a minimal typed boundary and
// double-cast through `unknown`; the rest of the file is fully strongly-typed.

type SpeculosTransportLike = {
  close(): Promise<void>;
};

type SpeculosTransportCtor = {
  open(opts: SpeculosTransportOpts): Promise<SpeculosTransportLike>;
};

type EthLike = {
  getAddress(path: string, display: boolean): Promise<{ address: string }>;
  signTransaction(
    path: string,
    rawHex: string,
    resolution: unknown,
  ): Promise<{ r: string; s: string; v: string }>;
};

type EthCtor = new (transport: SpeculosTransportLike) => EthLike;

// Resolve the class whether the package presents it as a default or namespace export (CJS/ESM interop).
const SpeculosTransportCls = ((SpeculosTransport as any)?.default ?? SpeculosTransport) as unknown as SpeculosTransportCtor;
const EthClass = ((Eth as any)?.default ?? Eth) as unknown as EthCtor;
// ──────────────────────────────────────────────────────────────────────────────

const DERIVATION = "44'/60'/0'/0/0";

// Builds an EIP-1559 tx, clear-signs it on Speculos, broadcasts via viem.
export function speculosAdapter(opts: { rpcUrl: string; apduPort?: number }): SigningAdapter {
  return {
    name: "speculos",
    async signAndBroadcast(tx: UnsignedTx): Promise<SigningResult> {
      const client = createPublicClient({ chain: baseSepolia, transport: http(opts.rpcUrl) });
      const transport = await SpeculosTransportCls.open({ apduPort: opts.apduPort ?? 9999 });
      try {
        const eth = new EthClass(transport);
        const { address } = await eth.getAddress(DERIVATION, false);
        const account = address as `0x${string}`;
        const nonce = await client.getTransactionCount({ address: account });
        const fees = await client.estimateFeesPerGas();
        // Native transfers always cost 21000 gas; only estimate for contract calls (tolerating an unfunded account).
        const gas = tx.data === "0x" ? 21000n : await client.estimateGas({ account, to: tx.to, data: tx.data, value: tx.value }).catch(() => 100000n);

        const unsigned = {
          to: tx.to, data: tx.data, value: tx.value, nonce, gas,
          maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas ?? parseGwei("1"),
          chainId: tx.chainId, type: "eip1559" as const,
        };
        const serialized = serializeTransaction(unsigned); // 0x-prefixed, unsigned
        // Native transfers clear-sign natively (no resolution needed). For contract calls, load
        // clear-signing descriptors lazily (ledgerService), falling back to null if unavailable.
        let resolution: unknown = null;
        if (tx.data !== "0x") {
          try {
            const { ledgerService } = (await import("@ledgerhq/hw-app-eth")) as any;
            if (ledgerService?.resolveTransaction) {
              resolution = await ledgerService.resolveTransaction(serialized.slice(2), {}, {});
            }
          } catch {
            // older hw-app-eth without ledgerService - proceed with null resolution
          }
        }
        const sig = await eth.signTransaction(DERIVATION, serialized.slice(2), resolution); // device prompts here

        const signed = serializeTransaction(unsigned, {
          r: `0x${sig.r}` as `0x${string}`,
          s: `0x${sig.s}` as `0x${string}`,
          v: BigInt(parseInt(sig.v, 16)),
        });
        // The device approved. Broadcast unless explicitly disabled (HM_BROADCAST=0), which lets
        // the signing flow be demonstrated on an unfunded testnet account (txHash is the signed tx's hash).
        if (process.env.HM_BROADCAST === "0") {
          return { status: "APPROVED", txHash: keccak256(signed) };
        }
        const txHash = await client.sendRawTransaction({ serializedTransaction: signed });
        return { status: "APPROVED", txHash };
      } catch (e: any) {
        if (/0x6985|denied|reject/i.test(String(e?.message ?? ""))) return { status: "REJECTED" };
        throw e;
      } finally {
        await transport.close();
      }
    },
  };
}
