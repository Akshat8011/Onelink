#!/usr/bin/env python3
"""
OneLink Pi Brain — MQTT RFID listener + WebSocket bridge for kiosk UI.

Flow:
  1. ESP32 publishes tap JSON to PUBLIC MQTT (broker.emqx.io by default)
     topic onelink/hardware/tap — Pi IP is never required in firmware
  2. ESP32 also publishes heartbeat to onelink/hardware/heartbeat (~30s)
  3. brain.py broadcasts card_tap + brain_status to kiosk via WebSocket (:8765)
  4. Kiosk UI handles pairing, service selection, and payment via Vercel APIs

Optional: set AUTO_PAY=1 to charge immediately on tap (legacy direct mode).

Resilience:
  - MQTT: on_disconnect logging + paho auto-reconnect with exponential backoff (cap 30s)
  - WebSocket server: restart loop on failure
  - systemd: optional sd_notify READY + WATCHDOG heartbeats when NOTIFY_SOCKET is set
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from datetime import datetime, timezone

import paho.mqtt.client as mqtt
import websockets

# Optional systemd watchdog (stdlib on Raspberry Pi OS when running under systemd)
try:
    import systemd.daemon  # type: ignore

    _HAS_SYSTEMD = True
except ImportError:
    systemd = None  # type: ignore
    _HAS_SYSTEMD = False

# --- HARDWARE CONFIGURATION ---
# Default to the public EMQX broker so ESP32 and Pi share a stable endpoint
# even when the Pi's hotspot DHCP address changes. Override with MQTT_BROKER
# for a local Mosquitto lab setup (e.g. 127.0.0.1).
MQTT_BROKER = os.environ.get("MQTT_BROKER", "broker.emqx.io")
MQTT_PORT = int(os.environ.get("MQTT_PORT", "1883"))
MQTT_TOPIC = os.environ.get("MQTT_TOPIC", "onelink/hardware/tap")
MQTT_TOPIC_HEARTBEAT = os.environ.get(
    "MQTT_TOPIC_HEARTBEAT", "onelink/hardware/heartbeat"
)
# Bind to 0.0.0.0 so both the Pi's own screen (via localhost) and other
# displays on the LAN (e.g. a tablet using the Pi's IP) can connect.
WS_HOST = os.environ.get("KIOSK_WS_HOST", "0.0.0.0")
WS_PORT = int(os.environ.get("KIOSK_WS_PORT", "8765"))
DEFAULT_TERMINAL = os.environ.get("DEFAULT_TERMINAL", "main_kiosk")
AUTO_PAY = os.environ.get("AUTO_PAY", "0") == "1"

WEBAPP_API_URL = os.environ.get(
    "WEBAPP_API_URL",
    "https://onelink-wine-psi.vercel.app/api/hardware-tap",
)
API_KEY = os.environ.get("HARDWARE_TAP_API_KEY", "")

MQTT_RECONNECT_MIN = 1
MQTT_RECONNECT_MAX = 30
WS_RESTART_DELAY_SEC = 3
WATCHDOG_INTERVAL_SEC = 15
STATUS_BROADCAST_SEC = 10
# Kiosk treats RFID path as alive if heartbeat/tap seen within this window.
RFID_SEEN_WINDOW_SEC = 90

# Connected kiosk browser clients
ws_clients: set = set()
_mqtt_client: mqtt.Client | None = None
_shutdown = threading.Event()
_mqtt_ok = False
_last_tap_at: float | None = None
_last_heartbeat_at: float | None = None
_status_lock = threading.Lock()

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)sZ %(levelname)s [brain] %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
# Force UTC timestamps in logs for proof scripts
logging.Formatter.converter = time.gmtime
log = logging.getLogger("brain")


def _ts() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def _iso(ts: float | None) -> str | None:
    if ts is None:
        return None
    return datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def sd_notify(message: str) -> None:
    """Send sd_notify if running under systemd with NOTIFY_SOCKET set."""
    if not _HAS_SYSTEMD or not os.environ.get("NOTIFY_SOCKET"):
        return
    try:
        systemd.daemon.notify(message)
    except Exception as exc:
        log.warning("sd_notify failed: %s", exc)


def watchdog_loop():
    """Periodic WATCHDOG=1 for systemd Type=notify + WatchdogSec."""
    while not _shutdown.is_set():
        sd_notify("WATCHDOG=1")
        _shutdown.wait(WATCHDOG_INTERVAL_SEC)


def brain_status_payload() -> dict:
    with _status_lock:
        mqtt_ok = _mqtt_ok
        last_tap = _last_tap_at
        last_hb = _last_heartbeat_at
    now = time.time()
    recent = False
    for ts in (last_tap, last_hb):
        if ts is not None and (now - ts) <= RFID_SEEN_WINDOW_SEC:
            recent = True
            break
    return {
        "event": "brain_status",
        "mqttOk": mqtt_ok,
        "rfidSeenRecently": recent,
        "broker": MQTT_BROKER,
        "lastTapAt": _iso(last_tap),
        "lastHeartbeatAt": _iso(last_hb),
    }


def _schedule_broadcast(message: dict) -> None:
    loop = getattr(broadcast_card_tap, "_loop", None)
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(ws_broadcast(message), loop)


def broadcast_brain_status() -> None:
    _schedule_broadcast(brain_status_payload())


async def ws_register(websocket):
    ws_clients.add(websocket)
    try:
        await websocket.send(json.dumps({"event": "brain_online"}))
        await websocket.send(json.dumps(brain_status_payload()))
        async for _ in websocket:
            pass
    finally:
        ws_clients.discard(websocket)


async def ws_broadcast(message: dict):
    if not ws_clients:
        return
    payload = json.dumps(message)
    dead = []
    for client in ws_clients:
        try:
            await client.send(payload)
        except Exception:
            dead.append(client)
    for client in dead:
        ws_clients.discard(client)


async def status_broadcast_loop():
    """Push brain_status so kiosk can expire stale RFID heartbeats."""
    while not _shutdown.is_set():
        await ws_broadcast(brain_status_payload())
        await asyncio.sleep(STATUS_BROADCAST_SEC)


def broadcast_card_tap(uid: str, node: str):
    """Thread-safe broadcast from MQTT callback into asyncio loop."""
    loop = getattr(broadcast_card_tap, "_loop", None)
    if loop and loop.is_running():
        asyncio.run_coroutine_threadsafe(
            ws_broadcast(
                {
                    "event": "card_tap",
                    "cardUid": uid.upper(),
                    "terminalId": node,
                    "node": node,
                }
            ),
            loop,
        )


def auto_pay(uid: str, node: str):
    """Legacy mode: POST directly to hardware-tap (no kiosk UI)."""
    import requests

    if not API_KEY:
        log.error("AUTO_PAY enabled but HARDWARE_TAP_API_KEY is not set")
        return

    payload = {"cardUid": uid, "terminalId": node}
    headers = {
        "Authorization": f"Bearer {API_KEY}",
        "Content-Type": "application/json",
    }
    try:
        response = requests.post(WEBAPP_API_URL, json=payload, headers=headers, timeout=15)
        log.info("AUTO_PAY HTTP %s: %s", response.status_code, response.text[:200])
    except requests.exceptions.RequestException as exc:
        log.error("Cloud sync failed: %s", exc)


def on_connect(client, userdata, flags, rc, properties=None):
    global _mqtt_ok
    if rc != 0:
        log.error("MQTT connect failed (rc=%s)", rc)
        with _status_lock:
            _mqtt_ok = False
        broadcast_brain_status()
        return
    with _status_lock:
        _mqtt_ok = True
    log.info("MQTT connected to %s:%s", MQTT_BROKER, MQTT_PORT)
    client.subscribe(MQTT_TOPIC)
    client.subscribe(MQTT_TOPIC_HEARTBEAT)
    log.info("MQTT subscribed: %s, %s", MQTT_TOPIC, MQTT_TOPIC_HEARTBEAT)
    log.info("WebSocket: ws://%s:%s", WS_HOST, WS_PORT)
    log.info(
        "Kiosk mode: %s",
        "AUTO_PAY (direct API)" if AUTO_PAY else "UI-driven (open /kiosk in browser)",
    )
    broadcast_brain_status()


def on_disconnect(client, userdata, *args):
    global _mqtt_ok
    rc = args[-1] if args else "unknown"
    with _status_lock:
        _mqtt_ok = False
    log.warning("MQTT disconnected (rc=%s) — auto-reconnect will retry with backoff", rc)
    broadcast_brain_status()


def on_message(client, userdata, msg):
    global _last_tap_at, _last_heartbeat_at
    topic = msg.topic or ""
    try:
        data = json.loads(msg.payload.decode("utf-8"))
    except json.JSONDecodeError:
        log.error("Corrupted JSON from ESP32 on %s", topic)
        return

    if topic == MQTT_TOPIC_HEARTBEAT or topic.endswith("/heartbeat"):
        with _status_lock:
            _last_heartbeat_at = time.time()
        node = data.get("node") or DEFAULT_TERMINAL
        log.info("RFID heartbeat from %s (readerOk=%s)", node, data.get("readerOk"))
        broadcast_brain_status()
        return

    uid = data.get("uid")
    node = data.get("node") or DEFAULT_TERMINAL

    if not uid:
        log.error("Missing uid in MQTT payload: %s", data)
        return

    uid = uid.strip().upper()
    with _status_lock:
        _last_tap_at = time.time()
        # A tap also proves the RFID path is alive.
        _last_heartbeat_at = _last_tap_at
    log.info("CARD TAP: %s @ %s", uid, node)
    broadcast_brain_status()

    if AUTO_PAY:
        auto_pay(uid, node)
    else:
        broadcast_card_tap(uid, node)
        if not ws_clients:
            log.warning(
                "No kiosk browser connected (open http://onelink.local:8080/kiosk or local /kiosk)"
            )


def _make_mqtt_client() -> mqtt.Client:
    try:
        client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
    except AttributeError:
        client = mqtt.Client()
    client.on_connect = on_connect
    client.on_disconnect = on_disconnect
    client.on_message = on_message
    # Exponential backoff: 1s .. 30s (paho handles reconnect after disconnect)
    try:
        client.reconnect_delay_set(min_delay=MQTT_RECONNECT_MIN, max_delay=MQTT_RECONNECT_MAX)
    except Exception as exc:
        log.warning("reconnect_delay_set not available: %s", exc)
    return client


def mqtt_thread():
    """MQTT loop with initial-connect retry (broker may not be ready at boot)."""
    global _mqtt_client, _mqtt_ok
    attempt = 0
    while not _shutdown.is_set():
        attempt += 1
        client = _make_mqtt_client()
        _mqtt_client = client
        try:
            log.info("MQTT connect attempt %s to %s:%s", attempt, MQTT_BROKER, MQTT_PORT)
            client.connect(MQTT_BROKER, MQTT_PORT, 60)
            attempt = 0  # reset after successful connect
            client.loop_forever()
        except Exception as exc:
            if _shutdown.is_set():
                break
            delay = min(MQTT_RECONNECT_MAX, MQTT_RECONNECT_MIN * (2 ** min(attempt - 1, 5)))
            log.error("MQTT loop exited: %s — retry in %ss", exc, delay)
            with _status_lock:
                _mqtt_ok = False
            broadcast_brain_status()
            try:
                client.loop_stop()
                client.disconnect()
            except Exception:
                pass
            _shutdown.wait(delay)
        finally:
            _mqtt_client = None


async def ws_main():
    """WebSocket server; restarts on unexpected failure."""
    while not _shutdown.is_set():
        try:
            async with websockets.serve(ws_register, WS_HOST, WS_PORT, ping_interval=20, ping_timeout=20):
                log.info("WebSocket server listening on ws://%s:%s", WS_HOST, WS_PORT)
                sd_notify("READY=1")
                status_task = asyncio.create_task(status_broadcast_loop())
                try:
                    await asyncio.Future()
                finally:
                    status_task.cancel()
                    try:
                        await status_task
                    except asyncio.CancelledError:
                        pass
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if _shutdown.is_set():
                break
            log.error("WebSocket server error: %s — restart in %ss", exc, WS_RESTART_DELAY_SEC)
            await asyncio.sleep(WS_RESTART_DELAY_SEC)


def main():
    log.info("OneLink Brain starting at %s", _ts())
    log.info("MQTT broker default/public: %s:%s", MQTT_BROKER, MQTT_PORT)
    sd_notify("STATUS=Starting OneLink Brain")

    watchdog = threading.Thread(target=watchdog_loop, name="brain-watchdog", daemon=True)
    if os.environ.get("NOTIFY_SOCKET"):
        watchdog.start()

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    broadcast_card_tap._loop = loop

    mqtt_worker = threading.Thread(target=mqtt_thread, name="brain-mqtt", daemon=True)
    mqtt_worker.start()

    try:
        loop.run_until_complete(ws_main())
    except KeyboardInterrupt:
        log.info("Shutdown requested")
    finally:
        _shutdown.set()
        if _mqtt_client:
            try:
                _mqtt_client.loop_stop()
                _mqtt_client.disconnect()
            except Exception:
                pass
        sd_notify("STOPPING=1")
        log.info("OneLink Brain stopped at %s", _ts())


if __name__ == "__main__":
    main()
