#!/bin/bash
# Double-click to open the live asset viewer (Mac). Leave the window open while you look.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  for d in /opt/homebrew/bin /usr/local/bin "$HOME/.nvm/versions/node"/*/bin; do [ -x "$d/node" ] && PATH="$d:$PATH"; done
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Get the LTS version from https://nodejs.org, then double-click this again."
  open "https://nodejs.org/en/download" 2>/dev/null
  read -r -p "Press Return to close." _
  exit 1
fi
# keep the viewer itself up to date (only when nothing in the checkout is edited)
if [ -z "$(git status --porcelain --untracked-files=no 2>/dev/null)" ]; then git pull --ff-only --quiet 2>/dev/null || true; fi
node serve.mjs "$@"
read -r -p "The viewer stopped. Press Return to close." _
