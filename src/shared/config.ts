import { readFileSync } from "node:fs";
import type { PolicyConfig } from "./types.js";

export function loadPolicyConfig(path: string): PolicyConfig {
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw.allowlist) || !Array.isArray(raw.denylist)) {
    throw new Error("invalid policy config: allowlist/denylist must be arrays");
  }
  if (typeof raw.perTxCapUsdc !== "number" || typeof raw.dailyCapUsdc !== "number") {
    throw new Error("invalid policy config: caps must be numbers");
  }
  return raw as PolicyConfig;
}

export type Env = {
  rpcUrl: string;
  usdcContract: `0x${string}`;
  account: string;
  adapter: "mock" | "wallet-cli" | "speculos";
};

export function loadEnv(): Env {
  return {
    rpcUrl: process.env.HM_RPC_URL ?? "https://sepolia.base.org",
    usdcContract: (process.env.HM_USDC ?? "0x036CbD53842c5426634e7929541eC2318f3dCF7e") as `0x${string}`,
    account: process.env.HM_ACCOUNT ?? "harbormaster",
    adapter: (process.env.HM_ADAPTER as Env["adapter"]) ?? "mock",
  };
}
