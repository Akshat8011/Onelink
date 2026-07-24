/*
 * OneLink ESP32 RFID Reader
 * -------------------------
 * Publishes card taps to a PUBLIC MQTT broker so the Raspberry Pi's
 * changing hotspot IP never needs to be hardcoded again.
 *
 * Flow: RC522 -> ESP32 -> broker.emqx.io -> Pi brain.py -> kiosk WebSocket
 *
 * Libraries (Arduino Library Manager):
 *   - WiFiManager by tzapu
 *   - PubSubClient by Nick O'Leary
 *   - MFRC522 by GithubCommunity
 *
 * First boot: join WiFi AP "OneLink-Setup", open the captive portal,
 * enter your phone hotspot SSID/password. Credentials are saved in flash.
 */

#include <WiFi.h>
#include <WiFiManager.h>
#include <PubSubClient.h>
#include <SPI.h>
#include <MFRC522.h>

// ─────────── CONFIG (no Pi IP here — ever) ───────────
const char* MQTT_HOST = "broker.emqx.io";
const int   MQTT_PORT = 1883;
const char* MQTT_TOPIC_TAP = "onelink/hardware/tap";
const char* MQTT_TOPIC_HB  = "onelink/hardware/heartbeat";
const char* NODE_ID        = "main_kiosk";
const char* WIFI_AP_NAME   = "OneLink-Setup";

// RC522 SPI pins (same as your current wiring)
#define SS_PIN   5
#define RST_PIN  27
#define SCK_PIN  18
#define MISO_PIN 19
#define MOSI_PIN 23
#define LED_PIN  2

const unsigned long TAP_COOLDOWN_MS = 2500;
const unsigned long HEARTBEAT_MS    = 30000;
const unsigned long READER_CHECK_MS = 5000;
// ─────────────────────────────────────────────────────

WiFiClient   wifiClient;
PubSubClient mqtt(wifiClient);
MFRC522      rfid(SS_PIN, RST_PIN);
WiFiManager  wifiManager;

String        lastUid = "";
unsigned long lastTapAt = 0;
unsigned long lastHealthAt = 0;
unsigned long lastHeartbeatAt = 0;
unsigned long mqttBackoffMs = 1000;

void initReader() {
  SPI.begin(SCK_PIN, MISO_PIN, MOSI_PIN, SS_PIN);
  rfid.PCD_Init();
  delay(50);
  rfid.PCD_SetAntennaGain(rfid.RxGain_max);
}

bool readerOk() {
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  return !(v == 0x00 || v == 0xFF);
}

String uidToHex(MFRC522::Uid uid) {
  String s = "";
  for (byte i = 0; i < uid.size; i++) {
    if (uid.uidByte[i] < 0x10) s += "0";
    s += String(uid.uidByte[i], HEX);
  }
  s.toUpperCase();
  return s;
}

void ensureWifi() {
  if (WiFi.status() == WL_CONNECTED) return;
  Serial.println("WiFi lost — reconnecting via saved credentials / portal…");
  // Blocking portal only if saved creds fail (timeout 180s).
  wifiManager.setConfigPortalTimeout(180);
  if (!wifiManager.autoConnect(WIFI_AP_NAME)) {
    Serial.println("WiFi portal timed out — restarting");
    delay(1500);
    ESP.restart();
  }
  Serial.printf("WiFi OK. IP: %s\n", WiFi.localIP().toString().c_str());
}

bool connectMqttOnce() {
  String clientId = "onelink-esp32-" + String((uint32_t)ESP.getEfuseMac(), HEX);
  Serial.printf("MQTT: connecting to %s:%d as %s … ", MQTT_HOST, MQTT_PORT, clientId.c_str());
  bool ok = mqtt.connect(clientId.c_str());
  if (ok) {
    Serial.println("connected.");
    mqttBackoffMs = 1000;
    // Immediate heartbeat so Pi/kiosk know RFID path is alive.
    String hb = "{\"node\":\"" + String(NODE_ID) + "\",\"readerOk\":";
    hb += readerOk() ? "true" : "false";
    hb += ",\"ip\":\"" + WiFi.localIP().toString() + "\"}";
    mqtt.publish(MQTT_TOPIC_HB, hb.c_str(), true);
  } else {
    Serial.printf("failed (rc=%d)\n", mqtt.state());
  }
  return ok;
}

