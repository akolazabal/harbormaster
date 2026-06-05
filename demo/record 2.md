# Recording the Harbormaster demo (target: 75–90s)

Pre-flight: `npm install`; Speculos running (`npm run speculos`); account funded; `.env` set with `HM_ADAPTER=speculos`.

1. (0:00) Title card: "Harbormaster — an autonomous settlement agent that can't move funds without hardware approval."
2. (0:08) Terminal: `npm run demo` (or `npx tsx demo/run.ts --compromised`).
3. (0:15) ACT 1 — evt-001 prints APPROVED_FOR_REVIEW. Cut to the Speculos screen showing recipient 0x1111… + 2,500 USDC. Press Approve. Show the broadcast tx hash; open it on sepolia.basescan.org.
4. (0:40) ACT 1 cont. — evt-002 and evt-003 print BLOCKED with reasons; note the deterministic policy layer refused to even build a tx.
5. (0:55) ACT 2 — "What if the agent itself is compromised?" The runner bypasses policy and sends the attacker tx straight to the device. The Speculos screen shows 0x000…dEaD. Press Reject.
6. (1:10) Close on the line: "Give the agent the work. Keep the final authority in hardware."
