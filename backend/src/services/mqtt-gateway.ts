import mqtt, { MqttClient, IClientOptions } from 'mqtt';
import { Server as SocketIOServer } from 'socket.io';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';
import { TransitService } from './transit.service.js';
import { ParkingService } from './parking.service.js';
import { WalletService } from './wallet.service.js';
import { User } from '../models/User.js';
import { cardUidQuery, hashCardUid, normalizeCardUid } from '../utils/cardUid.js';

// ─── MQTT Topic Constants ───
export const TOPICS = {
  // Hardware → Cloud
  TRANSIT_TAP:       'onelink/transit/tap',
  GATE_STATUS:       'onelink/transit/gate/status',
  PARKING_ENTRY:     'onelink/parking/entry',
  PARKING_EXIT:      'onelink/parking/exit',
  PARKING_STATUS:    'onelink/parking/status',
  PAYMENT_RESULT:    'onelink/payment/result',
  DEVICE_HEARTBEAT:  'onelink/device/heartbeat',
  DEVICE_STATUS:     'onelink/device/status',
  BUS_LOCATION:      'onelink/transit/bus/location',
  CARD_PAIR:         'onelink/card/pair',

  // Cloud → Hardware
  GATE_COMMAND:      'onelink/transit/gate/command',
  PARKING_RESERVE:   'onelink/parking/reserve',
  BARRIER_COMMAND:   'onelink/parking/barrier/command',
  PAYMENT_REQUEST:   'onelink/payment/request',
  DEVICE_COMMAND:    'onelink/device/command',
  CARD_PAIR_RESULT:  'onelink/card/pair/result',

  // Cloud → App (via Socket.IO, not MQTT)
  JOURNEY_ACTIVE:    'onelink/transit/journey/active',
  PAYMENT_RECEIPT:   'onelink/payment/receipt',
  NOTIFICATION:      'onelink/notification',
} as const;

// ─── Payload Interfaces ───
export interface TransitTapPayload {
  deviceId: string;
  cardUid: string;
  gateId: string;
  tapType: 'ENTRY' | 'EXIT';
  station: string;
  timestamp: string;
}

export interface ParkingEventPayload {
  deviceId: string;
  cardUid: string;
  spotId: string;
  eventType: 'ENTRY' | 'EXIT';
  timestamp: string;
}

export interface ParkingStatusPayload {
  deviceId: string;
  spots: Record<string, { occupied: boolean; irSensorValue: number }>;
  barrierState: 'OPEN' | 'CLOSED';
  timestamp: string;
}

export interface PaymentResultPayload {
  requestId: string;
  cardUid: string;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'INSUFFICIENT_BALANCE';
  amount: number;
  newBalance: number;
  transactionId: string;
  timestamp: string;
}

export interface DeviceHeartbeatPayload {
  deviceId: string;
  deviceType: 'ESP32' | 'ARDUINO_METRO' | 'ARDUINO_PARKING' | 'RPI_GATEWAY';
  firmwareVersion: string;
  uptime: number;
  freeHeap?: number;
  wifiRssi?: number;
  timestamp: string;
}

// ─── MQTT Gateway Service ───
export class MqttGateway {
  private client: MqttClient | null = null;
  private io: SocketIOServer | null = null;
  private transitService: TransitService;
  private parkingService: ParkingService;
  private walletService: WalletService;
  private deviceRegistry: Map<string, { lastSeen: Date; status: string }> = new Map();

  constructor() {
    this.transitService = new TransitService();
    this.parkingService = new ParkingService();
    this.walletService = new WalletService();
  }

