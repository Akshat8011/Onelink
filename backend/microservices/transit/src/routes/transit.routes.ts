import { Router } from 'express';
import { TransitController } from '../controllers/transit.controller';

const router = Router();
const transitController = new TransitController();

// Basic middleware to mock auth for now
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { userId: 'usr_akshat_001', name: 'Akshat' };
  next();
};

router.get('/options', transitController.getTransitOptions);
router.post('/ticket', mockAuth, transitController.generateTicket);
router.get('/journey/active', mockAuth, transitController.getActiveJourney);

export default router;
