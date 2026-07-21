import { Router, Response } from 'express';
import { readFileSync, existsSync } from 'fs';
import { resolve } from 'path';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { Event } from '../models/Event.js';
import { Bill } from '../models/ShoppingItem.js';
import { WalletService } from '../services/wallet.service.js';

const router = Router();
const walletService = new WalletService();

// Resolve from backend cwd (Render/local) or monorepo root when cwd differs
const SCRAPER_JSON_CANDIDATES = [
  resolve(process.cwd(), '../scraper/data/events_lucknow.json'),
  resolve(process.cwd(), 'scraper/data/events_lucknow.json'),
];

function scraperJsonPath(): string {
  return SCRAPER_JSON_CANDIDATES.find((p) => existsSync(p)) ?? SCRAPER_JSON_CANDIDATES[0];
}

function loadScrapedPayload() {
  const path = scraperJsonPath();
  if (!existsSync(path)) return null;
  try {
    const raw = readFileSync(path, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

/** GET /api/v1/city/live/bms — Live BookMyShow scrape JSON for the mobile app */
router.get('/live/bms', async (_req, res: Response) => {
  try {
    const payload = loadScrapedPayload();
    if (!payload?.events?.length) {
      return res.status(404).json({ success: false, error: 'Scraped events file not found' });
    }
    res.json({ success: true, data: payload });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/v1/city/live — Get all active events, optional category/search filter */
router.get('/live', async (req, res: Response) => {
  try {
    const { category, search, sort } = req.query;
    const filter: any = {};
    if (category && category !== 'All') filter.category = category;
    if (search) filter.title = { $regex: search, $options: 'i' };

    let sortBy: any = { date: 1 };
    if (sort === 'price_low') sortBy = { price: 1 };
    if (sort === 'price_high') sortBy = { price: -1 };
    if (sort === 'popularity') sortBy = { ticketsSold: -1 };

    const events = await Event.find(filter).sort(sortBy).lean();

    if (!events.length) {
      const payload = loadScrapedPayload();
      if (payload?.events?.length) {
        return res.json({ success: true, data: payload.events, source: 'bookmyshow_scraper' });
      }
    }
    
    // Map to frontend interface
    const mappedEvents = events.map(e => ({
      eventId: e.eventId,
      title: e.name,
      description: e.type,
      venue: e.venue,
      city: e.city,
      date: e.date,
      price: e.pricing.basePrice,
      capacity: e.tickets.total,
      ticketsSold: e.tickets.sold,
      category: e.category,
      imageUrl: e.image,
      bookMyShowUrl: e.bookMyShowUrl,
      displayTime: e.displayTime
    }));

    res.json({ success: true, data: mappedEvents });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/v1/city/live/:eventId/book — Book an event ticket */
router.post('/live/:eventId/book', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { eventId, paymentMethod } = req.body;
    if (!eventId) return res.status(400).json({ error: 'eventId required' });

    const event = await Event.findOne({ eventId });
    if (!event) return res.status(404).json({ error: 'Event not found' });
    if (event.tickets.available <= 0) return res.status(400).json({ error: 'Sold out!' });

    // Process payment
    const result = await walletService.processPayment(
      req.user!.userId,
      event.pricing.basePrice,
      'EVENT',
      paymentMethod || 'WALLET',
      `Event Ticket: ${event.name}`,
      { eventName: event.name }
    );

    if (result.success) {
      event.tickets.available -= 1;
      event.tickets.sold += 1;
      await event.save();
    }

    res.json({
      ...result,
      event: { name: event.name, date: event.date, venue: event.venue },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// ═══════════════════════════════════════
// BILLS
// ═══════════════════════════════════════

/** GET /api/city/bills — Get user's pending and paid bills */
router.get('/bills', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const bills = await Bill.find({ userId: req.user!.userId }).sort({ dueDate: 1 }).lean();
    const pending = bills.filter(b => !b.isPaid);
    const paid = bills.filter(b => b.isPaid);
    res.json({ pending, paid, totalPending: pending.reduce((s, b) => s + b.amount, 0) });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/city/bills/pay — Pay a bill */
router.post('/bills/pay', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { billId, paymentMethod } = req.body;
    if (!billId) return res.status(400).json({ error: 'billId required' });

    const bill = await Bill.findOne({ billId, userId: req.user!.userId });
    if (!bill) return res.status(404).json({ error: 'Bill not found' });
    if (bill.isPaid) return res.status(400).json({ error: 'Bill already paid' });

    const result = await walletService.processPayment(
      req.user!.userId,
      bill.amount,
      'BILL_PAY',
      paymentMethod || 'WALLET',
      `Bill Payment: ${bill.name} (${bill.provider})`,
      { billName: bill.name }
    );

    if (result.success) {
      bill.isPaid = true;
      bill.paidAt = new Date();
      bill.transactionId = result.transactionId;
      await bill.save();
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/city/bills/pay-all — Pay all pending bills */
router.post('/bills/pay-all', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const pendingBills = await Bill.find({ userId: req.user!.userId, isPaid: false });
    if (pendingBills.length === 0) return res.json({ success: true, message: 'No pending bills' });

    const totalAmount = pendingBills.reduce((s, b) => s + b.amount, 0);
    const result = await walletService.processPayment(
      req.user!.userId,
      totalAmount,
      'BILL_PAY',
      'WALLET',
      `Bulk Bill Payment (${pendingBills.length} bills)`,
      { billName: 'Multiple Bills' }
    );

    if (result.success) {
      for (const bill of pendingBills) {
        bill.isPaid = true;
        bill.paidAt = new Date();
        bill.transactionId = result.transactionId;
        await bill.save();
      }
    }

    res.json({ ...result, billsPaid: pendingBills.length, totalAmount });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
