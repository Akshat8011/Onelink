import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { kioskService, METRO_STATIONS, calculateSlabFare } from '../services/kiosk.service.js';
import { canteenService } from '../services/canteen.service.js';
import { KioskSound } from '../models/KioskSound.js';
import { validateBody } from '../middleware/validate.js';
import { rateLimit } from '../middleware/rateLimit.js';
import { logger } from '../utils/logger.js';

const router = Router();

const CARD_UID = { type: 'string' as const, required: true, maxLen: 64 };
const STATION = { type: 'string' as const, required: true, maxLen: 64 };

// Card lookup is unauthenticated and enumerable — cap per-IP request rate.
const checkCardLimiter = rateLimit({ windowMs: 60_000, max: 30, name: 'kiosk/check-card' });

router.get('/stations', (_req, res) => {
  res.json({ success: true, stations: METRO_STATIONS });
});

// ── Kiosk sound manifest + streaming (admin-uploaded custom sounds) ──
// Public: the kiosk device fetches these on load. Only keys with a custom
// upload are listed; the kiosk falls back to its built-in sounds otherwise.
router.get('/sounds', async (_req, res) => {
  try {
    const docs = await KioskSound.find({}).select('key updatedAt mimeType').lean();
    const sounds: Record<string, { updatedAt: Date; mimeType: string }> = {};
    for (const d of docs) sounds[d.key] = { updatedAt: d.updatedAt, mimeType: d.mimeType };
    res.set('Cache-Control', 'no-cache');
    res.json({ success: true, sounds });
  } catch {
    res.json({ success: true, sounds: {} });
  }
});

router.get('/sounds/:key', async (req: Request, res: Response) => {
  try {
    const doc = await KioskSound.findOne({ key: req.params.key }).lean();
    if (!doc) return res.status(404).end();
    const base64 = (doc.dataUri.split(',')[1]) || '';
    const buf = Buffer.from(base64, 'base64');
    res.set('Content-Type', doc.mimeType || 'audio/mpeg');
    res.set('Cache-Control', 'public, max-age=60');
    res.send(buf);
  } catch {
    res.status(500).end();
  }
});

router.post('/check-card', checkCardLimiter, validateBody({ cardUid: CARD_UID }), async (req: Request, res: Response) => {
  try {
    const cardUid = req.body?.cardUid;
    const user = await kioskService.getUserByCard(cardUid);
    if (!user) {
      return res.json({
        success: true,
        registered: false,
        pairingRequired: true,
        cardUid,
      });
    }
    // A card locked from the OneLink app must not open an account or transact
    // at the kiosk. Stop here so no session/payment screens are ever reached.
    if (user.cardBlocked) {
      return res.json({
        success: true,
        registered: true,
        blocked: true,
        cardBlocked: true,
        name: user.name,
        error: 'This card is locked in the OneLink app. Unlock it from Profile → NFC card to use the kiosk.',
      });
    }
    const tickets = await kioskService.getActiveTickets(user.userId);
    const carts = await kioskService.getPendingCarts(user.userId);
    const canteenCarts = await canteenService.getPendingCarts(user.userId);
    return res.json({
      success: true,
      registered: true,
      ...user,
      activeTickets: tickets,
      pendingCarts: carts,
      pendingCanteenCarts: canteenCarts,
    });
  } catch (err) {
    logger.error('Kiosk check-card:', err);
    return res.status(500).json({ success: false, error: 'Check failed' });
  }
});

router.post('/transit/book', validateBody({ cardUid: CARD_UID, from: STATION, to: STATION }), async (req: Request, res: Response) => {
  try {
    const { cardUid, from, to } = req.body;
    const idem = req.header('Idempotency-Key');
    const result = await kioskService.bookTransitTicket(cardUid, from, to, idem);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    logger.error('Kiosk transit/book:', err);
    return res.status(500).json({ success: false, message: 'Booking failed. Please try again.' });
  }
});

router.post('/transit/fare', validateBody({ from: STATION, to: STATION }), async (req: Request, res: Response) => {
  const { from, to } = req.body;
  return res.json({ success: true, fare: calculateSlabFare(from, to) });
});

router.get('/transit/tickets/:cardUid', async (req: Request, res: Response) => {
  const user = await kioskService.getUserByCard(req.params.cardUid);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const tickets = await kioskService.getActiveTickets(user.userId);
  return res.json({ success: true, tickets });
});

router.post('/transit/use-ticket', validateBody({ cardUid: CARD_UID, ticketId: { type: 'string', required: true, maxLen: 64 } }), async (req: Request, res: Response) => {
  try {
    const { cardUid, ticketId } = req.body;
    const result = await kioskService.useTransitTicket(cardUid, ticketId);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    logger.error('Kiosk transit/use-ticket:', err);
    return res.status(500).json({ success: false, message: 'Gate operation failed. Please try again.' });
  }
});

router.post('/shop/push-cart', authenticate, validateBody({ items: { type: 'array', required: true, min: 1, max: 200 }, subtotal: { type: 'number', min: 0 } }), async (req: AuthRequest, res: Response) => {
  try {
    const { items, subtotal } = req.body;
    const userId = req.user!.userId;
    const cart = await kioskService.pushShopCart(userId, items, subtotal ?? items.reduce(
      (s: number, i: { price: number; quantity: number }) => s + i.price * i.quantity,
      0,
    ));
    return res.status(201).json({ success: true, cartId: cart.cartId, total: cart.total });
  } catch (err) {
    logger.error('Push cart:', err);
    return res.status(500).json({ success: false, error: 'Failed to push cart' });
  }
});

