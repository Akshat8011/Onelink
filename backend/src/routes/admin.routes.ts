import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { requireAdmin } from '../utils/admin.js';
import { User } from '../models/User.js';
import { Transaction } from '../models/Transaction.js';
import { MetroJourney } from '../models/MetroJourney.js';
import { ParkingSpot } from '../models/ParkingSpot.js';
import { CanteenOrder } from '../models/CanteenOrder.js';
import { KioskSound, SOUND_KEYS } from '../models/KioskSound.js';
import { WalletService } from '../services/wallet.service.js';
import { canteenService } from '../services/canteen.service.js';
import { logger } from '../utils/logger.js';

const router = Router();
const walletService = new WalletService();

// Every admin route requires a valid token AND admin privileges.
router.use(authenticate, requireAdmin);

const SOUND_KEY_SET = new Set<string>(SOUND_KEYS as readonly string[]);
const MAX_SOUND_BYTES = 3 * 1024 * 1024; // 3 MB per sound file

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * GET /api/v1/admin/overview — top-line stats for the dashboard.
 */
router.get('/overview', async (_req: AuthRequest, res: Response) => {
  try {
    const today = startOfToday();
    const [
      totalUsers,
      pairedCards,
      blockedCards,
      totalTransactions,
      txToday,
      activeMetro,
      occupiedParking,
      walletAgg,
      spendTodayAgg,
      topUpTodayAgg,
    ] = await Promise.all([
      User.countDocuments({}),
      User.countDocuments({ isCardPaired: true }),
      User.countDocuments({ 'card.isBlocked': true }),
      Transaction.countDocuments({}),
      Transaction.countDocuments({ createdAt: { $gte: today } }),
      MetroJourney.countDocuments({ status: 'IN_PROGRESS' }),
      ParkingSpot.countDocuments({ status: 'OCCUPIED' }),
      User.aggregate([{ $group: { _id: null, total: { $sum: '$wallet.balance' } } }]),
      Transaction.aggregate([
        { $match: { type: 'DEBIT', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Transaction.aggregate([
        { $match: { category: 'TOP_UP', createdAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
    ]);

    res.json({
      success: true,
      overview: {
        totalUsers,
        pairedCards,
        blockedCards,
        totalWalletBalance: walletAgg[0]?.total || 0,
        totalTransactions,
        transactionsToday: txToday,
        spendToday: spendTodayAgg[0]?.total || 0,
        topUpToday: topUpTodayAgg[0]?.total || 0,
        activeMetroJourneys: activeMetro,
        occupiedParking,
      },
    });
  } catch (error) {
    logger.error('Admin overview error:', error);
    res.status(500).json({ error: 'Failed to load overview' });
  }
});

/**
 * GET /api/v1/admin/activity — recent transactions across all users.
 */
router.get('/activity', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 60, 200);
    const txs = await Transaction.find({})
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();

    const userIds = [...new Set(txs.map((t) => t.userId))];
    const users = await User.find({ userId: { $in: userIds } }).select('userId name username').lean();
    const nameById = new Map(users.map((u) => [u.userId, u.name || u.username || u.userId]));

    res.json({
      success: true,
      activity: txs.map((t) => ({
        id: t.transactionId,
        userId: t.userId,
        userName: nameById.get(t.userId) || t.userId,
        type: t.type,
        category: t.category,
        amount: t.amount,
        description: t.description,
        balanceAfter: t.balanceAfter,
        status: t.status,
        createdAt: t.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Admin activity error:', error);
    res.status(500).json({ error: 'Failed to load activity' });
  }
});

/**
 * GET /api/v1/admin/users — searchable user list with balances / card status.
 */
router.get('/users', async (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 100, 300);
    const q = String(req.query.q || '').trim();
    const filter = q
      ? { $or: [
          { name: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
          { username: new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i') },
        ] }
      : {};
    const users = await User.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .select('userId name username wallet.balance card.isBlocked isCardPaired loyaltyPoints memberTier isAdmin createdAt')
      .lean();

    res.json({
      success: true,
      users: users.map((u) => ({
        userId: u.userId,
        name: u.name,
        username: u.username,
        balance: u.wallet?.balance || 0,
        cardBlocked: !!u.card?.isBlocked,
        isCardPaired: !!u.isCardPaired,
        loyaltyPoints: u.loyaltyPoints || 0,
        memberTier: u.memberTier,
        isAdmin: !!u.isAdmin,
        createdAt: u.createdAt,
      })),
    });
  } catch (error) {
    logger.error('Admin users error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

/**
 * GET /api/v1/admin/analytics?days=7 — revenue, category split, daily trend.
 */
router.get('/analytics', async (req: AuthRequest, res: Response) => {
  try {
    const days = Math.min(Math.max(Number(req.query.days) || 7, 1), 60);
    const since = new Date();
    since.setHours(0, 0, 0, 0);
    since.setDate(since.getDate() - (days - 1));

    const [byCategory, totals, dailyRaw, topUsers] = await Promise.all([
      Transaction.aggregate([
        { $group: {
          _id: '$category',
          debit: { $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0] } },
          credit: { $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] } },
          count: { $sum: 1 },
        } },
        { $sort: { debit: -1 } },
      ]),
      Transaction.aggregate([
        { $group: {
          _id: '$type',
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        } },
      ]),
      Transaction.aggregate([
        { $match: { createdAt: { $gte: since } } },
        { $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          debit: { $sum: { $cond: [{ $eq: ['$type', 'DEBIT'] }, '$amount', 0] } },
          credit: { $sum: { $cond: [{ $eq: ['$type', 'CREDIT'] }, '$amount', 0] } },
          count: { $sum: 1 },
        } },
        { $sort: { _id: 1 } },
      ]),
      User.find({}).sort({ 'wallet.balance': -1 }).limit(6)
        .select('name username wallet.balance memberTier loyaltyPoints').lean(),
    ]);

    const totalsMap = new Map(totals.map((t: any) => [t._id, t]));
    const dailyMap = new Map(dailyRaw.map((d: any) => [d._id, d]));
    const dailyTrend: { date: string; debit: number; credit: number; count: number }[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const row = dailyMap.get(key);
      dailyTrend.push({ date: key, debit: row?.debit || 0, credit: row?.credit || 0, count: row?.count || 0 });
    }

    res.json({
      success: true,
      analytics: {
        totalDebit: (totalsMap.get('DEBIT') as any)?.total || 0,
        totalCredit: (totalsMap.get('CREDIT') as any)?.total || 0,
        totalRefund: (totalsMap.get('REFUND') as any)?.total || 0,
        categoryBreakdown: byCategory.map((c: any) => ({
          category: c._id, debit: c.debit, credit: c.credit, count: c.count,
        })),
        dailyTrend,
        topUsers: topUsers.map((u: any) => ({
          name: u.name, username: u.username, balance: u.wallet?.balance || 0,
          memberTier: u.memberTier, loyaltyPoints: u.loyaltyPoints || 0,
        })),
      },
    });
  } catch (error) {
    logger.error('Admin analytics error:', error);
    res.status(500).json({ error: 'Failed to load analytics' });
  }
});

/**
 * GET /api/v1/admin/transit — metro journey stats + recent journeys.
 */
router.get('/transit', async (_req: AuthRequest, res: Response) => {
  try {
    const [total, active, completed, penalty, revenueAgg, recent] = await Promise.all([
      MetroJourney.countDocuments({}),
      MetroJourney.countDocuments({ status: 'IN_PROGRESS' }),
      MetroJourney.countDocuments({ status: 'COMPLETED' }),
      MetroJourney.countDocuments({ status: 'PENALTY' }),
      Transaction.aggregate([
        { $match: { category: 'METRO', type: 'DEBIT' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      MetroJourney.find({}).sort({ createdAt: -1 }).limit(20).lean(),
    ]);

    const userIds = [...new Set(recent.map((j) => j.userId))];
    const users = await User.find({ userId: { $in: userIds } }).select('userId name').lean();
    const nameById = new Map(users.map((u) => [u.userId, u.name]));

    res.json({
      success: true,
      transit: {
        totalJourneys: total,
        activeJourneys: active,
        completedJourneys: completed,
        penaltyJourneys: penalty,
        metroRevenue: revenueAgg[0]?.total || 0,
        metroTxns: revenueAgg[0]?.count || 0,
        recent: recent.map((j) => ({
          id: j.journeyId,
          userName: nameById.get(j.userId) || j.userId,
          entryStation: j.entryStation,
          exitStation: j.exitStation,
          fare: j.fare,
          status: j.status,
          entryTime: j.entryTime,
        })),
      },
    });
  } catch (error) {
    logger.error('Admin transit error:', error);
    res.status(500).json({ error: 'Failed to load transit' });
  }
});

/**
 * GET /api/v1/admin/canteen — canteen orders, queue, revenue & recent activity.
 */
router.get('/canteen', async (_req: AuthRequest, res: Response) => {
  try {
    const today = startOfToday();
    const [
      totalOrders,
      preparing,
      ready,
      collected,
      ordersToday,
      revenueAgg,
      revenueTodayAgg,
      queueDoc,
      recent,
      topItems,
      queueLive,
    ] = await Promise.all([
      CanteenOrder.countDocuments({}),
      CanteenOrder.countDocuments({ status: 'PREPARING' }),
      CanteenOrder.countDocuments({ status: 'READY' }),
      CanteenOrder.countDocuments({ status: 'COLLECTED' }),
      CanteenOrder.countDocuments({ paidAt: { $gte: today } }),
      CanteenOrder.aggregate([
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      CanteenOrder.aggregate([
        { $match: { paidAt: { $gte: today } } },
        { $group: { _id: null, total: { $sum: '$total' }, count: { $sum: 1 } } },
      ]),
      CanteenOrder.findOne({ status: { $in: ['PREPARING', 'READY'] } })
        .sort({ orderNumber: 1 })
        .select('orderNumber')
        .lean(),
      CanteenOrder.find({}).sort({ paidAt: -1 }).limit(25).lean(),
      CanteenOrder.aggregate([
        { $unwind: '$items' },
        {
          $group: {
            _id: '$items.name',
            qty: { $sum: '$items.quantity' },
            revenue: { $sum: { $multiply: ['$items.price', '$items.quantity'] } },
          },
        },
        { $sort: { qty: -1 } },
        { $limit: 8 },
      ]),
      canteenService.getQueue(),
    ]);

    const nowServing = queueLive?.nowServing || 0;

    const userIds = [...new Set(recent.map((o) => o.userId))];
    const users = await User.find({ userId: { $in: userIds } }).select('userId name').lean();
    const nameById = new Map(users.map((u) => [u.userId, u.name]));

    res.json({
      success: true,
      canteen: {
        totalOrders,
        preparing,
        ready,
        collected,
        ordersToday,
        nowServing,
        canteenRevenue: revenueAgg[0]?.total || 0,
        canteenTxns: revenueAgg[0]?.count || 0,
        revenueToday: revenueTodayAgg[0]?.total || 0,
        ordersTodayCount: revenueTodayAgg[0]?.count || ordersToday,
        topItems: topItems.map((t) => ({
          name: t._id || 'Item',
          qty: t.qty,
          revenue: t.revenue,
        })),
        recent: recent.map((o) => ({
          orderId: o.orderId,
          orderNumber: o.orderNumber,
          userName: nameById.get(o.userId) || o.userId,
          total: o.total,
          status: o.status,
          itemCount: o.items?.length || 0,
          paidAt: o.paidAt,
          receiptId: o.receiptId,
        })),
        oldestPending: queueDoc?.orderNumber ?? null,
      },
    });
  } catch (error) {
    logger.error('Admin canteen error:', error);
    res.status(500).json({ error: 'Failed to load canteen' });
  }
});

/**
 * GET /api/v1/admin/parking — parking spot occupancy + revenue.
 */
router.get('/parking', async (_req: AuthRequest, res: Response) => {
  try {
    const [total, free, occupied, reserved, revenueAgg, occupiedSpots] = await Promise.all([
      ParkingSpot.countDocuments({}),
      ParkingSpot.countDocuments({ status: 'FREE' }),
      ParkingSpot.countDocuments({ status: 'OCCUPIED' }),
      ParkingSpot.countDocuments({ status: 'RESERVED' }),
      Transaction.aggregate([
        { $match: { category: 'PARKING', type: 'DEBIT' } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      ParkingSpot.find({ status: 'OCCUPIED' }).sort({ entryTime: 1 }).limit(30).lean(),
    ]);

    const userIds = [...new Set(occupiedSpots.map((s) => s.occupiedBy).filter(Boolean) as string[])];
    const users = await User.find({ userId: { $in: userIds } }).select('userId name').lean();
    const nameById = new Map(users.map((u) => [u.userId, u.name]));

    res.json({
      success: true,
      parking: {
        totalSpots: total,
        free,
        occupied,
        reserved,
        parkingRevenue: revenueAgg[0]?.total || 0,
        parkingTxns: revenueAgg[0]?.count || 0,
        occupiedSpots: occupiedSpots.map((s) => ({
          spotId: s.spotId,
          zone: s.zone,
          userName: s.occupiedBy ? (nameById.get(s.occupiedBy) || s.occupiedBy) : '—',
          entryTime: s.entryTime,
        })),
      },
    });
  } catch (error) {
    logger.error('Admin parking error:', error);
    res.status(500).json({ error: 'Failed to load parking' });
  }
});

/**
 * POST /api/v1/admin/users/:userId/adjust — credit/debit a user's wallet.
 * Body: { type: 'credit' | 'debit', amount, reason }
 */
router.post('/users/:userId/adjust', async (req: AuthRequest, res: Response) => {
  try {
    const { type, amount, reason } = req.body || {};
    const amt = Number(amount);
    if (!Number.isFinite(amt) || amt <= 0) return res.status(400).json({ error: 'Invalid amount' });
    if (type !== 'credit' && type !== 'debit') return res.status(400).json({ error: 'type must be credit or debit' });

    const desc = `Admin ${type}${reason ? ': ' + String(reason).slice(0, 120) : ''}`;
    const result = type === 'credit'
      ? await walletService.credit(req.params.userId, amt, 'OTHER', desc)
      : await walletService.debit(req.params.userId, amt, 'OTHER', desc);

    if (!result.success) return res.status(400).json({ error: result.message });
    res.json({ success: true, userId: req.params.userId, newBalance: result.newBalance });
  } catch (error) {
    logger.error('Admin adjust error:', error);
    res.status(500).json({ error: 'Failed to adjust wallet' });
  }
});

/**
 * POST /api/v1/admin/users/:userId/admin — promote/demote admin.
 * Body: { isAdmin: boolean }
 */
router.post('/users/:userId/admin', async (req: AuthRequest, res: Response) => {
  try {
    const makeAdmin = !!(req.body || {}).isAdmin;
    const user = await User.findOne({ userId: req.params.userId });
    if (!user) return res.status(404).json({ error: 'User not found' });
    user.isAdmin = makeAdmin;
    await user.save();
    res.json({ success: true, userId: req.params.userId, isAdmin: makeAdmin });
  } catch (error) {
    logger.error('Admin promote error:', error);
    res.status(500).json({ error: 'Failed to update role' });
  }
});

/**
 * POST /api/v1/admin/users/:userId/block  |  /unblock — toggle card block.
 */
async function setCardBlocked(userId: string, blocked: boolean, res: Response) {
  const user = await User.findOne({ userId });
  if (!user) return res.status(404).json({ error: 'User not found' });
  user.card.isBlocked = blocked;
  await user.save();
  res.json({ success: true, userId, cardBlocked: blocked });
}

router.post('/users/:userId/block', (req: AuthRequest, res: Response) =>
  setCardBlocked(req.params.userId, true, res).catch(() => res.status(500).json({ error: 'Failed' })));
router.post('/users/:userId/unblock', (req: AuthRequest, res: Response) =>
  setCardBlocked(req.params.userId, false, res).catch(() => res.status(500).json({ error: 'Failed' })));

/**
 * GET /api/v1/admin/sounds — metadata for all customizable sounds.
 */
router.get('/sounds', async (_req: AuthRequest, res: Response) => {
  try {
    const docs = await KioskSound.find({}).select('key mimeType fileName size updatedAt').lean();
    const byKey = new Map(docs.map((d) => [d.key, d]));
    res.json({
      success: true,
      sounds: (SOUND_KEYS as readonly string[]).map((key) => {
        const d = byKey.get(key);
        return {
          key,
          custom: !!d,
          mimeType: d?.mimeType || null,
          fileName: d?.fileName || null,
          size: d?.size || 0,
          updatedAt: d?.updatedAt || null,
        };
      }),
    });
  } catch (error) {
    logger.error('Admin sounds list error:', error);
    res.status(500).json({ error: 'Failed to load sounds' });
  }
});

/**
 * POST /api/v1/admin/sounds/:key — upload/replace a sound (base64 data URI).
 */
router.post('/sounds/:key', async (req: AuthRequest, res: Response) => {
  try {
    const key = req.params.key;
    if (!SOUND_KEY_SET.has(key)) return res.status(400).json({ error: 'Unknown sound key' });

    const { dataUri, mimeType, fileName } = req.body || {};
    if (typeof dataUri !== 'string' || !/^data:audio\/[a-z0-9.+-]+;base64,/i.test(dataUri)) {
      return res.status(400).json({ error: 'dataUri must be a base64 audio data URI' });
    }

    const base64 = dataUri.split(',')[1] || '';
    const size = Math.floor((base64.length * 3) / 4);
    if (size > MAX_SOUND_BYTES) {
      return res.status(413).json({ error: 'Audio too large (max 3 MB)' });
    }

    const detectedMime = (dataUri.match(/^data:(audio\/[a-z0-9.+-]+);/i)?.[1]) || mimeType || 'audio/mpeg';

    const doc = await KioskSound.findOneAndUpdate(
      { key },
      { key, dataUri, mimeType: detectedMime, fileName: String(fileName || '').slice(0, 200), size, updatedBy: req.user?.userId || '' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    );

    res.json({ success: true, key, size: doc.size, mimeType: doc.mimeType, updatedAt: doc.updatedAt });
  } catch (error) {
    logger.error('Admin sound upload error:', error);
    res.status(500).json({ error: 'Failed to save sound' });
  }
});

/**
 * DELETE /api/v1/admin/sounds/:key — revert to the built-in synthesized sound.
 */
router.delete('/sounds/:key', async (req: AuthRequest, res: Response) => {
  try {
    const key = req.params.key;
    if (!SOUND_KEY_SET.has(key)) return res.status(400).json({ error: 'Unknown sound key' });
    await KioskSound.deleteOne({ key });
    res.json({ success: true, key, custom: false });
  } catch (error) {
    logger.error('Admin sound delete error:', error);
    res.status(500).json({ error: 'Failed to delete sound' });
  }
});

export default router;
