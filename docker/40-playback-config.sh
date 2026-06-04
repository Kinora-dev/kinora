#!/bin/sh
# Rewrite the dashboard's runtime config from env on container start.
# Same shape as packages/app/public/config.js; no rebuild needed.
set -e

: "${PLAYBACK_BASE_URL:=}"
: "${PLAYBACK_MODE:=static}"
: "${PLAYBACK_TITLE:=Playback}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__PLAYBACK__ = {
  baseUrl: '${PLAYBACK_BASE_URL}',
  mode: '${PLAYBACK_MODE}',
  title: '${PLAYBACK_TITLE}',
};
EOF

if [ -z "$PLAYBACK_BASE_URL" ]; then
  echo "playback: PLAYBACK_BASE_URL is empty - dashboard has no data source. Set -e PLAYBACK_BASE_URL=https://..." >&2
fi
