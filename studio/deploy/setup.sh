#!/usr/bin/env bash
# TapIt Studio: one-command installer for a fresh Ubuntu or Debian VM.
#
#   sudo bash studio/deploy/setup.sh            asks a few questions, then installs and starts everything
#   sudo bash studio/deploy/setup.sh --yes      no questions (reads STUDIO_* values from the environment)
#
# Options: --no-docker-install  --no-build  --reconfigure  --http-port N  --https-port N
# Safe to run again: it keeps your existing settings unless you pass --reconfigure.
set -euo pipefail

ASSUME_YES=0; INSTALL_DOCKER=1; BUILD=1; RECONFIGURE=0; HTTP_PORT=80; HTTPS_PORT=443
while [ $# -gt 0 ]; do
  case "$1" in
    --yes|-y) ASSUME_YES=1 ;;
    --no-docker-install) INSTALL_DOCKER=0 ;;
    --no-build) BUILD=0 ;;
    --reconfigure) RECONFIGURE=1 ;;
    --http-port) HTTP_PORT="$2"; shift ;;
    --https-port) HTTPS_PORT="$2"; shift ;;
    -h|--help) sed -n 2,10p "$0"; exit 0 ;;
    *) echo "Unknown option: $1"; exit 1 ;;
  esac
  shift
done

STUDIO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PLANNING_DIR="$(cd "$STUDIO_DIR/../planning" 2>/dev/null && pwd || true)"
ENV_FILE="$STUDIO_DIR/.env"

