"""
OneLink IoT Gateway — Configuration
Raspberry Pi 4B device and MQTT broker settings.
"""

# ─── MQTT Broker (HiveMQ Cloud) ───
MQTT_BROKER = "YOUR_CLUSTER.s1.eu.hivemq.cloud"
MQTT_PORT = 8883
MQTT_USERNAME = "onelink_iot"
MQTT_PASSWORD = "YOUR_MQTT_PASSWORD"
MQTT_CLIENT_ID = "RPI_GATEWAY_01"
MQTT_USE_TLS = True

# ─── Serial Devices (USB connections) ───
SERIAL_DEVICES = {
    "metro": {
        "port": "/dev/ttyUSB0",     # COM4 equivalent on Linux
        "baud": 9600,
        "timeout": 1,
        "description": "Metro Arduino RFID Reader"
    },
    "parking": {
        "port": "/dev/ttyUSB1",     # COM3 equivalent on Linux
        "baud": 9600,
        "timeout": 1,
        "description": "Parking Arduino (IR + RFID + Servo)"
    },
    "esp32": {
        "port": "/dev/ttyUSB2",     # COM6 equivalent on Linux
        "baud": 115200,
        "timeout": 1,
        "description": "ESP32 NFC Payment Reader"
    }
}

# ─── MQTT Topic Mappings ───
TOPICS = {
    # Hardware → Cloud (Pi publishes to these)
    "TRANSIT_TAP":      "onelink/transit/tap",
    "PARKING_ENTRY":    "onelink/parking/entry",
    "PARKING_EXIT":     "onelink/parking/exit",
    "PARKING_STATUS":   "onelink/parking/status",
    "PAYMENT_RESULT":   "onelink/payment/result",
    "DEVICE_HEARTBEAT": "onelink/device/heartbeat",

    # Cloud → Hardware (Pi subscribes to these)
    "GATE_COMMAND":     "onelink/transit/gate/command",
    "PARKING_RESERVE":  "onelink/parking/reserve",
    "BARRIER_COMMAND":  "onelink/parking/barrier/command",
    "PAYMENT_REQUEST":  "onelink/payment/request",
    "DEVICE_COMMAND":   "onelink/device/command",
    "CARD_PAIR":        "onelink/card/pair",
    "CARD_PAIR_RESULT": "onelink/card/pair/result",
}

# ─── RFID Card UID → User Mapping ───
# This maps hardware-level RFID UIDs to cloud user identifiers
CARD_USERS = {
    "A97432": {"userId": "usr_akshat_001", "name": "Akshat Choudhary"},
    "274932": {"userId": "usr_bharat_002", "name": "Bharat"},
    "B32914": {"userId": "usr_nitya_003",  "name": "Nitya"},
    "D48271": {"userId": "usr_arin_004",   "name": "Arin"},
}

# ─── Parking Spots ───
PARKING_SPOTS = ["A1", "A2", "A3", "B1", "B2", "B3"]

# ─── Heartbeat Interval (seconds) ───
HEARTBEAT_INTERVAL = 30

# ─── Logging ───
LOG_LEVEL = "INFO"
LOG_FILE = "/var/log/onelink/gateway.log"
