"""
OneLink IoT Gateway — Serial Handler
Manages USB serial connections to Arduino and ESP32 devices.
Parses incoming data from hardware and emits structured events.
"""

import serial
import serial.tools.list_ports
import threading
import time
import logging
import json
from typing import Optional, Callable, Dict, Any
from config import SERIAL_DEVICES, CARD_USERS

logger = logging.getLogger("onelink.serial")


class SerialDevice:
    """Manages a single serial device connection with auto-reconnect."""

    def __init__(self, name: str, port: str, baud: int, timeout: int = 1):
        self.name = name
        self.port = port
        self.baud = baud
        self.timeout = timeout
        self.connection: Optional[serial.Serial] = None
        self.is_connected = False
        self._on_data: Optional[Callable] = None
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._max_retries = 5
        self._retry_count = 0

    def on_data(self, callback: Callable[[str, str], None]):
        """Register callback: callback(device_name, data_string)"""
        self._on_data = callback

    def connect(self) -> bool:
        """Attempt to connect to the serial device."""
        try:
            self.connection = serial.Serial(
                port=self.port,
                baudrate=self.baud,
                timeout=self.timeout,
                write_timeout=2
            )
            self.is_connected = True
            self._retry_count = 0
            logger.info(f"✅ {self.name} connected on {self.port} @ {self.baud} baud")
            return True
        except Exception as e:
            self._retry_count += 1
            logger.warning(f"❌ {self.name} connection failed ({self._retry_count}/{self._max_retries}): {e}")
            self.is_connected = False
            return False

    def start_monitoring(self):
        """Start a background thread to read from the serial device."""
        self._running = True
        self._thread = threading.Thread(target=self._monitor_loop, daemon=True)
        self._thread.start()
        logger.info(f"📡 {self.name} monitoring started")

    def _monitor_loop(self):
        """Continuously read from serial device with auto-reconnect."""
        while self._running:
            try:
                if not self.is_connected or not self.connection:
                    if self._retry_count < self._max_retries:
                        self.connect()
                    else:
                        time.sleep(10)  # Wait longer after max retries
                        self._retry_count = 0  # Reset to try again
                    time.sleep(2)
                    continue

                if self.connection.in_waiting:
                    raw = self.connection.readline()
                    data = raw.decode('utf-8', errors='replace').strip()
                    if data:
                        logger.debug(f"📨 {self.name}: {data}")
                        if self._on_data:
                            self._on_data(self.name, data)

                time.sleep(0.1)  # 100ms poll interval

            except serial.SerialException as e:
                logger.error(f"🔌 {self.name} serial error: {e}")
                self.is_connected = False
                self.connection = None
                time.sleep(2)

            except Exception as e:
                logger.error(f"❌ {self.name} monitoring error: {e}")
                time.sleep(1)

    def send(self, data: str) -> bool:
        """Send a command to the device."""
        try:
            if self.connection and self.is_connected:
                self.connection.write(f"{data}\n".encode('utf-8'))
                logger.debug(f"📤 {self.name} sent: {data}")
                return True
            else:
                logger.warning(f"⚠️ {self.name} not connected, cannot send")
                return False
        except Exception as e:
            logger.error(f"❌ {self.name} send error: {e}")
            self.is_connected = False
            return False

    def stop(self):
        """Stop monitoring and close connection."""
        self._running = False
        if self.connection:
            try:
                self.connection.close()
            except:
                pass
        logger.info(f"🛑 {self.name} stopped")


