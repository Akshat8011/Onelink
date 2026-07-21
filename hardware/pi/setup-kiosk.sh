#!/bin/bash
# OneLink Pi — install local kiosk UI (fixes HTTPS → WebSocket blocked issue)
set -e

KIOSK_DIR="$HOME/kiosk"
mkdir -p "$KIOSK_DIR"

# Download latest kiosk page from GitHub (or copy manually if offline)
curl -fsSL "https://raw.githubusercontent.com/Akshat8011/Onelink/main/mobile/public/kiosk/index.html" \
  -o "$KIOSK_DIR/index.html" 2>/dev/null || {
  echo "Could not download from GitHub. Copy index.html to $KIOSK_DIR/index.html manually."
}

echo "Kiosk files ready in $KIOSK_DIR"
echo "Open in browser: http://127.0.0.1:8080/"
