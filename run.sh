#!/usr/bin/env bash

set -Eeuo pipefail

cd -- "$(dirname -- "${BASH_SOURCE[0]}")"

if [[ ! -f node_modules/.package-lock.json || package-lock.json -nt node_modules/.package-lock.json ]]; then
  ./install_dependencies.sh
fi

# Load the WSL/Linux Node installation even when this terminal was opened
# before nvm was installed.
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [[ -s "$NVM_DIR/nvm.sh" ]]; then
  # shellcheck source=/dev/null
  source "$NVM_DIR/nvm.sh"
  nvm use --silent
fi

if ! command -v node >/dev/null 2>&1 || [[ "$(command -v node)" == /mnt/c/* ]]; then
  echo "A WSL/Linux Node installation is required. See README.md for setup instructions." >&2
  exit 1
fi

open_browser=true
vite_args=()

for argument in "$@"; do
  case "$argument" in
    -n|--no-browser)
      open_browser=false
      ;;
    *)
      vite_args+=("$argument")
      ;;
  esac
done

if [[ "$open_browser" == true ]]; then
  vite_args=(--open "${vite_args[@]}")
fi

exec npm run dev -- "${vite_args[@]}"