say()  { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()   { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
die()  { printf '\n\033[31mStopped:\033[0m %s\n\n' "$*"; exit 1; }
ask()  { # ask "Question" default -> sets REPLY
  if [ "$ASSUME_YES" = 1 ]; then REPLY="${2:-}"; return; fi
  read -r -p "  $1${2:+ [$2]}: " REPLY || true; REPLY="${REPLY:-${2:-}}"
}
askpw() { # hidden input
  if [ "$ASSUME_YES" = 1 ]; then REPLY=""; return; fi
  read -r -s -p "  $1: " REPLY || true; echo
}
# (tr is stopped by head, which pipefail reports as a failure, so it is allowed to "fail" here)
randpw() { LC_ALL=C tr -dc 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789' </dev/urandom | head -c 18 || true; }

[ "$(id -u)" = 0 ] || die "Run this as root: sudo bash studio/deploy/setup.sh"
[ -f "$STUDIO_DIR/docker-compose.yml" ] || die "docker-compose.yml not found in $STUDIO_DIR. Run this from the extracted TapIt package."
[ -n "$PLANNING_DIR" ] || die "The planning folder is missing next to the studio folder."

say "1/5  Docker"
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  ok "Docker and Docker Compose are installed"
elif [ "$INSTALL_DOCKER" = 1 ]; then
  command -v curl >/dev/null 2>&1 || { apt-get update -y && apt-get install -y curl ca-certificates; }
  echo "  Installing Docker with Docker's official install script (needs internet)..."
  curl -fsSL https://get.docker.com | sh
  systemctl enable --now docker >/dev/null 2>&1 || true
  docker compose version >/dev/null 2>&1 || die "Docker installed but the Compose plugin is missing. Install 'docker-compose-plugin' and run this again."
  ok "Docker installed"
else
  die "Docker is not installed (and --no-docker-install was given)."
fi

say "2/5  Settings"
GENERATED_PW=""
if [ -f "$ENV_FILE" ] && [ "$RECONFIGURE" = 0 ]; then
  ok "Keeping your existing settings in $ENV_FILE (use --reconfigure to change them)"
else
  echo "  Answer a few questions. Press Enter to accept the value in [brackets]."
  echo
  echo "  How will people reach Studio?"
  echo "    1) A domain name that points at your public IP (free automatic HTTPS certificate)"
  echo "    2) No domain: use the VM's address with a self-made certificate (browser shows a one-time warning)"
  ask "Choose 1 or 2" "${STUDIO_MODE:-1}"; MODE="$REPLY"
  if [ "$MODE" = 1 ]; then
    ask "Domain (for example studio.yourcompany.co.za)" "${STUDIO_DOMAIN:-}"; DOMAIN="$REPLY"
    [ -n "$DOMAIN" ] || die "A domain is needed for option 1."
    CADDYFILE="Caddyfile"; PUBLIC="https://$DOMAIN"
  else
    DEFAULT_HOST="$( (hostname -I 2>/dev/null || true) | awk '{print $1}' || true)"; DEFAULT_HOST="${DEFAULT_HOST:-localhost}"
    ask "Address people will type (the VM's IP or a name)" "${STUDIO_DOMAIN:-$DEFAULT_HOST}"; DOMAIN="$REPLY"
    CADDYFILE="Caddyfile.internal"; PUBLIC="https://$DOMAIN"
  fi
  [ "$HTTPS_PORT" = 443 ] || PUBLIC="$PUBLIC:$HTTPS_PORT"
  echo
  ask "Developer (your) email" "${STUDIO_OWNER_EMAIL:-}"; OWNER_EMAIL="$REPLY"
  [ -n "$OWNER_EMAIL" ] || die "Your email is needed to create the developer login."
  ask "Your name" "${STUDIO_OWNER_NAME:-Owner}"; OWNER_NAME="$REPLY"
  OWNER_PW="${STUDIO_OWNER_PASSWORD:-}"
  if [ -z "$OWNER_PW" ]; then
    askpw "Choose a password (10+ characters), or press Enter to generate one"; OWNER_PW="$REPLY"
  fi
  if [ -z "$OWNER_PW" ]; then OWNER_PW="$(randpw)"; GENERATED_PW="$OWNER_PW"; fi
  [ "${#OWNER_PW}" -ge 10 ] || die "The password needs at least 10 characters."
  echo
  ask "Only allow these addresses in? Space-separated, for example '41.1.2.3 196.2.3.4' (Enter = anyone, login still required)" "${STUDIO_ALLOW_IPS:-}"; ALLOW="$REPLY"
  umask 077
  {
    echo "# Written by setup.sh on $(date -u +%FT%TZ). Contains a password: keep this file private."
    echo "STUDIO_DOMAIN=$DOMAIN"
    echo "STUDIO_PUBLIC_URL=$PUBLIC"
    echo "CADDYFILE=$CADDYFILE"
    echo "STUDIO_OWNER_EMAIL=$OWNER_EMAIL"
    echo "STUDIO_OWNER_NAME=$OWNER_NAME"
    echo "STUDIO_OWNER_PASSWORD=$OWNER_PW"
    [ -z "$ALLOW" ] || echo "STUDIO_ALLOW_IPS=$ALLOW"
    echo "PLANNING_HOST_DIR=$PLANNING_DIR"
    echo "HTTP_PORT=$HTTP_PORT"
    echo "HTTPS_PORT=$HTTPS_PORT"
  } > "$ENV_FILE"
  chmod 600 "$ENV_FILE"
  ok "Settings saved to $ENV_FILE"
fi

say "3/5  Folders and permissions"
mkdir -p "$PLANNING_DIR/handoffs"
chown -R 1000:1000 "$PLANNING_DIR"
ok "planning folder is writable by the app ($PLANNING_DIR)"

say "4/5  Firewall"
if command -v ufw >/dev/null 2>&1 && ufw status 2>/dev/null | grep -q "Status: active"; then
  ufw allow 22/tcp >/dev/null; ufw allow "$HTTP_PORT"/tcp >/dev/null; ufw allow "$HTTPS_PORT"/tcp >/dev/null
  ok "ufw: allowed SSH, $HTTP_PORT and $HTTPS_PORT"
else
  warn "ufw is not active, nothing changed. If you use a firewall, allow ports $HTTP_PORT and $HTTPS_PORT."
fi

say "5/5  Starting Studio"
cd "$STUDIO_DIR"
if [ "$BUILD" = 1 ]; then docker compose up -d --build; else docker compose up -d; fi
echo "  Waiting for it to answer..."
UP=0
CHECK_HOST="$(grep '^STUDIO_DOMAIN=' "$ENV_FILE" | cut -d= -f2-)"
for _ in $(seq 1 60); do
  # Connect by the real name (so the certificate matches) but to this machine.
  if curl -ksf --resolve "$CHECK_HOST:$HTTPS_PORT:127.0.0.1" "https://$CHECK_HOST:$HTTPS_PORT/api/health" >/dev/null 2>&1; then UP=1; break; fi
  sleep 3
done
[ "$UP" = 1 ] || { docker compose ps; die "Studio did not answer in time. See the logs with: cd $STUDIO_DIR && docker compose logs --tail 50"; }
ok "Studio is running"

URL="$(grep '^STUDIO_PUBLIC_URL=' "$ENV_FILE" | cut -d= -f2-)"
EMAIL="$(grep '^STUDIO_OWNER_EMAIL=' "$ENV_FILE" | cut -d= -f2-)"
say "Done"
echo "  Address:   $URL"
echo "  Sign in:   $EMAIL"
if [ -n "$GENERATED_PW" ]; then echo "  Password:  $GENERATED_PW   (generated, shown only now: write it down)"; else echo "  Password:  the one you chose (also stored in $ENV_FILE)"; fi
cat <<MSG

  Next:
   1. Open the address above and sign in. The top bar should show the Studio version.
   2. Team > Add a person: add your client (invite link or a password you give them).
   3. Make the site reachable from outside: see studio/deploy/VM-GUIDE.md (router, DNS).
   4. Set up the nightly backup: sudo bash $STUDIO_DIR/deploy/backup.sh --install-cron
   5. Optional hardening: after the first start you can delete the STUDIO_OWNER_PASSWORD line from $ENV_FILE.
MSG
