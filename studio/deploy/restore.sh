#!/usr/bin/env bash
# Restores a data backup made by backup.sh. This REPLACES the current accounts, messages and uploads.
#   sudo bash studio/deploy/restore.sh /opt/tapit-backups/studio-data-2026-10-15-0230.tgz
set -euo pipefail
FILE="${1:-}"
[ -f "$FILE" ] || { echo "Usage: restore.sh <studio-data-....tgz>"; exit 1; }
STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$STUDIO_DIR"
read -r -p "This replaces the current data with $FILE. Type YES to continue: " OK
[ "$OK" = "YES" ] || { echo "Cancelled."; exit 0; }
docker compose stop studio
CID="$(docker compose ps -aq studio)"
docker run --rm --volumes-from "$CID" -v "$(dirname "$(readlink -f "$FILE")")":/backup alpine \
  sh -c "rm -rf /data/* /data/.[!.]* 2>/dev/null; tar xzf /backup/$(basename "$FILE") -C /data && chown -R 1000:1000 /data"
docker compose start studio
echo "Restored. Check the site and sign in."
