#!/bin/sh
# Evaluation entrypoint for the public AppEndO-Release layout.
#
# The server reads settings.json, prisma/, and packages-storage from its
# working directory, and renames a temp file onto settings.json. That rename
# replaces a symlink, so the working directory itself lives on the data volume.
# dist/server.cjs is externalized. Node resolves modules from the real path
# /opt/appendo/dist/server.cjs, so node_modules is also linked at /opt/appendo.
set -eu

RELEASE_ROOT=/opt/appendo
SOURCE_ROOT="${APPENDO_SOURCE_ROOT:-$RELEASE_ROOT/source}"
DATA_ROOT="${APPENDO_DATA_ROOT:-/var/lib/appendo}"
RUN_ROOT="$DATA_ROOT/run"
export APPENDO_SOURCE_ROOT="$SOURCE_ROOT"
export APPENDO_DATA_ROOT="$DATA_ROOT"

mkdir -p "$RUN_ROOT"

seed_volume_dir() {
  name="$1"
  dest="$RUN_ROOT/$name"
  src="$SOURCE_ROOT/$name"
  if [ -d "$dest" ] && [ -n "$(ls -A "$dest" 2>/dev/null || true)" ]; then
    return
  fi
  mkdir -p "$dest"
  if [ -d "$src" ] && [ -n "$(ls -A "$src" 2>/dev/null || true)" ]; then
    cp -a "$src/." "$dest/"
  fi
}

# Installed packages and studio files must survive container recreation.
seed_volume_dir workspace
seed_volume_dir packages-storage

for entry in "$SOURCE_ROOT"/* "$SOURCE_ROOT"/.[!.]* "$SOURCE_ROOT"/..?*; do
  [ -e "$entry" ] || continue
  base=$(basename "$entry")
  case "$base" in
    settings.json|workspace|packages-storage|node_modules|dist|.git) continue ;;
  esac
  if [ ! -e "$RUN_ROOT/$base" ]; then
    ln -s "$entry" "$RUN_ROOT/$base"
  fi
done

# Realpath of dist/server.cjs is /opt/appendo/dist/server.cjs. Dependencies
# installed under source/node_modules are visible from that path only if
# /opt/appendo/node_modules points at them.
ln -sfn "$SOURCE_ROOT/node_modules" "$RUN_ROOT/node_modules"
ln -sfn "$SOURCE_ROOT/node_modules" "$RELEASE_ROOT/node_modules"
ln -sfn "$RELEASE_ROOT/dist" "$RUN_ROOT/dist"

KEY_FILE="$DATA_ROOT/credential-master-key"
if [ -z "${APPENDO_CREDENTIAL_MASTER_KEY:-}" ]; then
  if [ ! -s "$KEY_FILE" ]; then
    openssl rand -hex 32 > "$KEY_FILE"
    chmod 600 "$KEY_FILE"
    echo "[appendo] Wrote a new APPENDO_CREDENTIAL_MASTER_KEY on the data volume (credential-master-key)."
    echo "[appendo] Save that file with your other deploy secrets. This log does not print the key."
  fi
  APPENDO_CREDENTIAL_MASTER_KEY="$(cat "$KEY_FILE")"
  export APPENDO_CREDENTIAL_MASTER_KEY
fi

if [ -z "${PGPASSWORD:-}" ]; then
  echo "[appendo] PGPASSWORD is empty. Set it to the PostgreSQL password before starting."
  exit 1
fi
export PGPASSWORD

node "$RELEASE_ROOT/docker/prepare-settings.mjs" wait
node "$RELEASE_ROOT/docker/prepare-settings.mjs" init

SETTINGS_FILE="$RUN_ROOT/settings.json"
needs_setup=0
if ! node -e '
const fs = require("node:fs");
const settings = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
const install = settings.install && typeof settings.install === "object" ? settings.install : {};
process.exit(install.completedAt ? 0 : 2);
' "$SETTINGS_FILE"; then
  needs_setup=1
fi

if [ "$needs_setup" = "1" ]; then
  echo "[appendo] First boot: running PostgreSQL greenfield setup (npm run setup)."
  cd "$RUN_ROOT"
  npm run setup
else
  echo "[appendo] Data volume is already installed. Skipping setup."
fi

node "$RELEASE_ROOT/docker/prepare-settings.mjs" promote

cd "$RUN_ROOT"
exec node "$RELEASE_ROOT/dist/server.cjs"
