# Where the final authority should live

A short note on the design behind Harbormaster, and why I think this is the right shape for autonomous settlement.

## The question that actually gates deployment

I'm building [Tide](../README.md#about), an AI-native freight forwarder that settles cross-border trade in stablecoins. Once you decide an agent should move money, the hard question isn't whether the model is capable. It's a narrower, more structural one: **where does the authority to actually move funds live, and what is required to exercise it?**

That question has a clean answer when a human signs every payment and a much harder one when the point is to *not* have a human in the loop for routine work. The whole value of an autonomous settlement agent is that it can do the work hands-free. So the design problem is: how do you hand the agent the work while keeping the authority to move funds somewhere that a compromised process can't quietly reach?

A private key in a `.env` is the default answer, and it's a poor one. It's a single, copyable secret living in the same process as everything else. Anything that can read that process, a prompt injection in an inbound document, a poisoned tool result, a dependency that exfiltrates a file, can spend it, and can do so without leaving an obvious trace. The authority and the attack surface are the same object. That's the thing to fix.

## Layered, because each layer fails differently

Harbormaster's answer is three layers, arranged so that each one's weaknesses are covered by the next. The ordering matters: cheap and deterministic first, expensive and human-judgment last.

**1. Quarantine the part that reads untrusted input.** The Watcher ingests adversarial event text and turns it into a structured intent, but it has no wallet, no transaction assembly, no signing path. It cannot move money even if it is completely fooled. Everything downstream operates on validated, structured data, not raw text, so the free-text fields an injection lives in are dropped before anything with authority sees the payout. This is the cheapest and most reliable layer because it's *architectural*: it doesn't depend on catching the attack, only on never having granted the capability in the first place.

**2. A deterministic policy layer, with no model in the value path.** Every proposed payout is screened by pure functions, allowlist, denylist, per-transaction cap, daily cap, milestone validity, chain and asset whitelists. There is no LLM deciding whether a transfer is allowed. That's deliberate. A model can be argued with; a function that asks "is this address on the allowlist?" cannot be talked into a different answer by clever phrasing in a memo. Determinism is what makes this layer *auditable*, you can read it, test it, and reason about exactly what it will and won't permit. Harbormaster's policy engine is covered by unit tests, including an adversarial suite that encodes the attacks it must refuse. The trade-off is that a policy layer only enforces the rules you gave it; it is exactly as good as its configuration, and no better. Which is why it isn't the last layer.

**3. On-device confirmation, as the final authority.** For a payout that clears the policy layer, the unsigned transaction goes to a Ledger device, which clear-signs it: the recipient and amount are displayed on the device's own screen, and the transaction broadcasts only on an approval there. The signing key never leaves the device. This is the layer that holds when the others don't, including the case the deterministic layer can't fully cover: a fully compromised agent that has bypassed the software entirely. The compromised agent can assemble whatever transaction it likes, but it still has to get that transaction approved on a device whose screen shows the real destination to a human who can decline.

## Why hardware is the right place for the last layer

The reason this layer belongs in hardware, rather than in more software, is a property, not a slogan: **the authority is bound to a physical action that a remote attacker cannot perform on your behalf.**

- The key material stays on the device and is used there. A secret that is meant to be copied off a machine and a secret that is meant to never leave one are different kinds of object, and the difference is the whole point.
- The thing displayed and the thing signed are the same thing. Clear-signing shows the actual recipient and amount on the device's own screen, so an approval is consent to *this* transfer, not to whatever a compromised host claimed it was.
- Approval requires a deliberate physical action. That converts "anything that can read the process can spend the funds" into "moving funds requires a person to look at a screen and press a button," which is a much smaller and much more visible surface.

None of this makes a system unbreakable, and it isn't meant to. It changes the shape of what an attacker has to do: from quietly reading a secret to obtaining a physical approval against a screen that shows them being wrong. That's a meaningful, bounded improvement, and it's the specific improvement that lets you responsibly hand routine settlement to an agent.

## The point is enablement

It would be easy to read a demo like this as a warning about agents. It isn't. I'm building a company on the premise that agents *should* move money, that's the whole bet. Harbormaster is the part that makes that bet deployable.

The framing I'd stand behind: **give the agent the work, keep the final authority in hardware.** A deterministic policy layer plus on-device confirmation is, in my view, the right safety primitive for autonomous settlement, not because it removes all risk, but because it puts the last decision somewhere a compromised process can't quietly reach, and it does so without putting a human back in the loop for the routine cases. That's what responsible autonomy looks like in this domain: the agent runs the operation, and the authority to actually move value stays bound to a device and, at the edge, a person.

---

*This is an engineering note, not investment or security advice. Harbormaster is a testnet demonstration; it makes no claim to be unbreakable, only to move the final authority somewhere harder for a remote attacker to reach.*
