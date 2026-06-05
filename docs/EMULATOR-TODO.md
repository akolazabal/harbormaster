# Emulator phase - mostly complete

The emulator phase is **done**: on-device signing works end-to-end through the genuine Ledger Device Management Kit on the Speculos emulator. The software core is complete too - **41 tests passing, `tsc` clean**, full pipeline (watcher → policy → settler → audit). What remains is optional funding for a real on-chain broadcast, the walkthrough recording, and publishing.

## Done

1. **Speculos up.** `npm run speculos` (`scripts/speculos.sh`) auto-downloads the Ethereum app ELF and runs Speculos via Docker (on macOS, Colima: `colima start --vm-type vz --vz-rosetta`). Automation/REST API on host `http://127.0.0.1:5005` (the container's `:5000`; host 5000 is taken by macOS AirPlay), APDU on `127.0.0.1:9999`.
2. **Transport confirmed.** The DMK Speculos transport (`@ledgerhq/device-transport-kit-speculos`) discovers and connects to the device; the SDK entry points are runtime-verified against the live emulator.
3. **Clear-signing via native ETH.** The demo settles in native Base Sepolia ETH, which clear-signs the recipient and amount on screen with no token resolution needed - the device's key moment. (Testnet USDC isn't in Ledger's clear-signing registry, so an ERC-20 transfer would not display the recipient; production Tide settles in USDC, and `buildUsdcTransfer` remains in the codebase.)
4. **Genuine DMK adapter, built + demonstrated.** `src/signing/dmk.ts` uses `@ledgerhq/device-management-kit` + `@ledgerhq/device-transport-kit-speculos` + `@ledgerhq/device-signer-kit-ethereum`. Verified end-to-end with `HM_ADAPTER=dmk npx tsx demo/run.ts --compromised`: evt-001 signed on device; evt-002/003 policy-blocked (never reach the device); the compromised transfer declined on-device (APDU `0x6985` → `REJECTED`). This makes the contest component answer an honest **"Both"** (DMK demonstrated on the emulator; Wallet CLI implemented for production).
5. **Sign-without-funding path.** `HM_BROADCAST=0` runs the full signing flow on an unfunded account (the device signs; the reported hash is the signed tx's hash, with no on-chain send).
6. **Proof captured.** `docs/proof/legit-approve-03.png` (device shows `To 0x1111…1111`) and `docs/proof/attacker-reject-03.png` (`To 0x00…dEaD`), plus the full review sequences. The Speculos seed derives the device address `0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`.
7. **Funding instructions documented** (below).

## Remaining

1. **(Optional) Fund for a real broadcast.** Send Base Sepolia faucet ETH to `0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`, then run the demo without `HM_BROADCAST=0` to land a real on-chain tx and capture its hash on sepolia.basescan.org. Signing is already demonstrated without this; broadcast is the only step that needs funds.
2. **Record** per `demo/record.md` (Act 1 approve + Act 2 reject). `demo/live-view.html` shows the device screen in a browser during the run.
3. **Publish** the repo and post the thread / file the form (tracked in `docs/SUBMISSION.md`).

## Notes

- The **Wallet CLI** adapter (`src/signing/walletCli.ts`) is the production (USB) path. The Wallet CLI has no Speculos transport, so it is code-complete but not exercised on the emulator - the demonstrated emulator path is the DMK adapter.
- The `src/signing/speculos.ts` adapter (Ledger's `hw-transport`/`hw-app-eth` stack - not the DMK package) predates the `dmk` adapter and is kept as a fallback.
- None of this changes the deterministic core (policy/watcher/settler/audit), which is done and tested.
