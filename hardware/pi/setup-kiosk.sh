#!/bin/bash
# OneLink Pi — install local kiosk UI (fixes HTTPS → WebSocket blocked issue)
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_KIOSK=""
# Prefer sibling repo checkout when running from a cloned Onelink tree
if [ -f "$SCRIPT_DIR/../../mobile/public/kiosk/index.html" ]; then
  REPO_KIOSK="$(cd "$SCRIPT_DIR/../../mobile/public/kiosk" && pwd)"
fi

KIOSK_DIR="${KIOSK_DIR:-$HOME/kiosk}"
mkdir -p "$KIOSK_DIR"

if [ -n "$REPO_KIOSK" ]; then
  echo "Copying kiosk UI from repo: $REPO_KIOSK"
  cp -f "$REPO_KIOSK/index.html" "$REPO_KIOSK/styles.css" "$REPO_KIOSK/app.js" \
        "$REPO_KIOSK/sounds.js" "$REPO_KIOSK/canteen-menu.js" "$KIOSK_DIR/" 2>/dev/null || true
else
  echo "Downloading kiosk page from GitHub…"
  curl -fsSL "https://raw.githubusercontent.com/Akshat8011/Onelink/main/mobile/public/kiosk/index.html" \
    -o "$KIOSK_DIR/index.html" 2>/dev/null || {
    echo "Could not download from GitHub. Copy kiosk files to $KIOSK_DIR manually."
  }
fi

# Hostname / mDNS helper (idempotent)
if [ -x "$SCRIPT_DIR/setup-network.sh" ]; then
  bash "$SCRIPT_DIR/setup-network.sh" onelink || true
elif [ -f "$SCRIPT_DIR/setup-network.sh" ]; then
  chmod +x "$SCRIPT_DIR/setup-network.sh"
  bash "$SCRIPT_DIR/setup-network.sh" onelink || true
fi

# Document public MQTT for brain service
ENV_DIR=/etc/onelink
if [ -f "$SCRIPT_DIR/brain.env.example" ]; then
  sudo mkdir -p "$ENV_DIR"
  if [ ! -f "$ENV_DIR/brain.env" ]; then
    sudo cp "$SCRIPT_DIR/brain.env.example" "$ENV_DIR/brain.env"
    echo "Created $ENV_DIR/brain.env (MQTT_BROKER=broker.emqx.io)"
  else
    echo "Keeping existing $ENV_DIR/brain.env — ensure MQTT_BROKER=broker.emqx.io"
  fi
fi

CURRENT_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "Kiosk files ready in $KIOSK_DIR"
echo "Open on the tablet (HTTP, not HTTPS):"
echo "  http://onelink.local:8080/kiosk"
if [ -n "${CURRENT_IP}" ]; then
  echo "  http://${CURRENT_IP}:8080/kiosk   (if mDNS unavailable)"
fi
echo ""
echo "Restart brain after pull:"
echo "  sudo systemctl restart onelink-brain"
echo "Expect header status: RFID Ready (after ESP32 heartbeat ~30s)."
