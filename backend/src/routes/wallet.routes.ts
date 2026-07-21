import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { WalletService } from '../services/wallet.service.js';
import { emitToUser } from '../utils/realtime.js';

const router = Router();
const walletService = new WalletService();

/** GET /api/v1/wallet/dashboard — Get wallet balance & details */
router.get('/dashboard', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const wallet = await walletService.getWallet(req.user!.userId);
    res.json({ success: true, data: wallet });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/wallet/topup — Top up wallet balance */
router.post('/topup', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, source, accountId, bankName } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ error: 'Invalid amount' });
    const result = await walletService.topUp(req.user!.userId, amount, {
      accountId,
      bankName: bankName || source,
    });
    if (!result.success) return res.status(400).json(result);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/v1/wallet/debit — Debit wallet for an in-app financial action */
router.post('/debit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, category, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });
    const result = await walletService.debit(req.user!.userId, amount, category, description || '');
    if (!result.success) return res.status(402).json(result);
    // Let any other logged-in sessions of this user refresh their balance.
    emitToUser(req.user!.userId, 'payment:receipt', {
      newBalance: result.newBalance,
      amount,
      category,
      description,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/v1/wallet/credit — Credit wallet (loan disbursal, investment withdrawal, refund) */
router.post('/credit', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { amount, category, description } = req.body;
    if (!amount || amount <= 0) return res.status(400).json({ success: false, error: 'Invalid amount' });
    const result = await walletService.credit(req.user!.userId, amount, category, description || '');
    emitToUser(req.user!.userId, 'payment:receipt', {
      newBalance: result.newBalance,
      amount,
      category,
      description,
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/wallet/transactions — Get transaction history */
router.get('/transactions', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 20;
    const offset = parseInt(req.query.offset as string) || 0;
    const transactions = await walletService.getTransactions(req.user!.userId, limit, offset);
    res.json(transactions);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/wallet/redeem — Redeem loyalty points */
router.post('/redeem', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { points } = req.body;
    if (!points || points <= 0) return res.status(400).json({ error: 'Invalid points' });
    const result = await walletService.redeemPoints(req.user!.userId, points);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

/** POST /api/v1/wallet/cards/:cardId/toggle — Update NFC card settings */
router.post('/cards/:cardId/toggle', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { setting, value } = req.body;
    const result = await walletService.updateCardSetting(req.user!.userId, setting, value);
    res.json({ success: true, data: result });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

export default router;
