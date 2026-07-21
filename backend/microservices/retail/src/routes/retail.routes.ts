import { Router } from 'express';
import { RetailController } from '../controllers/retail.controller';

const router = Router();
const retailController = new RetailController();

router.get('/products', retailController.getProducts);
router.get('/products/categories', retailController.getCategories);
router.get('/products/:productId', retailController.getProductById);

router.post('/order', retailController.placeOrder);
router.get('/order/:orderId', retailController.getOrder);

export default router;
