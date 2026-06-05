// Spike: reproduce the DEMO ordering (driver polling 5005 while DMK uses 5005) to find the hang.
import * as DMKCore from "@ledgerhq/device-management-kit";
import * as DMKSpeculos from "@ledgerhq/device-transport-kit-speculos";
import * as DMKEth from "@ledgerhq/device-signer-kit-ethereum";
import { firstValueFrom } from "rxjs";
import { serializeTransaction, parseGwei, parseEther, hexToBytes } from "viem";
import { driveDevice, clearEvents } from "../demo/device.js";

const core: any = { ...(DMKCore as any), ...((DMKCore as any).default ?? {}) };
const spec: any = { ...(DMKSpeculos as any), ...((DMKSpeculos as any).default ?? {}) };
const ethm: any = { ...(DMKEth as any), ...((DMKEth as any).default ?? {}) };
const { DeviceManagementKitBuilder, DeviceActionStatus } = core;
const { speculosTransportFactory, speculosIdentifier } = spec;
const { SignerEthBuilder } = ethm;

const URL = process.env.SPECULOS_API ?? "http://127.0.0.1:5005";
const PATH = "44'/60'/0'/0/0";
const RECIPIENT = "0x1111111111111111111111111111111111111111";
const isDone = (s: any) => s.status === (DeviceActionStatus?.Completed ?? "completed") || s.status === "completed";
const isErr = (s: any) => s.status === (DeviceActionStatus?.Error ?? "error") || s.status === "error";
const runDA = <T,>(da: any, label: string, ms: number) => Promise.race<T>([
  new Promise<T>((res, rej) => da.observable.subscribe({ next: (s: any) => { if (isDone(s)) res(s.output); else if (isErr(s)) rej(s.error ?? new Error("err state")); }, error: rej })),
  new Promise<T>((_, rej) => setTimeout(() => rej(new Error(`${label} TIMEOUT ${ms}ms`)), ms)),
]);

async function main() {
  const dmk = new DeviceManagementKitBuilder().addTransport(speculosTransportFactory(URL)).build();
  const device: any = await firstValueFrom(dmk.startDiscovering({ transport: speculosIdentifier }) as any);
  const sessionId: any = await dmk.connect({ device });
  let signer: any;
  try { signer = new SignerEthBuilder({ dmk, sessionId }).build(); } catch { signer = new SignerEthBuilder({ sdk: dmk, sessionId }).build(); }
  console.log("connected, signer built");

  const unsigned = { to: RECIPIENT as `0x${string}`, value: parseEther("0.001"), data: "0x" as const, nonce: 0, gas: 21000n, maxFeePerGas: parseGwei("1"), maxPriorityFeePerGas: parseGwei("1"), chainId: 84532, type: "eip1559" as const };
  const txBytes = hexToBytes(serializeTransaction(unsigned));

  // DEMO ORDERING: clear + start driver FIRST, then getAddress (no prompt) + sign.
  await clearEvents();
  const driver = driveDevice("approve");
  console.log("getAddress (driver already polling)…");
  const addr: any = await runDA(signer.getAddress(PATH, { checkOnDevice: false }), "getAddress", 15000);
  console.log("address:", addr.address);
  console.log("signTransaction…");
  const sig: any = await runDA(signer.signTransaction(PATH, txBytes, {}), "signTransaction", 25000);
  await driver;
  console.log("DMK signature:", JSON.stringify(sig));
  process.exit(0);
}
main().catch((e) => { console.error("dmk spike error:", e?.message ?? e); process.exit(1); });
