import { Router } from 'express';
import { MobilityController } from '../controllers/mobility.controller';

const router = Router();
const mobilityController = new MobilityController();

// Basic middleware to mock auth for now (since we haven't ported JWT auth yet)
const mockAuth = (req: any, res: any, next: any) => {
  req.user = { userId: 'usr_akshat_001', name: 'Akshat' };
  next();
};

router.get('/status', mobilityController.getMobilityStatus);
router.post('/reserve', mockAuth, mobilityController.reserveSpot);
router.post('/release', mockAuth, mobilityController.releaseReservation);

export default router;
