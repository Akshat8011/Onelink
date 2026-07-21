import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server as SocketIOServer } from 'socket.io';

import { env } from './config/env.js';
import { connectDatabase } from './config/database.js';
import { logger } from './utils/logger.js';
import { httpCorsOptions, socketCorsOrigin } from './config/cors.js';
import { mqttGateway } from './services/mqtt-gateway.js';
import { ParkingService } from './services/parking.service.js';
import { startReversalSweeper } from './services/reversal.service.js';

// Route imports
import authRoutes from './routes/auth.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import transitRoutes from './routes/transit.routes.js';
import parkingRoutes from './routes/parking.routes.js';
import retailRoutes from './routes/retail.routes.js';
import eventsRoutes from './routes/events.routes.js';
import kioskRoutes from './routes/kiosk.routes.js';
import canteenRoutes from './routes/canteen.routes.js';
import internalRoutes from './routes/internal.routes.js';
import adminRoutes from './routes/admin.routes.js';
import { setRealtimeIO } from './utils/realtime.js';
import { canteenService } from './services/canteen.service.js';

// ═══════════════════════════════════════════════════════
// EXPRESS APP SETUP
// ═══════════════════════════════════════════════════════

const app = express();
// Render/Vercel terminate TLS at a proxy; trust it so req.ip and X-Forwarded-For
// reflect the real client (used by the rate limiter).
app.set('trust proxy', 1);
const server = http.createServer(app);

// Socket.IO for real-time push to mobile apps
const io = new SocketIOServer(server, {
  cors: {
    origin: socketCorsOrigin(),
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

setRealtimeIO(io);

// ─── Middleware ───
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors(httpCorsOptions));
app.options('*', cors(httpCorsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(morgan('dev'));

// ─── Health Check ───
app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'onelink-backend',
    version: '1.0.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    mqtt: mqttGateway.getDeviceStatuses(),
  });
});

// ─── API Routes ───
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/transit', transitRoutes);
app.use('/api/v1/mobility', parkingRoutes); // Parking matched to mobility
app.use('/api/v1/retail', retailRoutes);
app.use('/api/v1/city', eventsRoutes);
app.use('/api/v1/kiosk', kioskRoutes);
app.use('/api/v1/canteen', canteenRoutes);
app.use('/api/v1/internal', internalRoutes);
app.use('/api/v1/admin', adminRoutes);

// ─── 404 handler ───
app.use((_req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// ─── Error handler ───
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  logger.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ═══════════════════════════════════════════════════════
// SOCKET.IO CONNECTION HANDLING
// ═══════════════════════════════════════════════════════

io.on('connection', (socket) => {
  logger.info(`📱 Client connected: ${socket.id}`);

  // Client joins their user-specific room for targeted push notifications
  socket.on('join', (userId: string) => {
    socket.join(userId);
    logger.info(`📱 User ${userId} joined room`);
  });

  // Admin dashboard joins admin room
  socket.on('join:admin', () => {
    socket.join('admin');
    logger.info(`🔧 Admin client connected: ${socket.id}`);
  });

  socket.on('disconnect', () => {
    logger.debug(`📱 Client disconnected: ${socket.id}`);
  });
});

// ═══════════════════════════════════════════════════════
// SERVER STARTUP
// ═══════════════════════════════════════════════════════

async function startServer(): Promise<void> {
  try {
    // 1. Connect to MongoDB
    await connectDatabase();

    // 2. Initialize parking spots (A1-B3)
    const parkingService = new ParkingService();
    await parkingService.initializeSpots();

    // 3. Initialize MQTT Gateway
    await mqttGateway.initialize(io);

    // 3b. Start the stale-pending reversal sweeper (Phase 2 transactional integrity)
    startReversalSweeper();

    // 3c. Canteen order-queue simulator (advances nowServing every 2 minutes)
    canteenService.startQueueSimulator();

    // 4. Start HTTP server
    server.listen(env.PORT, () => {
      logger.info('═══════════════════════════════════════════');
      logger.info('  🚀 OneLink Super App Backend v1.0.0');
      logger.info(`  🌐 HTTP Server:  http://localhost:${env.PORT}`);
      logger.info(`  📡 WebSocket:    ws://localhost:${env.PORT}`);
      logger.info(`  🔌 MQTT Broker:  ${env.MQTT_BROKER_URL}`);
      logger.info(`  🗄️  Database:    MongoDB Atlas`);
      logger.info(`  📊 Health:       http://localhost:${env.PORT}/health`);
      logger.info('═══════════════════════════════════════════');
    });
  } catch (error) {
    logger.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  mqttGateway.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received. Shutting down...');
  mqttGateway.disconnect();
  server.close(() => {
    process.exit(0);
  });
});

startServer();
