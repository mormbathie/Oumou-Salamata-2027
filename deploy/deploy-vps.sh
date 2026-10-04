#!/usr/bin/env bash
# Apply the Git-tracked production SHA to an existing VPS installation.
set -euo pipefail
umask 077

if (( EUID != 0 )); then
  printf 'Run this script with sudo on the VPS.\n' >&2
  exit 1
fi
project_root=$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)
cd -- "$project_root"
for private_file in .env deployment-access.txt deploy/realm.production.json; do
  if [[ ! -s "$private_file" ]]; then
    printf 'Required existing production file is missing: %s\n' "$private_file" >&2
    exit 1
  fi
done
version_line=$(cat deploy/production.env)
if [[ ! "$version_line" =~ ^APP_VERSION=([0-9a-f]{40})$ ]]; then
  printf 'deploy/production.env must contain one full Git SHA.\n' >&2
  exit 1
fi
export APP_VERSION="${BASH_REMATCH[1]}"

compose=(docker compose --project-directory "$project_root" -f docker-compose.yml -f docker-compose.vps.yml)
"${compose[@]}" config --quiet
"${compose[@]}" config --format json | python3 -c '
import json, os, sys
config = json.load(sys.stdin)
sha = os.environ["APP_VERSION"]
services = config["services"]
for name in ("backend", "frontend"):
    expected = f"mormbathie/oumou-salamat-{name}:{sha}"
    actual = services[name].get("image")
    if actual != expected or services[name].get("build"):
        raise SystemExit(f"Unexpected build or image for {name}: {actual}")
required = {"postgres_data", "keycloak_postgres_data", "school_documents", "caddy_data", "caddy_config"}
if not required.issubset(config["volumes"]):
    raise SystemExit("A required persistent volume is missing from Compose")
'

# Never bootstrap, seed, remove volumes, or replace the existing private files.
for service in postgres keycloak-postgres keycloak backend frontend caddy; do
  container_id=$("${compose[@]}" ps -q "$service")
  if [[ -z "$container_id" || "$(docker inspect -f '{{.State.Running}}' "$container_id")" != true ]]; then
    printf 'Existing service is not running: %s\n' "$service" >&2
    exit 1
  fi
done

backup_root=/var/backups/oumou-salamat/daily
marker=$(mktemp)
trap 'rm -f -- "$marker"' EXIT
printf 'Starting mandatory backup before changing application containers.\n'
systemctl start oumou-salamat-backup.service
journalctl -u oumou-salamat-backup.service --no-pager -n 30
if ! find "$backup_root" -mindepth 2 -maxdepth 2 -name .complete -type f -newer "$marker" -print -quit | grep -q .; then
  printf 'No newly completed backup was found; deployment stopped.\n' >&2
  exit 1
fi

for name in backend frontend; do
  image="mormbathie/oumou-salamat-$name:$APP_VERSION"
  docker pull "$image"
  revision=$(docker image inspect -f '{{index .Config.Labels "org.opencontainers.image.revision"}}' "$image")
  if [[ "$revision" != "$APP_VERSION" ]]; then
    printf 'Image revision mismatch for %s\n' "$image" >&2
    exit 1
  fi
done

# Only application containers are eligible for recreation; databases, auth and Caddy stay in place.
"${compose[@]}" up -d --no-build --no-deps --wait --wait-timeout 300 backend frontend
"${compose[@]}" ps
for service in postgres keycloak-postgres keycloak backend frontend caddy; do
  container_id=$("${compose[@]}" ps -q "$service")
  health=$(docker inspect -f '{{if .State.Health}}{{.State.Health.Status}}{{else}}missing{{end}}' "$container_id")
  if [[ "$health" != healthy ]]; then
    printf 'Service %s is %s, not healthy.\n' "$service" "$health" >&2
    exit 1
  fi
done
for name in backend frontend; do
  container_id=$("${compose[@]}" ps -q "$name")
  actual=$(docker inspect -f '{{.Image}}' "$container_id")
  expected=$(docker image inspect -f '{{.Id}}' "mormbathie/oumou-salamat-$name:$APP_VERSION")
  if [[ "$actual" != "$expected" ]]; then
    printf 'Running %s image differs from the selected tag.\n' "$name" >&2
    exit 1
  fi
done

app_url=https://assakina-school.com
curl --fail --silent --show-error --retry 5 --retry-delay 2 "$app_url/api/health" > /dev/null
frontend_id=$("${compose[@]}" ps -q frontend)
served_html=$(mktemp)
trap 'rm -f -- "$marker" "$served_html"' EXIT
curl --fail --silent --show-error --header 'Cache-Control: no-cache' "$app_url/?deploy=$APP_VERSION" > "$served_html"
if ! docker exec "$frontend_id" cat /usr/share/nginx/html/index.html | cmp -s - "$served_html"; then
  printf 'Public frontend HTML differs from the running image.\n' >&2
  exit 1
fi
"${compose[@]}" logs --tail=50 backend frontend keycloak caddy
printf 'Production application is healthy at Git SHA %s.\n' "$APP_VERSION"
