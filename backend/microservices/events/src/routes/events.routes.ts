import { Router } from 'express';
import { EventsController } from '../controllers/events.controller';

const router = Router();
const eventsController = new EventsController();

router.get('/live', eventsController.getEvents);
router.get('/live/:eventId', eventsController.getEventById);
router.post('/live/:eventId/book', eventsController.bookEvent);

router.get('/dining', eventsController.getDiningPlaces);

export default router;