void ensureMqtt() {
  if (mqtt.connected()) return;
  while (!mqtt.connected()) {
    ensureWifi();
    if (connectMqttOnce()) break;
    Serial.printf("MQTT retry in %lums\n", mqttBackoffMs);
    delay(mqttBackoffMs);
    mqttBackoffMs = min(mqttBackoffMs * 2, (unsigned long)30000);
  }
}

void publishTap(const String& uid) {
  String payload = "{\"uid\":\"" + uid + "\",\"node\":\"" + String(NODE_ID) + "\"}";
  bool ok = mqtt.publish(MQTT_TOPIC_TAP, payload.c_str());
  Serial.printf("TAP %s -> %s  [%s]\n", uid.c_str(), MQTT_TOPIC_TAP, ok ? "OK" : "FAIL");
  digitalWrite(LED_PIN, HIGH);
  delay(120);
  digitalWrite(LED_PIN, LOW);
}

void publishHeartbeat() {
  String hb = "{\"node\":\"" + String(NODE_ID) + "\",\"readerOk\":";
  hb += readerOk() ? "true" : "false";
  hb += ",\"ip\":\"" + WiFi.localIP().toString() + "\",\"uptimeMs\":";
  hb += String(millis());
  hb += "}";
  bool ok = mqtt.publish(MQTT_TOPIC_HB, hb.c_str(), true);
  Serial.printf("HB -> %s [%s]\n", MQTT_TOPIC_HB, ok ? "OK" : "FAIL");
}

void setup() {
  Serial.begin(115200);
  delay(300);
  pinMode(LED_PIN, OUTPUT);
  Serial.println("\n=== OneLink ESP32 RFID (public MQTT) ===");
  Serial.println("Broker: broker.emqx.io — Pi IP is NOT required.");

  initReader();
  byte v = rfid.PCD_ReadRegister(MFRC522::VersionReg);
  Serial.printf("RC522 version: 0x%02X %s\n", v,
                readerOk() ? "(OK)" : "(NOT DETECTED — check wiring & 3.3V)");

  wifiManager.setHostname("onelink-esp32");
  wifiManager.setConfigPortalTimeout(180);
  // Hold BOOT (GPIO0) low at reset to force re-open portal for new hotspot.
  pinMode(0, INPUT_PULLUP);
  if (digitalRead(0) == LOW) {
    Serial.println("BOOT held — clearing WiFi and opening portal");
    wifiManager.resetSettings();
  }

  if (!wifiManager.autoConnect(WIFI_AP_NAME)) {
    Serial.println("Failed to connect — restarting");
    delay(2000);
    ESP.restart();
  }
  Serial.printf("WiFi connected. IP: %s\n", WiFi.localIP().toString().c_str());

  mqtt.setServer(MQTT_HOST, MQTT_PORT);
  mqtt.setKeepAlive(30);
  ensureMqtt();
  lastHeartbeatAt = millis();
  Serial.println("Ready. Tap a card. Heartbeat every 30s.");
}

void loop() {
  ensureWifi();
  ensureMqtt();
  mqtt.loop();

  unsigned long now = millis();

  if (now - lastHealthAt > READER_CHECK_MS) {
    lastHealthAt = now;
    if (!readerOk()) {
      Serial.println("RC522 not responding — re-init");
      initReader();
    }
  }

  if (now - lastHeartbeatAt >= HEARTBEAT_MS) {
    lastHeartbeatAt = now;
    publishHeartbeat();
  }

  if (!rfid.PICC_IsNewCardPresent() || !rfid.PICC_ReadCardSerial()) return;

  String uid = uidToHex(rfid.uid);
  if (uid == lastUid && (now - lastTapAt) < TAP_COOLDOWN_MS) {
    rfid.PICC_HaltA();
    rfid.PCD_StopCrypto1();
    return;
  }
  lastUid = uid;
  lastTapAt = now;

  Serial.printf("CARD UID: %s\n", uid.c_str());
  publishTap(uid);

  rfid.PICC_HaltA();
  rfid.PCD_StopCrypto1();
}
