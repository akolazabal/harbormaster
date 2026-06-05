// Capture device screenshots (proof) of the legit recipient and the attacker address on-screen.
// Speculos must be running. Run: npx tsx scripts/capture-proof.ts
import SpeculosTransportImport from "@ledgerhq/hw-transport-node-speculos";
import EthImport from "@ledgerhq/hw-app-eth";
import { serializeTransaction, parseGwei, parseEther } from "viem";
import { mkdirSync, writeFileSync } from "node:fs";

const SpeculosTransport: any = (SpeculosTransportImport as any).default ?? SpeculosTransportImport;
const Eth: any = (EthImport as any).default ?? EthImport;
const API = process.env.SPECULOS_API ?? "http://127.0.0.1:5005";
const PATH = "44'/60'/0'/0/0";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const press = (b: string) => fetch(`${API}/button/${b}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "press-and-release" }) });
const clear = () => fetch(`${API}/events`, { method: "DELETE" });
const screen = async () => { const r = await fetch(`${API}/events?stream=false`); const j: any = await r.json(); return (j.events ?? []).map((e: any) => e.text).join(" | "); };
async function shot(name: string) { const r = await fetch(`${API}/screenshot`); writeFileSync(`docs/proof/${name}.png`, Buffer.from(await r.arrayBuffer())); }

async function capture(recipient: string, label: string, action: "approve" | "reject") {
  const unsigned = { to: recipient as `0x${string}`, value: parseEther("0.001"), data: "0x" as const, nonce: 0, gas: 21000n, maxFeePerGas: parseGwei("1"), maxPriorityFeePerGas: parseGwei("1"), chainId: 84532, type: "eip1559" as const };
  const t = await SpeculosTransport.open({ apduPort: 9999 });
  const eth = new Eth(t);
  await clear();
  const signP = eth.signTransaction(PATH, serializeTransaction(unsigned).slice(2), null).then(() => "signed").catch((e: any) => "rejected (" + (e?.message ?? e) + ")");
  const target = action === "approve" ? /sign transaction/i : /reject/i;
  for (let i = 0; i < 24; i++) {
    await wait(300);
    const s = await screen();
    await shot(`${label}-${String(i).padStart(2, "0")}`);
    if (target.test(s)) { await press("both"); break; }
    await press("right");
  }
  console.log(`${label}: ${await signP}`);
  await t.close();
}

async function main() {
  mkdirSync("docs/proof", { recursive: true });
  await capture("0x1111111111111111111111111111111111111111", "legit-approve", "approve");
  await capture("0x000000000000000000000000000000000000dEaD", "attacker-reject", "reject");
  console.log("proof screenshots saved to docs/proof/");
}
main().catch((e) => { console.error(e?.message ?? e); process.exit(1); });
