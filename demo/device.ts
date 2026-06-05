// Headless "human at the device": drives the Speculos automation API to approve or reject
// the transaction currently being clear-signed. Simulates the person reviewing the screen.
// In a real deployment a human presses the buttons; for a headless recording we script it.
const API = process.env.SPECULOS_API ?? "http://127.0.0.1:5005";
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function press(button: "left" | "right" | "both"): Promise<void> {
  await fetch(`${API}/button/${button}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "press-and-release" }),
  }).catch(() => {});
}

async function screenText(): Promise<string> {
  try {
    const r = await fetch(`${API}/events?stream=false`);
    const j: any = await r.json();
    return (j.events ?? []).map((e: any) => e.text).join(" | ");
  } catch {
    return "";
  }
}

/** Clear the accumulated screen-event buffer so a fresh signing flow reads cleanly. */
export async function clearEvents(): Promise<void> {
  await fetch(`${API}/events`, { method: "DELETE" }).catch(() => {});
}

/**
 * Wait for a transaction review to appear, navigate to the decision screen, and act.
 * - "approve": advance to "Sign transaction" and confirm.
 * - "reject":  advance to "Reject" and confirm.
 * Returns true if the decision screen was reached and confirmed.
 */
export async function driveDevice(action: "approve" | "reject"): Promise<boolean> {
  const target = action === "approve" ? /sign transaction/i : /reject/i;

  // 1) Wait for the review to start (Speculos draws "Review transaction"/"Amount"/...).
  let started = false;
  for (let i = 0; i < 50 && !started; i++) {
    await wait(200);
    if (/review transaction|amount|max fees|to\b/i.test(await screenText())) started = true;
  }
  if (!started) return false;

  // 2) Advance right until the decision screen is shown, then press both to confirm.
  for (let i = 0; i < 40; i++) {
    if (target.test(await screenText())) {
      await press("both");
      return true;
    }
    await press("right");
    await wait(200);
  }
  return false;
}
