#!/usr/bin/env bash
set -euo pipefail
# Launch Speculos with the Ethereum app, exposing the automation API (5000)
# and the APDU TCP server (9999). The image ships reference apps under /speculos/apps.
# Model can be nanosp | nanox | flex | stax.
MODEL="${MODEL:-nanosp}"
APP="${APP:-/speculos/apps/ethereum.elf}"
docker run --rm -it \
  -p 5000:5000 -p 9999:9999 \
  ghcr.io/ledgerhq/speculos:latest \
  "${APP}" --model "${MODEL}" \
  --display headless --api-port 5000 --apdu-port 9999