  /**
   * Initialize MQTT client and connect to broker
   */
  async initialize(io: SocketIOServer): Promise<void> {
    this.io = io;

    const options: IClientOptions = {
      clientId: env.MQTT_CLIENT_ID + '_' + Date.now(),
      clean: true,
      connectTimeout: 10000,
      reconnectPeriod: 5000,
      keepalive: 60,
    };

    // Add auth credentials if provided (HiveMQ Cloud requires TLS + auth)
    if (env.MQTT_USERNAME) {
      options.username = env.MQTT_USERNAME;
      options.password = env.MQTT_PASSWORD;
    }

    try {
      this.client = mqtt.connect(env.MQTT_BROKER_URL, options);

      this.client.on('connect', () => {
        logger.info('✅ MQTT Gateway connected to broker: ' + env.MQTT_BROKER_URL);
        this.subscribeToTopics();
      });

      this.client.on('message', (topic: string, payload: Buffer) => {
        this.handleMessage(topic, payload);
      });

      this.client.on('error', (error: Error) => {
        logger.error('❌ MQTT Gateway error:', error.message);
      });

      this.client.on('reconnect', () => {
        logger.warn('🔄 MQTT Gateway reconnecting...');
      });

      this.client.on('offline', () => {
        logger.warn('⚠️ MQTT Gateway offline');
      });

    } catch (error) {
      logger.error('❌ Failed to initialize MQTT Gateway:', error);
    }
  }

  /**
   * Subscribe to all hardware → cloud topics
   */
  private subscribeToTopics(): void {
    const topics = [
      TOPICS.TRANSIT_TAP,
      TOPICS.GATE_STATUS,
      TOPICS.PARKING_ENTRY,
      TOPICS.PARKING_EXIT,
      TOPICS.PARKING_STATUS,
      TOPICS.PAYMENT_RESULT,
      TOPICS.DEVICE_HEARTBEAT,
      TOPICS.DEVICE_STATUS,
      TOPICS.BUS_LOCATION,
      TOPICS.CARD_PAIR,
    ];

    topics.forEach(topic => {
      this.client?.subscribe(topic, { qos: 1 }, (err) => {
        if (err) {
          logger.error(`❌ Failed to subscribe to ${topic}:`, err);
        } else {
          logger.info(`📡 Subscribed to: ${topic}`);
        }
      });
    });
  }

  /**
   * Central message router — dispatches to appropriate handler
   */
  private async handleMessage(topic: string, payload: Buffer): Promise<void> {
    try {
      const data = JSON.parse(payload.toString());
      logger.debug(`📨 MQTT [${topic}]:`, JSON.stringify(data).substring(0, 200));

      switch (topic) {
        case TOPICS.TRANSIT_TAP:
          await this.handleTransitTap(data as TransitTapPayload);
          break;

        case TOPICS.PARKING_ENTRY:
          await this.handleParkingEntry(data as ParkingEventPayload);
          break;

        case TOPICS.PARKING_EXIT:
          await this.handleParkingExit(data as ParkingEventPayload);
          break;

        case TOPICS.PARKING_STATUS:
          await this.handleParkingStatus(data as ParkingStatusPayload);
          break;

        case TOPICS.PAYMENT_RESULT:
          await this.handlePaymentResult(data as PaymentResultPayload);
          break;

        case TOPICS.DEVICE_HEARTBEAT:
          this.handleDeviceHeartbeat(data as DeviceHeartbeatPayload);
          break;

        case TOPICS.BUS_LOCATION:
          // Forward bus location directly to connected mobile apps
          this.io?.emit('bus:location', data);
          break;

        case TOPICS.CARD_PAIR:
          await this.handleCardPair(data);
          break;

        default:
          logger.warn(`⚠️ Unhandled MQTT topic: ${topic}`);
      }
    } catch (error) {
      logger.error(`❌ Error processing MQTT message [${topic}]:`, error);
    }
  }

  // ─────────────────────────────────────────────
  // TRANSIT HANDLERS
  // ─────────────────────────────────────────────

