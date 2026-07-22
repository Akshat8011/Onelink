# OneLink

Campus super-app that unifies **wallet, transit, parking, canteen, and IoT card taps** into one product — with a React Native / Expo app, Node.js cloud backend, MQTT RFID hardware, and a Raspberry Pi kiosk.

**Live demo:** [https://onelink-wine-psi.vercel.app](https://onelink-wine-psi.vercel.app)

## Highlights

- NFC / RFID card wallet payments at physical kiosks
- Metro, bus, parking, EV charging, and canteen flows in one mobile experience
- Cloud backend with MongoDB, JWT auth, Socket.IO, and MQTT IoT gateway
- Raspberry Pi bridge (`hardware/pi`) for readers + local kiosk UI
- Hardened payment paths: balance checks, idempotency, and transactional integrity

## Tech stack

| Layer | Technologies |
| --- | --- |
| Mobile / Web | React Native, Expo, TypeScript, Zustand |
| Backend | Node.js, Express, MongoDB, MQTT, Socket.IO |
| Edge | Raspberry Pi, Python, systemd services |
| Hardware | ESP32 / RFID readers via MQTT |

## Repository structure

```
backend/        Cloud API, wallet, transit, parking, MQTT gateway
mobile/         Expo app + kiosk web UI
hardware/pi/    Pi brain, kiosk services
iot-gateway/    Serial ↔ MQTT bridge
quickcomm/      Quick-commerce related modules
scraper/        Data enrichment utilities
docs/           Architecture and hardening notes
```

## Quick start

### Backend

```bash
cd backend
cp .env.example .env   # add MongoDB, JWT, MQTT settings
npm install
npm run dev
```

### Mobile / web

```bash
cd mobile
npm install
npm start              # Expo
# or
npm run build          # export web + kiosk assets
```

### Raspberry Pi bridge

```bash
cd hardware/pi
python -m venv .venv
.venv\Scripts\activate   # or source .venv/bin/activate
pip install -r requirements.txt
python brain.py
```

## Architecture (high level)

```
Mobile App ──► Cloud API (Express + MongoDB)
                  │
                  ├── Socket.IO (live updates)
                  └── MQTT Gateway
                          │
              Raspberry Pi brain ◄── RFID / ESP32 readers
                          │
                     Kiosk UI (local)
```

## Docs

- [Engineering hardening report](docs/OneLink-Engineering-Hardening-Report.md)
- [Proofs](docs/proofs/)

## Author

**Akshat Choudhary** — Electrical Engineering + Software  
GitHub: [Akshat8011](https://github.com/Akshat8011)

## Hosting notes (Render free tier)

The cloud backend (`onelink-fkqd.onrender.com`) uses Render’s **free** web service pool (**750 instance hours / workspace / month**, shared with other free services such as bbau-connect).

- Free services **sleep after ~15 minutes with no traffic**. Sleeping does **not** burn hours.
- OneLink intentionally **does not** ping the backend on a timer. Warm-up runs only when the app or kiosk is opened / touched, so demos stay snappy without keeping the server awake 24/7.
- **Do not** add UptimeRobot, cron jobs, or other external monitors that hit the Render URLs every few minutes — that forces the service to stay awake and will exhaust the monthly quota (both OneLink and other free services in the workspace get suspended).

## License

Private / all rights reserved unless otherwise noted.
