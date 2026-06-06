#!/bin/sh
# Rewrite the dashboard's runtime config from env on container start.
# Same shape as packages/app/public/config.js; no rebuild needed.
set -e

: "${KINORA_BASE_URL:=}"
: "${KINORA_MODE:=static}"
: "${KINORA_TITLE:=Kinora}"
: "${KINORA_VIEWER_URL:=/trace/}"

cat > /usr/share/nginx/html/config.js <<EOF
window.__KINORA__ = {
  baseUrl: '${KINORA_BASE_URL}',
  mode: '${KINORA_MODE}',
  title: '${KINORA_TITLE}',
  viewerBaseUrl: '${KINORA_VIEWER_URL}',
};
EOF

if [ -z "$KINORA_BASE_URL" ]; then
  echo "kinora: KINORA_BASE_URL is empty - dashboard has no data source. Set -e KINORA_BASE_URL=https://..." >&2
fi
