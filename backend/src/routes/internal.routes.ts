import { Router, Request, Response } from 'express';
import { env } from '../config/env.js';
import { emitToUser, emitBroadcast } from '../utils/realtime.js';
import { logger } from '../utils/logger.js';

const router = Router();

/**
 * POST /api/v1/internal/notify
 * Called by Vercel kiosk serverless functions to push Socket.IO events to mobile apps.
 * Body: { userId, event, data }
 */
router.post('/notify', (req: Request, res: Response) => {
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  const expected = process.env.INTERNAL_NOTIFY_KEY || env.INTERNAL_NOTIFY_KEY;

  if (!token || token !== expected) {
    return res.status(401).json({ success: false, error: 'Unauthorized' });
  }

  const { userId, event, data, broadcast } = req.body;
  if (!event) {
    return res.status(400).json({ success: false, error: 'event is required' });
  }

  try {
    if (broadcast) {
      emitBroadcast(event, data ?? {});
    } else if (userId) {
      emitToUser(userId, event, data ?? {});
    } else {
      return res.status(400).json({ success: false, error: 'userId or broadcast required' });
    }
    logger.info(`📲 Socket notify: ${event} → ${broadcast ? 'all' : userId}`);
    return res.json({ success: true });
  } catch (err) {
    logger.error('Notify error:', err);
    return res.status(500).json({ success: false, error: 'Notify failed' });
  }
});

export default router;
