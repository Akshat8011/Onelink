import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.js';
import { canteenService } from '../services/canteen.service.js';
import { validateBody } from '../middleware/validate.js';
import { logger } from '../utils/logger.js';

const router = Router();

/** GET /api/v1/canteen/menu */
router.get('/menu', (_req, res: Response) => {
  const menu = canteenService.getMenu();
  return res.json({ success: true, ...menu });
});

/** POST /api/v1/canteen/push-cart */
router.post(
  '/push-cart',
  authenticate,
  validateBody({
    items: { type: 'array', required: true, min: 1, max: 100 },
    subtotal: { type: 'number', min: 0 },
  }),
  async (req: AuthRequest, res: Response) => {
    try {
      const { items, subtotal } = req.body;
      const userId = req.user!.userId;
      const total =
        subtotal ??
        items.reduce(
          (s: number, i: { price: number; quantity: number }) => s + i.price * i.quantity,
          0,
        );
      const cart = await canteenService.pushCart(userId, items, total);
      return res.status(201).json({ success: true, cartId: cart.cartId, total: cart.total });
    } catch (err) {
      logger.error('Canteen push-cart:', err);
      return res.status(500).json({ success: false, error: 'Failed to push cart' });
    }
  },
);

/** GET /api/v1/canteen/orders */
router.get('/orders', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const data = await canteenService.getOrders(req.user!.userId);
    return res.json({ success: true, ...data });
  } catch (err) {
    logger.error('Canteen orders:', err);
    return res.status(500).json({ success: false, error: 'Failed to load orders' });
  }
});

/** GET /api/v1/canteen/orders/:orderId */
router.get('/orders/:orderId', authenticate, async (req: AuthRequest, res: Response) => {
  try {
    const order = await canteenService.getOrder(req.user!.userId, req.params.orderId);
    if (!order) return res.status(404).json({ success: false, error: 'Order not found' });
    return res.json({ success: true, order });
  } catch (err) {
    logger.error('Canteen order detail:', err);
    return res.status(500).json({ success: false, error: 'Failed to load order' });
  }
});

/** GET /api/v1/canteen/queue — public queue board */
router.get('/queue', async (_req: Request, res: Response) => {
  try {
    const queue = await canteenService.getQueue();
    return res.json({ success: true, ...queue });
  } catch (err) {
    logger.error('Canteen queue:', err);
    return res.status(500).json({ success: false, error: 'Failed to load queue' });
  }
});

export default router;