class SerialManager:
    """Manages all serial device connections and parses their data."""

    def __init__(self):
        self.devices: Dict[str, SerialDevice] = {}
        self._event_callback: Optional[Callable] = None

    def on_event(self, callback: Callable[[str, Dict[str, Any]], None]):
        """Register unified event callback: callback(event_type, event_data)"""
        self._event_callback = callback

    def initialize(self):
        """Initialize all configured serial devices."""
        logger.info("🔧 Initializing serial devices...")

        # List available ports
        available = [p.device for p in serial.tools.list_ports.comports()]
        logger.info(f"Available ports: {available}")

        for name, config in SERIAL_DEVICES.items():
            device = SerialDevice(name, config["port"], config["baud"], config["timeout"])
            device.on_data(self._handle_raw_data)
            device.start_monitoring()
            self.devices[name] = device

        logger.info(f"✅ Initialized {len(self.devices)} serial devices")

    def _handle_raw_data(self, device_name: str, data: str):
        """Parse raw serial data from devices into structured events."""

        if device_name == "metro":
            self._parse_metro_data(data)
        elif device_name == "parking":
            self._parse_parking_data(data)
        elif device_name == "esp32":
            self._parse_esp32_data(data)

    def _parse_metro_data(self, data: str):
        """Parse metro Arduino data: 'UID:A97432', 'CARD:A97432:ENTRY', or 'PAIR:UID:TOKEN'"""
        try:
            if data.startswith("PAIR:"):
                parts = data.replace("PAIR:", "").strip().split(":")
                if len(parts) >= 2:
                    card_uid = parts[0].strip().upper()
                    pairing_token = parts[1].strip()
                    if self._event_callback:
                        self._event_callback("card_pair", {
                            "deviceId": "ARDUINO_METRO_01",
                            "cardUid": card_uid,
                            "pairingToken": pairing_token,
                        })
                    logger.info(f"🔗 Pair request: card {card_uid}")
                return

            if "UID:" in data or "CARD:" in data:
                parts = data.replace("UID:", "").replace("CARD:", "").strip().split(":")
                card_uid = parts[0].strip().upper()

                tap_type = "ENTRY"
                if len(parts) > 1:
                    tap_type = parts[1].strip().upper()

                # Always route taps through the cloud — pairing and access are enforced server-side
                if self._event_callback:
                    self._event_callback("transit_tap", {
                        "deviceId": "ARDUINO_METRO_01",
                        "cardUid": card_uid,
                        "gateId": "GATE_01",
                        "tapType": tap_type,
                        "station": "Central Station",
                    })

                logger.info(f"🚇 Metro tap forwarded: {card_uid} — {tap_type}")

        except Exception as e:
            logger.error(f"Metro parse error: {e}")

    def _parse_parking_data(self, data: str):
        """Parse parking Arduino data."""
        try:
            if "Welcome" in data and "Assigned to Parking Spot" in data:
                user_name = data.split("Welcome")[1].split("!")[0].strip()
                spot_id = data.split("Parking Spot")[1].strip()
                card_uid = self._find_uid_by_name(user_name)

                if self._event_callback:
                    self._event_callback("parking_entry", {
                        "deviceId": "ARDUINO_PARKING_01",
                        "cardUid": card_uid,
                        "spotId": spot_id,
                        "eventType": "ENTRY",
                    })

            elif "Goodbye" in data and "Duration:" in data:
                user_name = data.split("Goodbye")[1].split("!")[0].strip()
                card_uid = self._find_uid_by_name(user_name)

                if self._event_callback:
                    self._event_callback("parking_exit", {
                        "deviceId": "ARDUINO_PARKING_01",
                        "cardUid": card_uid,
                        "spotId": "",
                        "eventType": "EXIT",
                    })

            elif "Card detected:" in data:
                card_uid = data.split("Card detected:")[1].strip()
                logger.info(f"🅿️ Parking card detected: {card_uid}")

        except Exception as e:
            logger.error(f"Parking parse error: {e}")

    def _parse_esp32_data(self, data: str):
        """Parse ESP32 NFC data: 'USER:Name|UID:CardUID|ACTION:PAYMENT_SUCCESS|AMOUNT:100.00|TYPE:SHOPPING|TIME:HH:MM:SS'"""
        try:
            if "|" in data and "ACTION:" in data:
                parts = {}
                for segment in data.split("|"):
                    if ":" in segment:
                        key, value = segment.split(":", 1)
                        parts[key.strip()] = value.strip()

                if parts.get("ACTION") == "PAYMENT_SUCCESS":
                    if self._event_callback:
                        self._event_callback("payment_result", {
                            "requestId": f"hw_{int(time.time())}",
                            "cardUid": parts.get("UID", ""),
                            "status": "SUCCESS",
                            "amount": float(parts.get("AMOUNT", "0")),
                            "newBalance": 0,  # Cloud will calculate
                            "transactionId": f"txn_hw_{int(time.time())}",
                        })

                    logger.info(f"💳 ESP32 payment: {parts.get('USER')} — ₹{parts.get('AMOUNT')}")

            elif "Card detected:" in data:
                card_uid = data.split("Card detected:")[1].strip()
                logger.info(f"📱 ESP32 card detected: {card_uid}")

        except Exception as e:
            logger.error(f"ESP32 parse error: {e}")

    def _find_uid_by_name(self, name: str) -> str:
        """Reverse lookup: user name → card UID"""
        for uid, info in CARD_USERS.items():
            if info["name"].upper() == name.upper():
                return uid
        return "UNKNOWN"

    def send_to_device(self, device_name: str, command: str) -> bool:
        """Send a command to a specific device."""
        if device_name in self.devices:
            return self.devices[device_name].send(command)
        logger.warning(f"Device {device_name} not found")
        return False

    def get_status(self) -> Dict[str, bool]:
        """Get connection status of all devices."""
        return {name: dev.is_connected for name, dev in self.devices.items()}

    def shutdown(self):
        """Stop all devices."""
        for device in self.devices.values():
            device.stop()
        logger.info("🛑 All serial devices stopped")
