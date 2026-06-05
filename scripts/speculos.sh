#!/usr/bin/env bash
set -euo pipefail
# Launch the Speculos emulator running the Ethereum app, exposing:
#   - automation/REST API on host http://127.0.0.1:5005  (container :5000; host 5000 is taken by macOS AirPlay)
#   - APDU TCP server on 127.0.0.1:9999
# Downloads the Ethereum app ELF (Nano S Plus / nanos2) on first run.
HERE="$(cd "$(dirname "$0")/.." && pwd)"
APPS="$HERE/apps"
ELF="$APPS/ethereum.elf"
APP_VERSION="${APP_VERSION:-1.22.1}"
mkdir -p "$APPS"
if [ ! -f "$ELF" ]; then
  echo "Downloading Ethereum app ELF ($APP_VERSION, nanos2)…"
  curl -fsSL -o "$ELF" "https://github.com/LedgerHQ/app-ethereum/releases/download/${APP_VERSION}/app-${APP_VERSION}-nanos2.elf"
fi
echo "Starting Speculos — API http://127.0.0.1:5005 · APDU 127.0.0.1:9999 (Ctrl-C to stop)"
docker rm -f speculos >/dev/null 2>&1 || true
exec docker run --rm --name speculos --platform linux/amd64 \
  -p 5005:5000 -p 9999:9999 \
  -v "$APPS:/apps" \
  ghcr.io/ledgerhq/speculos:latest /apps/ethereum.elf \
  --model nanosp --display headless --api-port 5000 --apdu-port 9999
