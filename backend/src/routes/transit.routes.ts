import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { TransitService } from '../services/transit.service.js';
import { kioskService } from '../services/kiosk.service.js';

const router = Router();
const transitService = new TransitService();

/** GET /api/v1/transit/tickets — Active metro tickets for user */
router.get('/tickets', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const tickets = await kioskService.getActiveTickets(req.user!.userId);
    res.json({ success: true, data: tickets });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/v1/transit/book-ticket — Book metro ticket from mobile app */
router.post('/book-ticket', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { from, to } = req.body;
    const user = req.user!;
    if (!user.cardUid) {
      return res.status(400).json({ success: false, error: 'No linked card' });
    }
    const result = await kioskService.bookTransitTicket(user.cardUid, from, to);
    res.status(result.success ? 200 : 400).json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/v1/transit/journey/active — Get active metro journey */
router.get('/journey/active', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const journey = await transitService.getActiveJourney(req.user!.userId);
    res.json({ success: true, data: journey || null });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/v1/transit/history — Get journey history */
router.get('/history', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const history = await transitService.getJourneyHistory(req.user!.userId, limit);
    res.json({ success: true, data: history });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/v1/transit/options — Get all transit options */
router.get('/options', (_req, res: Response) => {
  const transitSvc = new TransitService();
  res.json({ success: true, data: { metroStations: transitSvc.getStations(), busRoutes: [] } });
});

/** POST /api/transit/simulate/entry — Simulate RFID tap entry (for testing) */
router.post('/simulate/entry', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { station, gateId } = req.body;
    const result = await transitService.processEntry(req.user!.cardUid, station || 'Hazratganj', gateId || 'GATE_TEST_01');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/transit/simulate/exit — Simulate RFID tap exit (for testing) */
router.post('/simulate/exit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { station, gateId } = req.body;
    const result = await transitService.processExit(req.user!.cardUid, station || 'Charbagh', gateId || 'GATE_TEST_02');
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
