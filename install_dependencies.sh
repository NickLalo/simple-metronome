#!/usr/bin/env bash

set -Eeuo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

# Prefer the Node version declared in .nvmrc when nvm is available.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  nvm install
  nvm use --silent
fi

node_path="$(command -v node || true)"
if [[ -z "$node_path" || "$node_path" == /mnt/c/* ]]; then
  echo "A Linux/WSL Node installation is required. See README.md for setup instructions." >&2
  exit 1
fi

if ! command -v npm >/dev/null 2>&1; then
  echo "npm is required but was not found." >&2
  exit 1
fi

if ! node -e 'const [major, minor] = process.versions.node.split(".").map(Number); process.exit(major > 22 || (major === 22 && minor >= 12) ? 0 : 1)'; then
  echo "Node 22.12 or newer is required. Current version: $(node --version)" >&2
  exit 1
fi

echo "Installing dependencies with Node $(node --version) and npm $(npm --version)..."
npm ci