  /**
   * Handle RFID tap at metro gate (Hardware → Cloud)
   * 1. Validate card UID and balance
   * 2. Create/complete journey record
   * 3. Publish gate command back to hardware
   * 4. Push real-time notification to user's app
   */
  private async handleTransitTap(data: TransitTapPayload): Promise<void> {
    logger.info(`🚇 Transit tap: ${data.cardUid} at ${data.station} (${data.tapType})`);

    try {
      if (data.tapType === 'ENTRY') {
        const result = await this.transitService.processEntry(data.cardUid, data.station, data.gateId);

        // Publish gate command to hardware
        this.publish(TOPICS.GATE_COMMAND, {
          gateId: data.gateId,
          action: result.pairingRequired ? 'PROMPT_PAIR' : (result.success ? 'OPEN' : 'DENY'),
          userId: result.userId || '',
          userName: result.userName || '',
          cardUid: data.cardUid,
          fare: 0,
          message: result.message,
          ledColor: result.success ? 'GREEN' : 'RED',
          buzzerPattern: result.success ? 'SUCCESS' : 'DENIED',
          timestamp: new Date().toISOString(),
        });

        // Push to user's mobile app via Socket.IO
        if (result.success && result.userId) {
          this.io?.to(result.userId).emit('transit:entry', {
            station: data.station,
            entryTime: new Date().toISOString(),
            journeyId: result.journeyId,
            message: result.message,
          });
        }

      } else if (data.tapType === 'EXIT') {
        const result = await this.transitService.processExit(data.cardUid, data.station, data.gateId);

        // Publish gate command
        this.publish(TOPICS.GATE_COMMAND, {
          gateId: data.gateId,
          action: result.pairingRequired ? 'PROMPT_PAIR' : (result.success ? 'OPEN' : 'DENY'),
          userId: result.userId || '',
          userName: result.userName || '',
          cardUid: data.cardUid,
          fare: result.fare || 0,
          message: result.message,
          ledColor: result.success ? 'GREEN' : 'RED',
          buzzerPattern: result.success ? 'SUCCESS' : 'DENIED',
          timestamp: new Date().toISOString(),
        });

        // Push to user's mobile app
        if (result.success && result.userId) {
          this.io?.to(result.userId).emit('transit:exit', {
            station: data.station,
            fare: result.fare,
            duration: result.duration,
            newBalance: result.newBalance,
            message: result.message,
          });
        }
      }
    } catch (error) {
      logger.error('❌ Transit tap processing error:', error);
      // Send DENY to hardware on error
      this.publish(TOPICS.GATE_COMMAND, {
        gateId: data.gateId,
        action: 'DENY',
        message: 'System error. Please try again.',
        ledColor: 'RED',
        buzzerPattern: 'ERROR',
        timestamp: new Date().toISOString(),
      });
    }
  }

  // ─────────────────────────────────────────────
  // PARKING HANDLERS
  // ─────────────────────────────────────────────

