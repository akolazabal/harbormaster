# Emulator integration TODO (deferred from the core build)

The software core is complete: **35 tests passing, `tsc` clean**, full pipeline (watcher → policy → settler → audit) runs on the mock adapter. The items below require a running **Speculos emulator (Docker)** + a funded **Base Sepolia** account and must be completed before recording the demo video. They are deferred because Docker is not installed locally yet.

## Checklist (do in order)

1. **Stand up Speculos** — `npm run speculos` (`scripts/speculos.sh`) with the Ethereum app. Confirm APDU `:9999` + automation API `:5000`. (Plan Task 0.3.)
2. **Install + probe the Wallet CLI** — `npm i -g @ledgerhq/wallet-cli`; `npx skills add` the DMK + wallet-cli skills; capture `wallet-cli send --help` and any emulator transport hook. (Plan Task 0.2.)
3. **Signing spike / go-no-go** — sign one Base Sepolia USDC transfer end-to-end; pick the working adapter (`wallet-cli` vs `speculos`). (Plan Task 0.5.)
4. **CLEAR SIGNING — critical for the demo.** `src/signing/speculos.ts` currently falls back to **null resolution → blind signing** (the installed `@ledgerhq/hw-app-eth` did not expose `ledgerService` as a runtime export). The device MUST display the **recipient address + USDC amount** on screen — that is the demo's key moment. Resolve by either:
   - using the correct clear-signing/resolution API for the installed `@ledgerhq/hw-app-eth` version so the Ethereum app decodes `transfer(to, amount)`; or
   - providing ERC-20 token resolution for testnet USDC; or
   - **fallback:** demonstrate with a native testnet ETH transfer (recipient + amount clear-sign natively, no token resolution needed) — still proves "the device shows the real recipient and the human rejects."
5. **Runtime-verify the typed-cast SDK entry points** (`SpeculosTransport.open`, `new Eth(...)`) in `speculos.ts` against the live emulator (they typecheck via minimal `unknown` casts; confirm runtime behavior).
6. **Wallet CLI adapter** — confirm the exact `send` flags + JSON output shape against the real CLI; update `src/signing/walletCli.ts` if the field names differ.
7. **Funding** — confirm the Base Sepolia testnet USDC contract; fund the derived account with faucet ETH (gas) + testnet USDC. (Plan Task 0.4.)
8. **Live run** — `HM_ADAPTER=speculos npx tsx demo/run.ts --compromised`; approve evt-001, reject the compromised tx; capture the real tx hash on sepolia.basescan.org.
9. **Record** — per `demo/record.md`.

## Note
None of the above changes the deterministic core (policy/watcher/settler/audit), which is done and tested. This is purely the hardware-signing seam + recording.
