import type { SigningAdapter } from "./adapter.js";
import { mockAdapter } from "./mock.js";
import { walletCliAdapter } from "./walletCli.js";
import { speculosAdapter } from "./speculos.js";
import { loadEnv } from "../shared/config.js";

export function selectAdapter(): SigningAdapter {
  const env = loadEnv();
  if (env.adapter === "wallet-cli") return walletCliAdapter({ label: env.account });
  if (env.adapter === "speculos") return speculosAdapter({ rpcUrl: env.rpcUrl });
  return mockAdapter({ approve: true });
}
