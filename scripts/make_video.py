#!/usr/bin/env python3
"""Render the Harbormaster demo video from captured device frames + narration cards.
Frames rendered with Pillow; stitched with ffmpeg.  Output: docs/harbormaster-demo.mp4"""
import os, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFont

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PROOF = os.path.join(HERE, "docs", "proof")
OUT = os.path.join(HERE, "docs", "harbormaster-demo.mp4")
W, H = 1280, 720
BG=(11,11,13); GOLD=(200,165,90); CREAM=(233,228,216); MUTE=(138,133,120); GREEN=(107,191,89); RED=(224,108,91); LINE=(42,37,32)

def font(path, size, index=0):
    for p in (path, "/System/Library/Fonts/Helvetica.ttc"):
        try: return ImageFont.truetype(p, size, index=index)
        except Exception: continue
    return ImageFont.load_default()

TITLE = lambda s: font("/System/Library/Fonts/Supplemental/Arial Bold.ttf", s)
BODY  = lambda s: font("/System/Library/Fonts/Helvetica.ttc", s)
MONO  = lambda s: font("/System/Library/Fonts/Menlo.ttc", s)

tmp = tempfile.mkdtemp()
frames = []  # (path, duration)

def canvas():
    img = Image.new("RGB", (W, H), BG); return img, ImageDraw.Draw(img)

def ctext(d, text, fnt, fill, y):
    w = d.textlength(text, font=fnt); d.text(((W - w) / 2, y), text, font=fnt, fill=fill)

def save(img, dur):
    p = os.path.join(tmp, f"{len(frames):04d}.png"); img.save(p); frames.append((p, dur))

def card(lines, dur):  # lines: list of (text, font, fill, y)
    img, d = canvas()
    for text, fnt, fill, y in lines:
        ctext(d, text, fnt, fill, y)
    save(img, dur)

def term(lines, dur):  # monospace, left-aligned, vertically centered block
    img, d = canvas()
    y = (H - len(lines) * 56) // 2
    for ln in lines:
        d.text((120, y), ln, font=MONO(30), fill=CREAM); y += 56
    save(img, dur)

def dev(name, caption, dur):
    img, d = canvas()
    scr = Image.open(os.path.join(PROOF, name + ".png")).convert("RGB").resize((1024, 512), Image.NEAREST)
    x, y = (W - 1024) // 2, 120
    img.paste(scr, (x, y))
    d.rectangle([x-2, y-2, x+1024+1, y+512+1], outline=LINE, width=3)
    ctext(d, caption, BODY(30), GOLD, y + 512 + 40)
    save(img, dur)

# ---- sequence ----
card([("HARBORMASTER", TITLE(82), GOLD, 250),
      ("Autonomous settlement. Hardware-held authority.", BODY(32), CREAM, 380),
      ("Ledger N3XT  ·  built with the Ledger Agent Stack (DMK)", BODY(24), MUTE, 442)], 3.0)
card([("ACT 1", TITLE(72), GOLD, 285), ("A legitimate settlement", BODY(36), CREAM, 390)], 2.2)
term(["event evt-001  ->  Caspian Freight LLP   0.001 ETH",
      "policy = APPROVED_FOR_REVIEW",
      "-> routing to the Ledger device for review"], 2.8)
for f in ["legit-approve-00","legit-approve-01","legit-approve-02","legit-approve-03","legit-approve-04","legit-approve-05","legit-approve-06"]:
    dev(f, "ACT 1  ·  review on the Ledger  ·  approve", 1.25)
card([("SIGNED", TITLE(78), GREEN, 285), ("on the Ledger device, via the Device Management Kit", BODY(30), CREAM, 395)], 2.6)
term(["event evt-002  ->  0x..dEaD      BLOCKED [denylist, allowlist]",
      "event evt-003  ->  999999 ETH    BLOCKED [per-tx cap, daily]",
      "the deterministic policy refused — no tx was ever built"], 3.2)
card([("ACT 2", TITLE(72), GOLD, 285), ("When the agent itself is compromised", BODY(36), CREAM, 390)], 2.4)
term(["a fully compromised agent bypasses the policy layer",
      "and assembles the malicious transfer itself",
      "-> sent straight to the device"], 2.8)
for f in ["attacker-reject-00","attacker-reject-01","attacker-reject-02","attacker-reject-03","attacker-reject-04","attacker-reject-05","attacker-reject-06","attacker-reject-07"]:
    dev(f, "ACT 2  ·  attacker address shown  ·  decline", 1.2)
card([("REJECTED", TITLE(78), RED, 285), ("the hardware held the final authority — nothing moved", BODY(30), CREAM, 395)], 3.2)
card([("Give the agent the work.", BODY(48), CREAM, 250),
      ("Keep the final authority in hardware.", TITLE(52), GOLD, 330),
      ("Harbormaster  ·  #LedgerSponsor", BODY(26), MUTE, 450)], 3.8)

# ---- concat list + ffmpeg ----
listfile = os.path.join(tmp, "list.txt")
with open(listfile, "w") as f:
    for p, dur in frames:
        f.write(f"file '{p}'\nduration {dur}\n")
    f.write(f"file '{frames[-1][0]}'\n")  # repeat last so its duration is honored

cmd = ["ffmpeg","-y","-loglevel","warning","-f","concat","-safe","0","-i",listfile,
       "-vf","fps=30,format=yuv420p","-c:v","libx264","-crf","20","-preset","medium","-movflags","+faststart", OUT]
r = subprocess.run(cmd, capture_output=True, text=True)
if r.returncode:
    print("FFMPEG ERROR:\n" + r.stderr[-2500:]); raise SystemExit(1)
print("wrote", OUT)
print(subprocess.run(["ffprobe","-v","error","-show_entries","format=duration:stream=width,height",
                      "-of","default=noprint_wrappers=1", OUT], capture_output=True, text=True).stdout.strip())
