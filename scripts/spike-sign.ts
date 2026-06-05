// Phase 0 signing spike: prove the hw-transport ↔ Speculos handshake and derive the device address.
// Run with Speculos up:  npx tsx scripts/spike-sign.ts
import SpeculosTransportImport from "@ledgerhq/hw-transport-node-speculos";
import EthImport from "@ledgerhq/hw-app-eth";

const SpeculosTransport: any = (SpeculosTransportImport as any).default ?? SpeculosTransportImport;
const Eth: any = (EthImport as any).default ?? EthImport;

const DERIVATION = "44'/60'/0'/0/0";

async function main() {
  const transport = await SpeculosTransport.open({ apduPort: 9999 });
  try {
    const eth = new Eth(transport);
    const { address } = await eth.getAddress(DERIVATION, false);
    console.log("device address:", address);
  } finally {
    await transport.close();
  }
}

main().catch((e) => {
  console.error("spike failed:", e?.message ?? e);
  process.exit(1);
});
