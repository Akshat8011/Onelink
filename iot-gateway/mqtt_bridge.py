"""
OneLink IoT Gateway — MQTT Bridge
Runs on Raspberry Pi 4B to bridge serial hardware ↔ cloud MQTT broker.

This is the central orchestrator that:
1. Connects to HiveMQ Cloud MQTT broker
2. Reads serial data from Arduino/ESP32 via SerialManager
3. Publishes hardware events to the cloud
4. Subscribes to cloud commands and relays to hardware

Usage:
    python mqtt_bridge.py
"""

import paho.mqtt.client as mqtt
import ssl
import json
import time
import logging
import signal
import sys
import threading
from datetime import datetime
from typing import Dict, Any

from config import (
    MQTT_BROKER, MQTT_PORT, MQTT_USERNAME, MQTT_PASSWORD,
    MQTT_CLIENT_ID, MQTT_USE_TLS, TOPICS, HEARTBEAT_INTERVAL,
    LOG_LEVEL
)
from serial_handler import SerialManager

# ─── Logging Setup ───
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL),
    format='%(asctime)s [%(name)s] %(levelname)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler('/var/log/onelink/gateway.log', mode='a'),
    ]
)
logger = logging.getLogger("onelink.bridge")


class MqttBridge:
    """Bi-directional MQTT ↔ Serial bridge for OneLink IoT."""

    def __init__(self):
        self.client: mqtt.Client = None
        self.serial_manager = SerialManager()
        self._running = False
        self._heartbeat_thread: threading.Thread = None

    def start(self):
        """Start the MQTT bridge."""
        logger.info("═══════════════════════════════════════")
        logger.info("  🚀 OneLink IoT Gateway v1.0.0")
        logger.info(f"  📡 MQTT Broker: {MQTT_BROKER}:{MQTT_PORT}")
        logger.info(f"  🔌 Device ID:   {MQTT_CLIENT_ID}")
        logger.info("═══════════════════════════════════════")

        # 1. Initialize MQTT client
        self._setup_mqtt()

        # 2. Initialize serial devices
        self.serial_manager.on_event(self._handle_hardware_event)
        self.serial_manager.initialize()

        # 3. Start heartbeat
        self._running = True
        self._heartbeat_thread = threading.Thread(target=self._heartbeat_loop, daemon=True)
        self._heartbeat_thread.start()

        # 4. Connect to MQTT broker (blocks until disconnected)
        try:
            self.client.connect(MQTT_BROKER, MQTT_PORT, keepalive=60)
            self.client.loop_forever()
        except KeyboardInterrupt:
            self.shutdown()
        except Exception as e:
            logger.error(f"❌ MQTT connection failed: {e}")
            self.shutdown()

    def _setup_mqtt(self):
        """Configure MQTT client with TLS and callbacks."""
        self.client = mqtt.Client(client_id=MQTT_CLIENT_ID, protocol=mqtt.MQTTv311)

        # Authentication
        if MQTT_USERNAME:
            self.client.username_pw_set(MQTT_USERNAME, MQTT_PASSWORD)

        # TLS for HiveMQ Cloud
        if MQTT_USE_TLS:
            self.client.tls_set(tls_version=ssl.PROTOCOL_TLS)

        # Callbacks
        self.client.on_connect = self._on_connect
        self.client.on_message = self._on_message
        self.client.on_disconnect = self._on_disconnect

        # Auto-reconnect
        self.client.reconnect_delay_set(min_delay=1, max_delay=30)

    def _on_connect(self, client, userdata, flags, rc):
        """Called when connected to MQTT broker."""
        if rc == 0:
            logger.info("✅ Connected to MQTT broker")

            # Subscribe to Cloud → Hardware topics
            cloud_topics = [
                TOPICS["GATE_COMMAND"],
                TOPICS["PARKING_RESERVE"],
                TOPICS["BARRIER_COMMAND"],
                TOPICS["PAYMENT_REQUEST"],
                TOPICS["DEVICE_COMMAND"],
                TOPICS["CARD_PAIR_RESULT"],
            ]
            for topic in cloud_topics:
                client.subscribe(topic, qos=1)
                logger.info(f"📡 Subscribed: {topic}")

            # Publish online status
            self._publish(TOPICS["DEVICE_HEARTBEAT"], {
                "deviceId": MQTT_CLIENT_ID,
                "deviceType": "RPI_GATEWAY",
                "status": "online",
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "serialDevices": self.serial_manager.get_status(),
            })
        else:
            logger.error(f"❌ MQTT connection failed with code: {rc}")

    def _on_disconnect(self, client, userdata, rc):
        """Called when disconnected from MQTT broker."""
        logger.warning(f"⚠️ MQTT disconnected (rc={rc}). Auto-reconnecting...")

    def _on_message(self, client, userdata, msg):
        """Handle incoming MQTT messages from the cloud."""
        try:
            topic = msg.topic
            payload = json.loads(msg.payload.decode('utf-8'))
            logger.info(f"📨 Cloud → Pi [{topic}]: {json.dumps(payload)[:150]}")

            if topic == TOPICS["GATE_COMMAND"]:
                self._handle_gate_command(payload)
            elif topic == TOPICS["PARKING_RESERVE"]:
                self._handle_parking_reserve(payload)
            elif topic == TOPICS["BARRIER_COMMAND"]:
                self._handle_barrier_command(payload)
            elif topic == TOPICS["PAYMENT_REQUEST"]:
                self._handle_payment_request(payload)
            elif topic == TOPICS["DEVICE_COMMAND"]:
                self._handle_device_command(payload)
            elif topic == TOPICS["CARD_PAIR_RESULT"]:
                self._handle_card_pair_result(payload)

        except Exception as e:
            logger.error(f"❌ Message handling error: {e}")

    # ─────────────────────────────────────
    # HARDWARE → CLOUD (Serial events published to MQTT)
    # ─────────────────────────────────────

    def _handle_hardware_event(self, event_type: str, data: Dict[str, Any]):
        """Route serial events to the appropriate MQTT topic."""
        data["timestamp"] = datetime.utcnow().isoformat() + "Z"

        topic_map = {
            "transit_tap":    TOPICS["TRANSIT_TAP"],
            "parking_entry":  TOPICS["PARKING_ENTRY"],
            "parking_exit":   TOPICS["PARKING_EXIT"],
            "parking_status": TOPICS["PARKING_STATUS"],
            "payment_result": TOPICS["PAYMENT_RESULT"],
            "card_pair":      TOPICS["CARD_PAIR"],
        }

        topic = topic_map.get(event_type)
        if topic:
            self._publish(topic, data)
            logger.info(f"📤 Pi → Cloud [{topic}]: {event_type}")
        elif event_type == "card_unpaired":
            self.serial_manager.send_to_device(
                "metro",
                f"DISPLAY:Enter 10-digit pairing PIN for card {data.get('cardUid', '')}",
            )
            logger.info(f"🆕 Unpaired card — prompted for PIN: {data.get('cardUid')}")
        else:
            logger.warning(f"⚠️ Unknown event type: {event_type}")

    # ─────────────────────────────────────
    # CLOUD → HARDWARE (MQTT commands relayed to serial)
    # ─────────────────────────────────────

    def _handle_gate_command(self, payload: Dict):
        """Relay gate open/close command to Metro Arduino."""
        action = payload.get("action", "DENY")
        gate_id = payload.get("gateId", "")
        user_name = payload.get("userName", "")

        if action == "OPEN":
            command = f"GATE:OPEN:{user_name}"
        elif action == "PROMPT_PAIR":
            card_uid = payload.get("cardUid", "")
            command = f"DISPLAY:Enter 10-digit pairing PIN for card {card_uid}"
        else:
            command = f"GATE:DENY:{payload.get('message', 'Denied')}"

        self.serial_manager.send_to_device("metro", command)
        logger.info(f"🚇 Gate command sent: {command}")

    def _handle_parking_reserve(self, payload: Dict):
        """Relay parking reservation to Parking Arduino (update LED)."""
        spot_id = payload.get("spotId", "")
        led_color = payload.get("ledColor", "GREEN")
        command = f"LED:{spot_id}:{led_color}"

        self.serial_manager.send_to_device("parking", command)
        logger.info(f"🅿️ Parking LED command: {command}")

    def _handle_barrier_command(self, payload: Dict):
        """Relay barrier open/close to Parking Arduino."""
        action = payload.get("action", "CLOSE")
        command = f"BARRIER:{action}"

        self.serial_manager.send_to_device("parking", command)
        logger.info(f"🅿️ Barrier command: {command}")

    def _handle_payment_request(self, payload: Dict):
        """Relay NFC payment request to ESP32."""
        amount = payload.get("amount", 0)
        request_id = payload.get("requestId", "")
        command = f"PAY:{request_id}:{amount}"

        self.serial_manager.send_to_device("esp32", command)
        logger.info(f"💳 Payment request sent to ESP32: ₹{amount}")

    def _handle_device_command(self, payload: Dict):
        """Handle device management commands (restart, status, etc.)."""
        cmd = payload.get("command", "")
        if cmd == "status":
            self._publish(TOPICS["DEVICE_HEARTBEAT"], {
                "deviceId": MQTT_CLIENT_ID,
                "deviceType": "RPI_GATEWAY",
                "status": "online",
                "serialDevices": self.serial_manager.get_status(),
                "timestamp": datetime.utcnow().isoformat() + "Z",
            })
        elif cmd == "restart_serial":
            logger.info("🔄 Restarting serial devices...")
            self.serial_manager.shutdown()
            time.sleep(2)
            self.serial_manager.initialize()

    def _handle_card_pair_result(self, payload: Dict):
        """Show pairing result on metro terminal display."""
        if payload.get("success"):
            msg = f"Card linked to {payload.get('userName', 'user')}"
        else:
            msg = payload.get("message", "Pairing failed")
        self.serial_manager.send_to_device("metro", f"DISPLAY:{msg}")
        logger.info(f"🔗 Pair result: {msg}")

    # ─────────────────────────────────────
    # HELPERS
    # ─────────────────────────────────────

    def _publish(self, topic: str, payload: Dict):
        """Publish a JSON message to an MQTT topic."""
        try:
            message = json.dumps(payload)
            result = self.client.publish(topic, message, qos=1)
            if result.rc == 0:
                logger.debug(f"📤 Published [{topic}]: {message[:100]}")
            else:
                logger.error(f"❌ Publish failed [{topic}]: rc={result.rc}")
        except Exception as e:
            logger.error(f"❌ Publish error [{topic}]: {e}")

    def _heartbeat_loop(self):
        """Send periodic heartbeat to cloud."""
        while self._running:
            try:
                self._publish(TOPICS["DEVICE_HEARTBEAT"], {
                    "deviceId": MQTT_CLIENT_ID,
                    "deviceType": "RPI_GATEWAY",
                    "firmwareVersion": "1.0.0",
                    "uptime": int(time.time()),
                    "serialDevices": self.serial_manager.get_status(),
                    "timestamp": datetime.utcnow().isoformat() + "Z",
                })
            except Exception as e:
                logger.error(f"Heartbeat error: {e}")

            time.sleep(HEARTBEAT_INTERVAL)

    def shutdown(self):
        """Graceful shutdown."""
        logger.info("🛑 Shutting down OneLink IoT Gateway...")
        self._running = False
        self.serial_manager.shutdown()
        if self.client:
            self.client.disconnect()
        logger.info("✅ Gateway stopped")
        sys.exit(0)


# ─── Entry Point ───
if __name__ == "__main__":
    bridge = MqttBridge()

    # Handle Ctrl+C gracefully
    signal.signal(signal.SIGINT, lambda s, f: bridge.shutdown())
    signal.signal(signal.SIGTERM, lambda s, f: bridge.shutdown())

    bridge.start()
