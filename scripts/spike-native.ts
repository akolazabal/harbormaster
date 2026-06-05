// Phase 0: confirm a NATIVE value transfer clear-signs (device shows recipient + amount).
// Speculos must be running. Run: npx tsx scripts/spike-native.ts
import SpeculosTransportImport from "@ledgerhq/hw-transport-node-speculos";
import EthImport from "@ledgerhq/hw-app-eth";
import { serializeTransaction, parseGwei, parseEther } from "viem";

const SpeculosTransport: any = (SpeculosTransportImport as any).default ?? SpeculosTransportImport;
const Eth: any = (EthImport as any).default ?? EthImport;
const API = process.env.SPECULOS_API ?? "http://127.0.0.1:5005";
const DERIVATION = "44'/60'/0'/0/0";
const RECIPIENT = "0x1111111111111111111111111111111111111111";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const press = (b: string) => fetch(`${API}/button/${b}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "press-and-release" }) });
const clear = () => fetch(`${API}/events`, { method: "DELETE" });
const screen = async () => { const r = await fetch(`${API}/events?stream=false`); const j: any = await r.json().catch(() => ({ events: [] })); return (j.events ?? []).map((e: any) => e.text).join(" | "); };

async function main() {
  const unsigned = { to: RECIPIENT as `0x${string}`, value: parseEther("0.001"), data: "0x" as const, nonce: 0, gas: 21000n, maxFeePerGas: parseGwei("1"), maxPriorityFeePerGas: parseGwei("1"), chainId: 84532, type: "eip1559" as const };
  const serialized = serializeTransaction(unsigned);

  const transport = await SpeculosTransport.open({ apduPort: 9999 });
  const eth = new Eth(transport);
  await clear();
  const signP = eth.signTransaction(DERIVATION, serialized.slice(2), null).then((s: any) => ({ ok: true, s })).catch((e: any) => ({ ok: false, e }));

  console.log("=== device screens (native 0.001 ETH transfer) ===");
  const seen = new Set<string>();
  for (let i = 0; i < 24; i++) {
    await wait(180);
    const text = await screen();
    if (text && !seen.has(text)) { console.log(`  ${text}`); seen.add(text); }
    if (/accept|sign|approve/i.test(text)) { console.log("  -> APPROVE (both)"); await press("both"); break; }
    await press("right");
  }
  const r: any = await signP;
  console.log("\nsign result:", r.ok ? `SIGNED (v=${r.s.v}, r=${String(r.s.r).slice(0, 14)}…)` : `NOT SIGNED (${r.e?.message ?? r.e})`);
  await transport.close();
}
main().catch((e) => { console.error("spike error:", e?.message ?? e); process.exit(1); });
