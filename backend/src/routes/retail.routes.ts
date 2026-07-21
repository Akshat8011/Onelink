import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { ShoppingItem } from '../models/ShoppingItem.js';
import { WalletService } from '../services/wallet.service.js';
import { mqttGateway } from '../services/mqtt-gateway.js';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
const walletService = new WalletService();

import axios from 'axios';

/** GET /api/v1/retail/products — Get all shopping items from FakeStoreAPI */
router.get('/products', async (req, res: Response) => {
  try {
    const { category, search } = req.query;
    let url = 'https://fakestoreapi.com/products';
    if (category && category !== 'All') {
      url = `https://fakestoreapi.com/products/category/${encodeURIComponent(category as string)}`;
    }

    const { data } = await axios.get(url);
    
    // Map FakeStoreAPI format to our app format
    let items = data.map((item: any) => ({
      productId: item.id.toString(),
      name: item.title,
      description: item.description,
      price: Math.round(item.price * 80), // Convert roughly to INR
      category: item.category,
      imageUrl: item.image,
      stock: 50,
      unit: '1 pc'
    }));

    if (search) {
      const s = (search as string).toLowerCase();
      items = items.filter((item: any) => item.name.toLowerCase().includes(s));
    }

    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** GET /api/v1/retail/products/categories — Get all unique categories from FakeStoreAPI */
router.get('/products/categories', async (_req, res: Response) => {
  try {
    const { data } = await axios.get('https://fakestoreapi.com/products/categories');
    res.json({ success: true, data: ['All', ...data] });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

/** POST /api/v1/retail/order — Process shopping cart checkout */
router.post('/order', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const { items, paymentMethod } = req.body;
    // items = [{ itemId, name, quantity, price }]
    if (!items || items.length === 0) {
      return res.status(400).json({ error: 'Cart is empty' });
    }

    // Calculate total
    let total = 0;
    const itemDescriptions: string[] = [];
    for (const item of items) {
      total += item.quantity * item.price;
      itemDescriptions.push(`${item.quantity}x ${item.name}`);
    }

    if (paymentMethod === 'NFC') {
      // Initiate NFC payment via MQTT to ESP32
      const requestId = `pay_req_${uuidv4().substring(0, 8)}`;
      mqttGateway.requestNfcPayment(
        requestId,
        req.user!.userId,
        total,
        'SHOPPING',
        itemDescriptions.join(', ')
      );
      return res.json({
        success: true,
        pending: true,
        requestId,
        total,
        message: 'Tap your NFC card to complete payment',
      });
    }

    // Wallet payment (default)
    const result = await walletService.processPayment(
      req.user!.userId,
      total,
      'SHOPPING',
      paymentMethod || 'WALLET',
      `Shopping: ${itemDescriptions.join(', ')}`,
      { items: itemDescriptions }
    );

    // If the payment did not go through (e.g. insufficient balance / blocked
    // card), return the failure as-is without fabricating a receipt.
    if (!result.success) {
      return res.status(402).json({
        ...result,
        total,
        items: itemDescriptions,
        insufficientBalance: /insufficient/i.test(result.message),
      });
    }

    res.json({
      ...result,
      total,
      items: itemDescriptions,
      receipt: {
        transactionId: result.transactionId,
        date: new Date().toISOString(),
        merchant: 'Smart Hub Mart',
        items: items,
        total,
        pointsEarned: result.rewardPoints,
      },
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