  /**
   * Handle parking entry event (Hardware → Cloud)
   */
  private async handleParkingEntry(data: ParkingEventPayload): Promise<void> {
    logger.info(`🅿️ Parking entry: ${data.cardUid} at spot ${data.spotId}`);

    try {
      const result = await this.parkingService.processEntry(data.cardUid, data.spotId);

      // Push real-time update to ALL connected apps (parking grid update)
      this.io?.emit('parking:update', await this.parkingService.getAllSpots());

      // Push to specific user
      if (result.success && result.userId) {
        this.io?.to(result.userId).emit('parking:entry', {
          spotId: data.spotId,
          entryTime: new Date().toISOString(),
          message: result.message,
        });
      }

      // Publish barrier command to hardware
      this.publish(TOPICS.BARRIER_COMMAND, {
        spotId: data.spotId,
        action: result.success ? 'OPEN' : 'DENY',
        ledColor: result.success ? 'RED' : 'GREEN',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('❌ Parking entry processing error:', error);
    }
  }

  /**
   * Handle parking exit event (Hardware → Cloud)
   */
  private async handleParkingExit(data: ParkingEventPayload): Promise<void> {
    logger.info(`🅿️ Parking exit: ${data.cardUid} from spot ${data.spotId}`);

    try {
      const result = await this.parkingService.processExit(data.cardUid, data.spotId);

      // Push real-time update to ALL apps
      this.io?.emit('parking:update', await this.parkingService.getAllSpots());

      // Push to specific user
      if (result.success && result.userId) {
        this.io?.to(result.userId).emit('parking:exit', {
          spotId: data.spotId,
          duration: result.duration,
          charges: result.charges,
          newBalance: result.newBalance,
          message: result.message,
        });
      }

      // Publish barrier command
      this.publish(TOPICS.BARRIER_COMMAND, {
        spotId: data.spotId,
        action: 'OPEN',
        ledColor: 'GREEN',
        timestamp: new Date().toISOString(),
      });

    } catch (error) {
      logger.error('❌ Parking exit processing error:', error);
    }
  }

  /**
   * Handle parking IR sensor status update (Hardware → Cloud)
   */
  private async handleParkingStatus(data: ParkingStatusPayload): Promise<void> {
    logger.debug('🅿️ Parking sensor update received');

    try {
      await this.parkingService.updateSensorState(data.spots);

      // Push real-time grid update to all connected apps
      this.io?.emit('parking:update', await this.parkingService.getAllSpots());
    } catch (error) {
      logger.error('❌ Parking status update error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // PAYMENT HANDLERS
  // ─────────────────────────────────────────────

  /**
   * Handle NFC payment result from ESP32 (Hardware → Cloud)
   */
  private async handlePaymentResult(data: PaymentResultPayload): Promise<void> {
    logger.info(`💳 Payment result: ${data.status} for ${data.cardUid} — ₹${data.amount}`);

    try {
      if (data.status === 'SUCCESS') {
        // Process the payment. Even though the hardware reported a successful
        // tap, the wallet may still refuse it (insufficient balance / blocked
        // card), so always honour the wallet result.
        const result = await this.walletService.processPayment(
          data.cardUid,
          data.amount,
          'SHOPPING',
          'NFC',
          `NFC Payment — ₹${data.amount}`
        );

        // Push receipt (success or failure) to user's app
        if (result.userId) {
          this.io?.to(result.userId).emit('payment:receipt', {
            transactionId: result.transactionId,
            amount: data.amount,
            newBalance: result.newBalance,
            rewardPoints: result.rewardPoints,
            status: result.success ? 'SUCCESS' : 'FAILED',
            message: result.message,
            timestamp: new Date().toISOString(),
          });
        }
      }
    } catch (error) {
      logger.error('❌ Payment result processing error:', error);
    }
  }

  // ─────────────────────────────────────────────
  // DEVICE MANAGEMENT
  // ─────────────────────────────────────────────

  private handleDeviceHeartbeat(data: DeviceHeartbeatPayload): void {
    this.deviceRegistry.set(data.deviceId, {
      lastSeen: new Date(),
      status: 'online',
    });
    logger.debug(`💓 Heartbeat from ${data.deviceId} (${data.deviceType})`);

    // Push device status to admin dashboard
    this.io?.to('admin').emit('device:heartbeat', data);
  }

  // ─────────────────────────────────────────────
  // PUBLISH HELPERS (Cloud → Hardware)
  // ─────────────────────────────────────────────

  /**
   * Publish a message to an MQTT topic
   */
  publish(topic: string, payload: object): void {
    if (!this.client?.connected) {
      logger.warn('⚠️ MQTT client not connected, queuing message');
      return;
    }

    const message = JSON.stringify(payload);
    this.client.publish(topic, message, { qos: 1 }, (err) => {
      if (err) {
        logger.error(`❌ Failed to publish to ${topic}:`, err);
      } else {
        logger.debug(`📤 Published to ${topic}: ${message.substring(0, 100)}`);
      }
    });
  }

  /**
   * Request NFC payment from ESP32 hardware
   * Called by REST API when user clicks "Pay" in the app
   */
  requestNfcPayment(requestId: string, userId: string, amount: number, paymentType: string, description: string): void {
    this.publish(TOPICS.PAYMENT_REQUEST, {
      requestId,
      userId,
      amount,
      currency: 'INR',
      paymentType,
      description,
      merchantId: 'SMART_HUB_MART',
      timeout: 30,
      timestamp: new Date().toISOString(),
    });
    logger.info(`💳 NFC payment request sent: ${requestId} — ₹${amount}`);
  }

  /**
   * Send parking reservation command to hardware
   */
  reserveParkingSpot(spotId: string, userId: string, cardUid: string, action: 'RESERVE' | 'RELEASE', durationMinutes: number = 120): void {
    this.publish(TOPICS.PARKING_RESERVE, {
      spotId,
      userId,
      cardUid,
      action,
      durationMinutes,
      ledColor: action === 'RESERVE' ? 'YELLOW' : 'GREEN',
      barrierAction: action === 'RESERVE' ? 'STANDBY' : 'CLOSE',
      timestamp: new Date().toISOString(),
    });
    logger.info(`🅿️ Parking ${action}: spot ${spotId} for user ${userId}`);
  }

  /**
   * Handle RFID card pairing from IoT terminal (user enters 10-digit PIN after tapping new card)
   */
  private async handleCardPair(data: { pairingToken: string; cardUid: string; deviceId?: string }): Promise<void> {
    const { pairingToken, cardUid, deviceId } = data;
    logger.info(`🔗 Card pair request: UID ${cardUid}`);

    try {
      const user = await User.findOne({ pairingToken: pairingToken?.toString().trim() });
      if (!user) {
        this.publish(TOPICS.CARD_PAIR_RESULT, {
          success: false,
          cardUid,
          deviceId,
          message: 'Invalid pairing token',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (user.isCardPaired) {
        this.publish(TOPICS.CARD_PAIR_RESULT, {
          success: false,
          cardUid,
          deviceId,
          message: 'This account already has a linked card',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      if (user.pairingTokenExpiresAt && user.pairingTokenExpiresAt < new Date()) {
        this.publish(TOPICS.CARD_PAIR_RESULT, {
          success: false,
          cardUid,
          deviceId,
          message: 'Pairing token expired',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      const existingCard = await User.findOne({ ...cardUidQuery(cardUid), isCardPaired: true });
      if (existingCard) {
        this.publish(TOPICS.CARD_PAIR_RESULT, {
          success: false,
          cardUid,
          deviceId,
          message: 'Card already linked to another account',
          timestamp: new Date().toISOString(),
        });
        return;
      }

      user.cardUid = normalizeCardUid(cardUid);
      user.cardUidHash = hashCardUid(cardUid);
      user.isCardPaired = true;
      user.pairingToken = null;
      user.pairingTokenExpiresAt = null;
      user.card.cardNumber = `****-****-****-${cardUid.toString().slice(-4)}`;
      await user.save();

      this.publish(TOPICS.CARD_PAIR_RESULT, {
        success: true,
        cardUid: user.cardUid,
        userId: user.userId,
        userName: user.name,
        deviceId,
        message: `Card linked to ${user.name}`,
        timestamp: new Date().toISOString(),
      });

      this.io?.to(user.userId).emit('card:paired', {
        cardUid: user.cardUid,
        message: 'Your RFID card is now linked to your account',
      });

      logger.info(`✅ Card paired: ${user.name} (${user.cardUid})`);
    } catch (error) {
      logger.error('❌ Card pair error:', error);
      this.publish(TOPICS.CARD_PAIR_RESULT, {
        success: false,
        cardUid,
        deviceId,
        message: 'Pairing failed',
        timestamp: new Date().toISOString(),
      });
    }
  }

  /**
   * Get all registered device statuses
   */
  getDeviceStatuses(): Record<string, { lastSeen: Date; status: string }> {
    const statuses: Record<string, { lastSeen: Date; status: string }> = {};
    this.deviceRegistry.forEach((value, key) => {
      // Mark as offline if no heartbeat for 60 seconds
      const isOnline = (Date.now() - value.lastSeen.getTime()) < 60000;
      statuses[key] = {
        lastSeen: value.lastSeen,
        status: isOnline ? 'online' : 'offline',
      };
    });
    return statuses;
  }

  /**
   * Disconnect MQTT client
   */
  disconnect(): void {
    this.client?.end();
    logger.info('MQTT Gateway disconnected');
  }
}

// Singleton instance
export const mqttGateway = new MqttGateway();
