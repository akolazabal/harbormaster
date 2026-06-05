# Recording the Harbormaster demo (target: 75-90s)

## Prerequisites (one-time)
- Docker runtime. On macOS (Apple Silicon) this repo was built with **Colima**: `brew install colima docker && colima start --vm-type vz --vz-rosetta`.
- `npm install` in the repo.
- Start the emulator (downloads the Ethereum app ELF on first run, then serves API on `:5005`, APDU on `:9999`):
  ```bash
  npm run speculos        # leave running in its own terminal
  ```
- (Optional, for live device visuals) open `demo/live-view.html` in a browser - it shows the Speculos screen live.

> Note: macOS AirPlay Receiver occupies port 5000, so the Speculos API is mapped to host **5005**. The signing adapters and the device driver default to `http://127.0.0.1:5005`.

## Shot list
1. (0:00) Title card: "Harbormaster - an autonomous settlement agent that keeps the final authority to move funds in hardware."
2. (0:08) Terminal: run the demo through the **genuine DMK** path:
   ```bash
   HM_ADAPTER=dmk npx tsx demo/run.ts --compromised
   ```
   (Add `HM_BROADCAST=0` to sign without broadcasting if the account isn't funded - see below.)
3. (0:15) ACT 1 - `evt-001` prints `policy=APPROVED_FOR_REVIEW`. Cut to the device view (live-view.html): the screen shows **Amount 0.001 ETH** and **To 0x1111…1111**, then **Sign transaction**. It signs; the terminal prints the tx hash (if broadcasting, open it on sepolia.basescan.org).
4. (0:40) ACT 1 cont. - `evt-002` and `evt-003` print `BLOCKED` with reasons; the deterministic policy layer refused to even build a transaction.
5. (0:55) ACT 2 - "What if the agent itself is compromised?" The runner bypasses policy and assembles the malicious transfer directly. The device screen shows **To 0x00…dEaD** → the review reaches **Reject** → declined. Terminal: `device verdict = REJECTED`.
6. (1:10) Close on the line: "Give the agent the work. Keep the final authority in hardware."

## Funding (for a real on-chain broadcast - optional but strongest proof)
The Speculos default seed derives the sender address **`0xDad77910DbDFdE764fC21FCD4E74D71bBACA6D8D`**.
Fund it with Base Sepolia ETH (e.g., the Base or Alchemy Sepolia faucet). Then run **without** `HM_BROADCAST=0` and `evt-001` broadcasts a real transaction you can show on `sepolia.basescan.org`. Without funding, the demo still signs on the device (the signing flow is the proof); just keep `HM_BROADCAST=0`.

## Pre-captured proof
`docs/proof/` contains device screenshots from a real run: `legit-approve-03.png` (To 0x1111…), `attacker-reject-03.png` (To 0x…dEaD), plus the full review sequences.
