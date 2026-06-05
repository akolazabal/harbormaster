# Architecture

Harbormaster is four units behind one quarantine boundary. The first three are software; the fourth is the hardware root of trust. Data flows in one direction — untrusted events in on the left, an on-device approval as the last gate on the right — and the design keeps privileged capability as far as possible from the parts that touch untrusted input.

```
 untrusted events                      deterministic                    privileged
┌──────────────┐   intents   ┌──────────────────┐  approved  ┌──────────────────┐
│   WATCHER    │────────────▶│   POLICY ENGINE  │───────────▶│     SETTLER      │
│ (read-only,  │             │ (pure functions, │            │ assembles tx,    │
│  quarantined)│             │  no LLM)         │   blocked  │ writes audit log │
└──────────────┘             └──────────────────┘     ✗      └────────┬─────────┘
 no wallet, no signing         allowlist/denylist                     │ unsigned tx
                              caps, milestone check                   ▼
                                                          ┌──────────────────────┐
                                                          │  SIGNING ADAPTER     │
                                                          │  (DMK / Wallet CLI)  │
                                                          └──────────┬───────────┘
                                                                     │ APDU (TCP :9999)
                                                                     ▼
                                                          ┌──────────────────────┐
                                                          │  LEDGER DEVICE        │
                                                          │  (Speculos) — Clear   │
                                                          │  Sign · Approve/Reject│
                                                          └──────────────────────┘
```

## The quarantine boundary

The single most important structural decision is that **the component that reads untrusted input has no privileged capability.** The Watcher ingests adversarial event text but has no import path to a wallet, to transaction assembly, or to a signing adapter. It cannot move money even if it is completely fooled. Everything downstream operates on a *structured, validated* `SettlementIntent`, not on raw event text. This is why a prompt injection buried in an inbound event is inert: by the time anything with authority sees the payout, the free-text fields the injection lives in have already been dropped.

## 1. Watcher — `src/watcher/watcher.ts`

**Role:** ingest untrusted shipment-milestone events and parse them into structured intents. Read-only and quarantined.

- `parseEvent(raw)` parses one event into a `SettlementIntent`. It validates that required fields are present non-empty strings and that `counterpartyAddress` matches `^0x[0-9a-fA-F]{40}$`, throwing `InvalidEventError` otherwise (non-JSON input throws too — an injection string like `"ignore previous instructions"` simply fails to parse).
- **Hardcodes `asset: "USDC"` and `chain: "base-sepolia"`** regardless of what the untrusted input claims. Even if an event sets `chain: "solana"` or `asset: "ETH"`, the parsed intent is USDC on Base Sepolia. Untrusted input does not get to choose the asset or the chain.
- Retains the full original event text in `sourceEventRaw` so the untrusted input is preserved verbatim for the audit trail — kept as data, never interpreted as instruction.
- `loadEvents(dir)` reads every `*.json` file in a directory, sorted, and parses each.

**Cannot:** touch a wallet, assemble a transaction, or sign. It has no reference to the Settler or any signing adapter.

## 2. Policy Engine — `src/policy/policy.ts`

**Role:** the deterministic guardrail. The crown jewel — pure functions, no network, no model in the value path, fully unit-testable.

`evaluate(intent, config, day) -> PolicyDecision` runs eight ordered checks and records a pass/fail with a human-readable detail for each:

| Check | Blocks when |
|---|---|
| `chain_whitelist` | chain not in `allowedChains` |
| `asset_whitelist` | asset not in `allowedAssets` |
| `denylist_screen` | counterparty address on the denylist (case-insensitive) — an OFAC-style screen |
| `allowlist_membership` | counterparty address not on the allowlist (case-insensitive) |
| `amount_valid` | amount is not a finite number `> 0` |
| `per_tx_cap` | amount exceeds `perTxCapUsdc` |
| `daily_cap` | `day.spentUsdc + amount` exceeds `dailyCapUsdc` |
| `milestone_valid` | milestone is not one of the known milestones |