router.get('/shop/carts/:cardUid', async (req: Request, res: Response) => {
  const user = await kioskService.getUserByCard(req.params.cardUid);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const carts = await kioskService.getPendingCarts(user.userId);
  return res.json({ success: true, carts });
});

router.post('/shop/pay', validateBody({ cardUid: CARD_UID, cartId: { type: 'string', required: true, maxLen: 64 } }), async (req: Request, res: Response) => {
  try {
    const { cardUid, cartId } = req.body;
    const idem = req.header('Idempotency-Key');
    const result = await kioskService.payShopCart(cardUid, cartId, idem);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    logger.error('Kiosk shop/pay:', err);
    return res.status(500).json({ success: false, message: 'Payment failed. Please try again.' });
  }
});

router.get('/shop/orders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const orders = await kioskService.getShopOrders(req.user!.userId);
    return res.json({ success: true, orders });
  } catch (err) {
    logger.error('Shop orders:', err);
    return res.status(500).json({ success: false, error: 'Failed to load orders' });
  }
});

router.get('/parking/spots', async (_req, res) => {
  const spots = await kioskService.getParkingSpots();
  return res.json({ success: true, spots });
});

router.post('/parking/allocate', validateBody({ cardUid: CARD_UID, spotId: { type: 'string', maxLen: 16 } }), async (req: Request, res: Response) => {
  try {
    const { cardUid, spotId } = req.body;
    const idem = req.header('Idempotency-Key');
    const result = await kioskService.allocateParking(cardUid, spotId, idem);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    logger.error('Kiosk parking/allocate:', err);
    return res.status(500).json({ success: false, message: 'Could not allocate a spot. Please try again.' });
  }
});

router.post('/parking/exit', validateBody({ cardUid: CARD_UID }), async (req: Request, res: Response) => {
  try {
    const { cardUid } = req.body;
    const idem = req.header('Idempotency-Key');
    const result = await kioskService.exitParking(cardUid, idem);
    return res.status(result.success ? 200 : 400).json(result);
  } catch (err) {
    logger.error('Kiosk parking/exit:', err);
    return res.status(500).json({ success: false, message: 'Could not complete exit. No money was deducted — please try again.' });
  }
});

router.get('/parking/receipts', authenticate, async (req: AuthRequest, res: Response) => {
  const receipts = await kioskService.getParkingReceipts(req.user!.userId);
  const mapped = receipts.map((r: any) => ({
    receiptId: r.receiptId,
    spotId: r.spotId,
    zone: r.zone,
    entryTime: r.entryTime,
    exitTime: r.exitTime,
    durationMinutes: r.durationMinutes,
    ratePerMinute: r.ratePerMinute,
    amount: r.totalCharge,
    totalCharge: r.totalCharge,
    createdAt: r.createdAt,
  }));
  return res.json({ success: true, receipts: mapped });
});

// ── Canteen (kiosk) ──────────────────────────────────────────────────────────

router.get('/canteen/menu', (_req, res: Response) => {
  const menu = canteenService.getMenu();
  return res.json({ success: true, ...menu });
});

router.get('/canteen/carts/:cardUid', async (req: Request, res: Response) => {
  const user = await kioskService.getUserByCard(req.params.cardUid);
  if (!user) return res.status(404).json({ success: false, error: 'User not found' });
  const carts = await canteenService.getPendingCarts(user.userId);
  return res.json({ success: true, carts });
});

router.get('/canteen/queue', async (_req: Request, res: Response) => {
  try {
    const queue = await canteenService.getQueue();
    return res.json({ success: true, ...queue });
  } catch (err) {
    logger.error('Kiosk canteen/queue:', err);
    return res.status(500).json({ success: false, error: 'Failed to load queue' });
  }
});

router.post(
  '/canteen/pay',
  validateBody({
    cardUid: CARD_UID,
    cartId: { type: 'string', maxLen: 64 },
    items: { type: 'array', max: 100 },
  }),
  async (req: Request, res: Response) => {
    try {
      const { cardUid, cartId, items } = req.body;
      if (!cartId && (!items || !items.length)) {
        return res.status(400).json({ success: false, message: 'cartId or items required' });
      }
      const idem = req.header('Idempotency-Key');
      const result = await canteenService.payCart(cardUid, { cartId, items }, idem);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
      logger.error('Kiosk canteen/pay:', err);
      return res.status(500).json({ success: false, message: 'Payment failed. Please try again.' });
    }
  },
);

router.post(
  '/canteen/collect',
  validateBody({
    cardUid: CARD_UID,
    orderNumber: { type: 'number', required: true },
  }),
  async (req: Request, res: Response) => {
    try {
      const { cardUid, orderNumber } = req.body;
      const idem = req.header('Idempotency-Key');
      const result = await canteenService.collectOrder(cardUid, Number(orderNumber), idem);
      return res.status(result.success ? 200 : 400).json(result);
    } catch (err) {
      logger.error('Kiosk canteen/collect:', err);
      return res.status(500).json({ success: false, message: 'Collection failed. Please try again.' });
    }
  },
);

export default router;
