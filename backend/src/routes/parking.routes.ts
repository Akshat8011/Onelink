import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { ParkingService } from '../services/parking.service.js';
import { kioskService } from '../services/kiosk.service.js';
import { mqttGateway } from '../services/mqtt-gateway.js';
import { emitBroadcast } from '../utils/realtime.js';

const router = Router();
const parkingService = new ParkingService();

import axios from 'axios';

/** GET /api/v1/mobility/status — Get all parking spots status (live grid) and EV Chargers */
router.get('/status', async (_req, res: Response) => {
  try {
    const spots = await parkingService.getEnrichedSpots();
    
    // Fetch live EV chargers from OpenChargeMap (Lucknow bounding box)
    let evStations = [];
    try {
      const ocmUrl = 'https://api.openchargemap.io/v3/poi?output=json&countrycode=IN&maxresults=5&latitude=26.8467&longitude=80.9462&distance=20&distanceunit=KM';
      const { data } = await axios.get(ocmUrl);
      
      evStations = data.map((poi: any) => ({
        stationId: poi.ID.toString(),
        type: poi.UsageType ? poi.UsageType.Title : 'Public Charger',
        location: { address: poi.AddressInfo ? poi.AddressInfo.Title : 'Lucknow Station' },
        connectors: poi.Connections ? poi.Connections.map((c: any) => ({
          connectorId: c.ID.toString(),
          type: c.ConnectionType ? c.ConnectionType.Title : 'Type 2',
          powerKw: c.PowerKW || 50,
          status: Math.random() > 0.5 ? 'AVAILABLE' : 'CHARGING' // Live utilization simulation hack
        })) : [],
        parkingStatus: 'AVAILABLE',
        ratePerMinute: 15
      }));
    } catch (e) {
      console.error('Failed to fetch OpenChargeMap data', e);
    }

    res.json({ success: true, data: { parkingSpots: spots, evStations } });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/parking/reserve — Reserve a spot from the mobile app */
router.post('/reserve', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { spotId, durationMinutes } = req.body;
    if (!spotId) return res.status(400).json({ error: 'spotId required' });

    const result = await parkingService.reserveSpot(req.user!.userId, spotId, durationMinutes || 120);

    // Publish MQTT command to hardware to update LED color
    if (result.success) {
      const user = await (await import('../models/User.js')).User.findOne({ userId: req.user!.userId });
      mqttGateway.reserveParkingSpot(spotId, req.user!.userId, user?.cardUid || '', 'RESERVE', durationMinutes || 120);
      const spots = await parkingService.getEnrichedSpots();
      emitBroadcast('parking:update', spots);
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/v1/mobility/parking/exit — Vacate occupied spot, pay, and free the space */
router.post('/parking/exit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const result = await kioskService.exitParkingForUser(req.user!.userId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/parking/release — Release a reservation */
router.post('/release', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { spotId } = req.body;
    if (!spotId) return res.status(400).json({ error: 'spotId required' });

    await parkingService.releaseReservation(spotId);

    // Publish MQTT command to hardware
    mqttGateway.reserveParkingSpot(spotId, req.user!.userId, '', 'RELEASE');

    res.json({ success: true, message: `Reservation for ${spotId} released` });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/parking/simulate/entry — Simulate parking entry (for testing) */
router.post('/simulate/entry', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { spotId } = req.body;
    const result = await parkingService.processEntry(req.user!.cardUid, spotId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/parking/simulate/exit — Simulate parking exit (for testing) */
router.post('/simulate/exit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { spotId } = req.body;
    const result = await parkingService.processExit(req.user!.cardUid, spotId);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
