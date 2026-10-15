#!/usr/bin/env bash
# Backs up Studio's data (accounts, messages, uploads) and the planning folder.
#   sudo bash studio/deploy/backup.sh                run a backup now
#   sudo bash studio/deploy/backup.sh --install-cron  also run it every night at 02:30
# Backups go to /opt/tapit-backups (override with BACKUP_DIR). The newest 14 are kept.
set -euo pipefail
STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLANNING_DIR="$(cd "$STUDIO_DIR/../planning" && pwd)"
BACKUP_DIR="${BACKUP_DIR:-/opt/tapit-backups}"
KEEP="${KEEP:-14}"
STAMP="$(date +%F-%H%M)"

if [ "${1:-}" = "--install-cron" ]; then
  LINE="30 2 * * * root bash $STUDIO_DIR/deploy/backup.sh >> /var/log/tapit-backup.log 2>&1"
  echo "$LINE" > /etc/cron.d/tapit-backup
  chmod 644 /etc/cron.d/tapit-backup
  echo "Nightly backup installed (02:30). Log: /var/log/tapit-backup.log"
fi

mkdir -p "$BACKUP_DIR"
cd "$STUDIO_DIR"
CID="$(docker compose ps -q studio)"
[ -n "$CID" ] || { echo "Studio is not running, cannot back up its data volume."; exit 1; }

# Fold the database's write-ahead log into the main file first, so the copy is consistent.
docker compose exec -T studio node -e "const {DatabaseSync}=require('node:sqlite');new DatabaseSync('/data/studio.db').exec('PRAGMA wal_checkpoint(TRUNCATE)')" >/dev/null 2>&1 || true

# Archive the data folder from the running container.
# (Uses Studio's own image, so nothing extra has to be downloaded.)
IMG="$(docker inspect -f '{{.Config.Image}}' "$CID")"
docker run --rm --user 0 --entrypoint sh --volumes-from "$CID" -v "$BACKUP_DIR":/backup "$IMG" \
  -c "tar czf /backup/studio-data-$STAMP.tgz -C /data ."
chown root:root "$BACKUP_DIR"/studio-data-"$STAMP".tgz
tar czf "$BACKUP_DIR/planning-$STAMP.tgz" -C "$(dirname "$PLANNING_DIR")" "$(basename "$PLANNING_DIR")"
chmod 600 "$BACKUP_DIR"/*-"$STAMP".tgz

# Keep the newest $KEEP of each kind.
for kind in studio-data planning; do
  ls -1t "$BACKUP_DIR"/$kind-*.tgz 2>/dev/null | tail -n +$((KEEP + 1)) | xargs -r rm -f
done
echo "Backup done: $BACKUP_DIR/studio-data-$STAMP.tgz and planning-$STAMP.tgz"
echo "Copy these off the VM now and then (another computer or cloud storage you control)."
