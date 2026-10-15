#!/usr/bin/env bash
# Updates a running Studio to a new package without losing anything.
#   sudo bash studio/deploy/update.sh /path/to/NEW-extracted-package
# (or, if this folder is a git checkout:  sudo bash studio/deploy/update.sh --git)
# It makes a backup first, replaces the app code, keeps your settings (.env), data and flows, and rebuilds.
set -euo pipefail
STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ROOT="$(cd "$STUDIO_DIR/.." && pwd)"
SRC="${1:-}"
[ -n "$SRC" ] || { echo "Usage: update.sh <new-package-folder> | --git"; exit 1; }

echo "1/3  Backing up..."
bash "$STUDIO_DIR/deploy/backup.sh"

echo "2/3  Updating the code..."
if [ "$SRC" = "--git" ]; then
  git -C "$ROOT" pull --ff-only
else
  [ -f "$SRC/studio/package.json" ] || { echo "Stopped: $SRC does not look like a TapIt package (no studio/package.json)."; exit 1; }
  command -v rsync >/dev/null 2>&1 || { apt-get update -y >/dev/null && apt-get install -y rsync >/dev/null; }
  # The app code is replaced exactly (old files that no longer exist are removed). Settings and data are untouched.
  rsync -a --delete --exclude '.env' --exclude 'node_modules' --exclude '.next' --exclude 'data' "$SRC/studio/" "$STUDIO_DIR/"
  # Planning: add new files, never overwrite your flows, questions, decisions or handoffs.
  rsync -a --ignore-existing "$SRC/planning/" "$ROOT/planning/"
  chown -R 1000:1000 "$ROOT/planning"
fi

echo "3/3  Rebuilding and restarting..."
cd "$STUDIO_DIR"
docker compose up -d --build
docker image prune -f >/dev/null 2>&1 || true
echo "Updated. Your accounts, messages and flows were kept."
