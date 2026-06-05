// Phase 0: capture what the Ledger device screen shows for our USDC transfer.
// Speculos must be running (apdu :9999, api :5000). Run: npx tsx scripts/spike-clearsign.ts
import SpeculosTransportImport from "@ledgerhq/hw-transport-node-speculos";
import EthImport from "@ledgerhq/hw-app-eth";
import { serializeTransaction, parseGwei } from "viem";
import { buildUsdcTransfer } from "../src/settler/tx.js";
import type { SettlementIntent } from "../src/shared/types.js";

const SpeculosTransport: any = (SpeculosTransportImport as any).default ?? SpeculosTransportImport;
const Eth: any = (EthImport as any).default ?? EthImport;
const API = "http://127.0.0.1:5000";
const DERIVATION = "44'/60'/0'/0/0";
const USDC = "0x036CbD53842c5426634e7929541eC2318f3dCF7e" as const;

const intent: SettlementIntent = {
  id: "spike", shipmentId: "S", milestone: "DELIVERY", counterpartyName: "Caspian Freight LLP",
  counterpartyAddress: "0x1111111111111111111111111111111111111111",
  asset: "USDC", chain: "base-sepolia", amount: "2500.00", sourceEventRaw: "{}", createdAt: "t",
};

const press = (b: string) => fetch(`${API}/button/${b}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "press-and-release" }) });
const getEvents = async () => { const r = await fetch(`${API}/events?currentscreenonly=true`); const j: any = await r.json().catch(() => ({ events: [] })); return (j.events ?? []).map((e: any) => e.text).join(" | "); };

async function main() {
  const tx = buildUsdcTransfer(intent, USDC);
  const unsigned = { to: tx.to, data: tx.data, value: tx.value, nonce: 0, gas: 100000n, maxFeePerGas: parseGwei("1"), maxPriorityFeePerGas: parseGwei("1"), chainId: tx.chainId, type: "eip1559" as const };
  const serialized = serializeTransaction(unsigned);

  let resolution: any = null;
  try { const { ledgerService } = (await import("@ledgerhq/hw-app-eth")) as any; if (ledgerService?.resolveTransaction) { resolution = await ledgerService.resolveTransaction(serialized.slice(2), {}, { erc20: true, externalPlugins: true, nft: true }); console.log("resolution: OK (clear-sign descriptors loaded)"); } }
  catch (e: any) { console.log("resolution: none -", e?.message ?? e); }

  const transport = await SpeculosTransport.open({ apduPort: 9999 });
  const eth = new Eth(transport);
  const signP = eth.signTransaction(DERIVATION, serialized.slice(2), resolution).then((s: any) => ({ ok: true, s })).catch((e: any) => ({ ok: false, e }));

  console.log("\n=== device screens ===");
  for (let i = 0; i < 18; i++) {
    const text = await getEvents();
    if (text) console.log(`  [${i}] ${text}`);
    if (/accept|sign transaction|approve/i.test(text)) { console.log("  -> pressing BOTH to approve"); await press("both"); break; }
    await press("right");
  }
  const r: any = await signP;
  console.log("\nsign result:", r.ok ? `SIGNED v=${r.s.v}` : `NOT SIGNED (${r.e?.message ?? r.e})`);
  await transport.close();
}
main().catch((e) => { console.error("spike error:", e?.message ?? e); process.exit(1); });