The decision is `APPROVED_FOR_REVIEW` only if **every** check passes; otherwise `BLOCKED`, with `reasons[]` listing the names of the failed checks and `checks[]` carrying the full per-check trace. "Approved for review" is deliberate wording: the policy engine's job is to decide what is *eligible* to be presented to the device — it never authorizes a movement on its own.

Because `evaluate` is a pure function of `(intent, config, day)`, every property of the guardrail is directly testable. The suite includes an **adversarial set** (`test/policy.adversarial.test.ts`) that encodes the attack rubric: an injection in a memo does not change the parsed destination; substituting an unknown address is blocked on `allowlist_membership`; a drain attempt above the caps is blocked on `per_tx_cap`. These must all return `BLOCKED`.

## 3. Settler — `src/settler/`

**Role:** the privileged unit. Takes approved intents, assembles the transaction, drives the signing gate, and records the outcome.

- **`tx.ts` — transaction assembly.** `buildTransfer(intent, usdcContract)` dispatches on `intent.asset`: `buildUsdcTransfer` encodes an ERC-20 `transfer(to, amount)` with viem (`parseUnits` at 6 decimals for USDC), targeting the USDC contract with `value: 0n`; `buildNativeTransfer` builds a native value transfer (`parseEther`, `data: "0x"`) straight to the recipient. Both set `chainId: 84532` (Base Sepolia) and surface `recipient` and `amountUsdc` explicitly so they can be displayed and audited. Production settles in USDC; the testnet demo uses native ETH so the device can clear-sign the recipient (see the clear-signing note below).
- **`settler.ts` — orchestration.** `settleOne(intent, deps, day, prev)` is the pipeline:
  1. `evaluate` the intent. If `BLOCKED`, record `signing: NOT_ATTEMPTED` and return — **no transaction is built, the signing adapter is never called, and the day's spend is unchanged.**
  2. Otherwise build the `UnsignedTx` and call `adapter.signAndBroadcast(tx)`.
  3. On `REJECTED`, record `signing: REJECTED`; the day's spend is unchanged.
  4. On `APPROVED`, record `signing: APPROVED` with the broadcast `txHash` and debit the day's spend by the amount.

  Every branch produces an `AuditRecord`. The day's running total only advances on a confirmed, approved broadcast.
- **`audit.ts` — the hash-chained audit log** (see below).

## 4. Signing adapter + Ledger device — `src/signing/`

**Role:** present the unsigned transaction to a Ledger device for clear-signing and broadcast it only on an on-device approval.

A single interface decouples the core from the transport:

```ts
export interface SigningAdapter {
  readonly name: string;
  signAndBroadcast(tx: UnsignedTx): Promise<SigningResult>;
}
```

`SigningResult` is `{ status: "APPROVED"; txHash } | { status: "REJECTED" }`. Four implementations, selected by the `HM_ADAPTER` env var via `select.ts`:

1. **`mock.ts` (`mock`)** — an in-memory adapter that returns a configured `APPROVED`/`REJECTED` without a device. Used by the test suite and the no-device dry run. It is a stand-in for the transport, **not** a stand-in for the hardware control: it makes no human decision, so a `mock` run of the compromised-agent scenario auto-approves — which the demo runner states explicitly, because the absence of the human-in-the-loop review is precisely what the on-device step provides.
2. **`walletCli.ts` (`wallet-cli`)** — the **Ledger Wallet CLI** path, the agentic entry point. Shells out to `wallet-cli send <label> --to … --amount "<n> USDC" --format json` and parses the JSON for a broadcast tx hash, mapping device rejections (`reject`/`denied`/`cancel`) to `REJECTED`. This is the production (USB) path; the Wallet CLI has no Speculos transport, so it is code-complete but not exercised on the emulator.
3. **`dmk.ts` (`dmk`)** — the **genuine Device Management Kit** path, built on `@ledgerhq/device-management-kit` with `@ledgerhq/device-transport-kit-speculos` and `@ledgerhq/device-signer-kit-ethereum`. It builds a `DeviceManagementKit` with the Speculos HTTP transport (automation API, default `http://127.0.0.1:5005`), discovers and connects to the device, builds the Ethereum signer, derives the address at `44'/60'/0'/0/0`, assembles an EIP-1559 transaction (nonce/fees/gas via viem against the Base Sepolia RPC), and runs the signer's `signTransaction` device action — the device prompts for review here. An on-device decline (APDU `0x6985`, "condition not satisfied") maps to `REJECTED`. With `HM_BROADCAST=0` it returns the signed transaction's hash without sending; otherwise it broadcasts via viem. **This is the adapter demonstrated on the Speculos emulator** (see the device screenshots in `docs/proof/`).
4. **`speculos.ts` (`speculos`)** — an on-device signing path over `@ledgerhq/hw-transport-node-speculos` and `@ledgerhq/hw-app-eth` (Ledger's transport + Ethereum-app SDK). It opens the Speculos transport, derives the device address at `44'/60'/0'/0/0`, builds an EIP-1559 transaction, serializes it, requests a clear-signing **resolution** for contract calls, signs on the device, and broadcasts (or, with `HM_BROADCAST=0`, returns the signed tx's hash without sending). A device cancel (APDU `0x6985`) maps to `REJECTED`. **Note:** this adapter's `hw-transport`/`hw-app-eth` stack is Ledger's signing SDK but is **not** the DMK package (`@ledgerhq/device-management-kit`) — the genuine DMK integration is the `dmk` adapter above. This adapter predates it and is kept as a fallback.

This `SigningAdapter` shape lets the build use **both** Ledger components — the DMK (`dmk`, demonstrated on the emulator) and the Wallet CLI (`walletCli`, implemented for production) — through one interface, and stay resilient: if one signing path is unavailable on a given machine, another can carry the proof. Because both are genuinely used, the accurate contest-form answer is **"Both."**

**A note on the testnet asset and clear-signing.** The device showing the *real* recipient and amount is the entire point of the on-device step. The demo therefore settles in **native Base Sepolia ETH**, which clear-signs the recipient and amount natively with no token resolution needed (`demo/run.ts` loads events as `ETH` and uses `buildNativeTransfer`). Testnet USDC isn't in Ledger's clear-signing registry, so an ERC-20 `transfer(to, amount)` would not display the recipient on the device — which is why native ETH is used to demonstrate the clear-sign. Production Tide settles in USDC; the codebase still assembles USDC transfers (`buildUsdcTransfer`, dispatched by `buildTransfer` on `intent.asset`), and the `speculos` adapter requests an ERC-20 clear-signing resolution lazily when signing a contract call (falling back to null resolution if the installed `@ledgerhq/hw-app-eth` does not expose the helper).

### The Ledger device (Speculos)

The device runs the Ethereum app under Speculos in Docker (on macOS, via Colima), exposing the APDU TCP server on `127.0.0.1:9999` and the automation/REST API on host `http://127.0.0.1:5005` (the container's `:5000`, remapped because macOS AirPlay occupies host port 5000). `scripts/speculos.sh` (`npm run speculos`) downloads the Ethereum app ELF on first run and launches it. Clear-signing displays the recipient and amount on the device screen; a human approves or rejects, and `demo/device.ts` drives the automation API to play that part for a headless recording, leaving a manual mode available. `demo/live-view.html` polls the `/screenshot` endpoint so the device screen can be watched in a browser.

## The hash-chained audit log — `src/settler/audit.ts`

Every decision — approved, blocked, or rejected — is recorded as an `AuditRecord` and appended to a JSONL log. Records are chained so the history is tamper-evident:

- `buildRecord(prev, intent, policy, signing, now?)` sets `seq` and `prevHash` from the previous record (or `GENESIS_HASH` — 64 zeros — for the first), then computes `hash = sha256(prevHash + canonical(record-without-hash))`.
- `canonical` (in `src/shared/hash.ts`) is a deterministic JSON serializer that sorts object keys recursively, so the hash is stable regardless of field ordering.
- `verifyChain(records)` walks the chain and returns `false` if any `prevHash` link is broken or any record's hash doesn't recompute — so altering a stored record (for example, rewriting a `txHash`) is detectable.

This mirrors the cryptographically-anchored shipment history that Tide relies on: the record of what the agent did, and what the device decided, is append-only and self-verifying.

## Data model — `src/shared/types.ts`

The single source of truth for every type:

```ts
type Milestone = "ORIGIN_LOAD" | "CASPIAN_CROSSING" | "DELIVERY";

type SettlementIntent = {
  id: string;
  shipmentId: string;
  milestone: Milestone;
  counterpartyName: string;
  counterpartyAddress: `0x${string}`;
  asset: "USDC" | "ETH";     // USDC in production; native ETH for the clear-signed testnet demo
  chain: "base-sepolia";
  amount: string;            // decimal, e.g. "2500.00" (USDC) or "0.001" (ETH)
  sourceEventRaw: string;    // untrusted original event text, retained for audit
  createdAt: string;         // ISO 8601
};

type PolicyCheck = { name: string; passed: boolean; detail: string };

type PolicyDecision = {
  intentId: string;
  decision: "APPROVED_FOR_REVIEW" | "BLOCKED";
  reasons: string[];                       // names of failed checks
  checks: PolicyCheck[];                   // full per-check trace
  evaluatedAt: string;
};

type PolicyConfig = {
  allowlist: { name: string; address: `0x${string}` }[];
  denylist: `0x${string}`[];               // OFAC-style
  perTxCapUsdc: number;
  dailyCapUsdc: number;
  allowedChains: ["base-sepolia"];
  allowedAssets: ("USDC" | "ETH")[];
};

type DayState = { date: string; spentUsdc: number };

type UnsignedTx = {
  to: `0x${string}`;          // USDC contract
  data: `0x${string}`;        // encoded transfer(recipient, amount)
  value: bigint;              // 0n for ERC-20
  chainId: number;            // 84532 = Base Sepolia
  recipient: `0x${string}`;   // surfaced for display/audit
  amountUsdc: string;
};

type SigningResult =
  | { status: "APPROVED"; txHash: `0x${string}` }
  | { status: "REJECTED" };

type AuditRecord = {
  seq: number;
  prevHash: string;
  intent: SettlementIntent;
  policy: PolicyDecision;
  signing: { status: "APPROVED" | "REJECTED" | "NOT_ATTEMPTED"; txHash?: string };
  hash: string;
  recordedAt: string;
};
```

## Configuration

- **`config/policy.json`** — the allowlist (named counterparties), denylist, `perTxCapUsdc`, `dailyCapUsdc`, and the chain/asset whitelists. Loaded and validated by `src/shared/config.ts`.
- **Environment** (`.env.example`) — `HM_RPC_URL` (Base Sepolia RPC), `HM_USDC` (testnet USDC contract), `HM_ACCOUNT` (CLI account label / derivation), `HM_ADAPTER` (`mock` \| `wallet-cli` \| `dmk` \| `speculos`), `HM_BROADCAST` (set to `0` to sign without broadcasting), and the Speculos endpoints (`SPECULOS_API`, default `http://127.0.0.1:5005`).

## Test surface

41 tests across the units: shared types, canonical hashing and chaining, config loading, the watcher (including the quarantine guarantees), the policy engine and its adversarial suite, the audit log (including tamper detection), the transaction builder (ERC-20 and native), the settler orchestration, and the Wallet CLI adapter (driven by a stub binary so it is deterministic and needs no device).
