# OneLink hardware

RFID taps no longer depend on the Raspberry Pi’s LAN IP. The ESP32 and Pi
`brain.py` both talk to the same public MQTT broker (`broker.emqx.io`). The
kiosk tablet only needs a WebSocket to the Pi (`onelink.local` or the Pi’s
current IP over HTTP).

```
ESP32 (RC522)  --MQTT-->  broker.emqx.io  --MQTT-->  Pi brain.py  --WS-->  Kiosk
                 WiFiManager portal for hotspot SSID/password
```

## One-time ESP32 flash

1. Install Arduino IDE (or PlatformIO) + ESP32 board support.
2. Libraries: **WiFiManager** (tzapu), **PubSubClient** (Nick O’Leary), **MFRC522**.
3. Open [`esp32/onelink_rfid_reader/onelink_rfid_reader.ino`](esp32/onelink_rfid_reader/onelink_rfid_reader.ino).
4. Flash to the ESP32. **Do not put a Pi IP in the sketch.**

### Pin map (MFRC522 SPI)

| RC522 | ESP32 |
|-------|-------|
| SDA (SS) | GPIO 5 |
| SCK | GPIO 18 |
| MOSI | GPIO 23 |
| MISO | GPIO 19 |
| RST | GPIO 27 |
| 3.3V / GND | 3.3V / GND |

PN532: adapt SPI/I2C in firmware; keep the same MQTT topics/payload.

### WiFi portal

- First boot (or hold **BOOT** at reset): join AP `OneLink-Setup`, open the captive portal, enter phone hotspot SSID/password.
- Credentials stay in flash — hotspot password changes only need the portal again, not a reflash.

## Pi brain

```bash
cd hardware/pi
sudo cp brain.env.example /etc/onelink/brain.env   # MQTT_BROKER=broker.emqx.io
# install deps + systemd unit as usual
sudo systemctl restart onelink-brain
```

Optional local Mosquitto lab: set `MQTT_BROKER=127.0.0.1` in `/etc/onelink/brain.env`
(and point ESP32 at that broker only if you intentionally leave the public path).

Hostname / kiosk HTTP:

```bash
bash hardware/pi/setup-network.sh    # hostname onelink + avahi
bash hardware/pi/setup-kiosk.sh      # copy UI + env notes
```

Open the tablet at **`http://onelink.local:8080/kiosk`** (or `http://<pi-ip>:8080/kiosk`).
HTTPS pages cannot open `ws://` to the Pi.

## Verify MQTT

On any machine with mosquitto clients:

```bash
mosquitto_sub -h broker.emqx.io -t 'onelink/hardware/#' -v
```

You should see heartbeats about every 30s and tap JSON like
`{"uid":"A1B2C3D4","node":"main_kiosk"}` when a card is presented.

## Kiosk status meanings

| Status | Meaning |
|--------|---------|
| **RFID Ready** | WebSocket to brain OK **and** recent ESP32 heartbeat/tap |
| **Waiting for RFID** | Brain WS OK, but no ESP32 heartbeat/tap in ~90s (WiFi portal, power, or broker) |
| **Reader Offline** | Cannot reach Pi brain WebSocket (`onelink.local` / IP / mixed content) |

## After merge (operator checklist)

1. Flash new ESP32 firmware.
2. Join hotspot; use `OneLink-Setup` portal if needed.
3. Pull repo on Pi; ensure `MQTT_BROKER=broker.emqx.io`; restart `onelink-brain`.
4. Open kiosk over HTTP; wait ~30s for **RFID Ready**.
5. Never edit Pi IP in ESP32 again.
