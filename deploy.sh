#!/usr/bin/env bash
# SoGoJet VPS deploy script.
# Rebuilds the Expo web bundle and syncs it to nginx's docroot.
# Run from VPS: `bash /root/SwypeFly/deploy.sh`
set -euo pipefail

cd /root/SwypeFly

echo "[deploy] installing deps (if needed)..."
npm ci --no-audit --no-fund --silent || npm install --no-audit --no-fund

echo "[deploy] building web bundle..."
npx expo export --platform web

echo "[deploy] syncing dist/ -> /var/www/sogojet/ ..."
rsync -a --delete dist/ /var/www/sogojet/

echo "[deploy] reloading nginx..."
nginx -t
systemctl reload nginx

echo "[deploy] restarting api (picks up any new handlers)..."
systemctl restart sogojet-api

echo "[deploy] done."
