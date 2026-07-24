#!/bin/bash
# OneLink Pi — hostname + mDNS so the kiosk can use http://onelink.local
# without depending on a changing hotspot DHCP IP.
set -euo pipefail

TARGET_HOST="${1:-onelink}"

echo "==> Setting hostname to ${TARGET_HOST}"
if command -v hostnamectl >/dev/null 2>&1; then
  sudo hostnamectl set-hostname "$TARGET_HOST"
else
  echo "$TARGET_HOST" | sudo tee /etc/hostname >/dev/null
fi

# Keep /etc/hosts consistent for local resolution
if grep -qE '^127\.0\.1\.1\s+' /etc/hosts; then
  sudo sed -i "s/^127\\.0\\.1\\.1.*/127.0.1.1\t${TARGET_HOST}/" /etc/hosts
else
  echo -e "127.0.1.1\t${TARGET_HOST}" | sudo tee -a /etc/hosts >/dev/null
fi

echo "==> Ensuring avahi-daemon (mDNS / .local)"
if command -v apt-get >/dev/null 2>&1; then
  sudo apt-get update -qq
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y -qq avahi-daemon
fi
sudo systemctl enable --now avahi-daemon 2>/dev/null || true

CURRENT_IP="$(hostname -I 2>/dev/null | awk '{print $1}')"
echo ""
echo "Network ready."
echo "  Hostname : ${TARGET_HOST}"
echo "  mDNS     : http://${TARGET_HOST}.local:8080/kiosk"
if [ -n "${CURRENT_IP}" ]; then
  echo "  Current IP (fallback if .local fails on phone hotspot): http://${CURRENT_IP}:8080/kiosk"
fi
echo ""
echo "Note: Card taps use public MQTT (broker.emqx.io), not this IP."
echo "      Only the kiosk browser WebSocket needs onelink.local / this IP."
