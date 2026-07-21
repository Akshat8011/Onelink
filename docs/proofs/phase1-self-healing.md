# Phase 1 — Self-Healing Proof Checklist

Repo-only checkpoint. **Measured recovery times must be filled in from a real Pi run** — do not invent numbers.

## Prerequisites (on Raspberry Pi)

```bash
# Copy service templates (adjust paths if your clone lives elsewhere)
sudo cp hardware/pi/onelink-brain.service /etc/systemd/system/
sudo cp hardware/pi/onelink-kiosk-ui.service /etc/systemd/system/
sudo mkdir -p /etc/onelink
# Optional env file for brain.py (MQTT_BROKER, etc.)
sudo touch /etc/onelink/brain.env

sudo systemctl daemon-reload
sudo systemctl enable onelink-brain.service onelink-kiosk-ui.service
sudo systemctl start onelink-brain.service onelink-kiosk-ui.service
```

## Test A — brain.py restart via systemd

| Step | Command / action | Timestamp (UTC) | Notes |
|------|------------------|-----------------|-------|
| 1 | `sudo systemctl status onelink-brain.service` | __________ | Confirm `active (running)` |
| 2 | Record PID: `systemctl show -p MainPID onelink-brain.service` | __________ | PID = ______ |
| 3 | Kill process: `sudo kill -9 <MainPID>` | __________ | T_kill |
| 4 | Wait for restart: `watch -n1 systemctl is-active onelink-brain.service` | __________ | T_recovered |
| 5 | **Recovery time** = T_recovered − T_kill | __________ | **_____ seconds** |

Expected: service returns to `active` within a few seconds (`RestartSec=3`).

Logs:

```bash
sudo journalctl -u onelink-brain.service --since "5 min ago" --no-pager
```

Look for: `MQTT connected`, `WebSocket server listening`, `WATCHDOG=1` (if Type=notify).

## Test B — MQTT broker interruption

| Step | Command / action | Timestamp (UTC) | Notes |
|------|------------------|-----------------|-------|
| 1 | Stop local broker (e.g. `sudo systemctl stop mosquitto`) | __________ | T_drop |
| 2 | Confirm log: `MQTT disconnected` in journalctl | __________ | |
| 3 | Start broker: `sudo systemctl start mosquitto` | __________ | T_restore |
| 4 | Confirm log: `MQTT connected` | __________ | T_mqtt_ok |
| 5 | **MQTT recovery time** = T_mqtt_ok − T_restore | __________ | **_____ seconds** |

## Test C — Kiosk WebSocket reconnect (no page refresh)

1. Open kiosk UI: `http://127.0.0.1:8080/` (or tablet with `?reader=<pi-ip>`).
2. Confirm header shows **Reader Online**.
3. Stop brain: `sudo systemctl stop onelink-brain.service` → header should show **Reader Offline**.
4. Start brain: `sudo systemctl start onelink-brain.service`.
5. **Without refreshing the browser**, confirm Reader Online returns.

| Event | Timestamp (UTC) | Notes |
|-------|-----------------|-------|
| brain stopped | __________ | |
| Reader Offline visible | __________ | |
| brain started | __________ | T_brain_up |
| Reader Online visible (no refresh) | __________ | T_ws_ok |
| **WS client recovery** = T_ws_ok − T_brain_up | __________ | **_____ seconds** |

Browser console should show `[kiosk] WebSocket reconnect #N in …ms`.

## Test D — Card tap during brief outage

1. With brain running and kiosk online, note time.
2. Stop mosquitto for ~10s, tap card (or publish test MQTT message).
3. Restart mosquitto; tap again.
4. Document whether second tap reaches kiosk (expected: yes after MQTT reconnect).

| Attempt | Outcome | Timestamp |
|---------|---------|-----------|
| Tap during outage | __________ | __________ |
| Tap after restore | __________ | __________ |

## Mobile app — demo/offline audit (Phase 1 limitation)

| Store / module | Uses `enableDemoMode` on API failure | Uses exported `tryApi()` | Visible offline/reconnecting UI |
|----------------|--------------------------------------|--------------------------|----------------------------------|
| `useWalletStore` | Yes | No | No |
| `useRetailStore` | Yes | No | No (badge from API payload only) |
| `useMobilityStore` | Yes | No | No |
| `useTransitStore` | Yes | No | No |
| `useCityStore` | Yes | No | No |
| `useTicketsStore` | Checks `isDemoMode` | No | No |
| `useOrdersStore` | Checks `isDemoMode` | No | No |
| `useRewardsStore` | Checks `isDemoMode` | No | No |
| `socket.ts` | N/A | N/A | Status API added (`getConnectionStatus`, `onStatusChange`) — **no screen wired yet** (Phase 1 guardrail: no UI redesign) |

`tryApi()` in `demoMode.ts` is implemented but **not imported by any store**; stores hand-roll try/catch + `enableDemoMode()`.

## ESP32 firmware

**Not in repo.** Watchdog / MQTT reconnect on ESP32 cannot be verified until firmware is added (Sunday backlog item).

## Repo-local syntax checks (run before commit)

```bash
python -m py_compile hardware/pi/brain.py
node --check mobile/public/kiosk/app.js
```

## Evidence commit

After hardware run, paste journalctl excerpts and filled timestamps into this file (or `docs/proofs/phase1-results-<date>.md`) and commit separately.
