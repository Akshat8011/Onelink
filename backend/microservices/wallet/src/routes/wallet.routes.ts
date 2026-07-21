import { Router } from 'express';
import { WalletController } from '../controllers/wallet.controller';

const router = Router();
const walletController = new WalletController();

router.get('/dashboard', walletController.getDashboard);
router.post('/add-funds', walletController.addFunds);
router.post('/cards/:cardId/toggle', walletController.toggleCardSetting);
router.post('/cards/:cardId/limit', walletController.updateCardLimit);

export default router;
