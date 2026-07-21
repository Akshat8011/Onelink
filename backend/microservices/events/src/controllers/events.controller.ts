import { Request, Response } from 'express';
import { Event } from '../models/Event';
import { DiningPlace } from '../models/DiningPlace';

export class EventsController {
  
  /**
   * Fetch all live events in Lucknow (BookMyShow style)
   */
  async getEvents(req: Request, res: Response) {
    try {
      const events = await Event.find().sort({ date: 1 });
      res.json({ success: true, data: events });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch events' });
    }
  }

  /**
   * Fetch a specific event by ID
   */
  async getEventById(req: Request, res: Response) {
    try {
      const event = await Event.findOne({ eventId: req.params.eventId });
      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
      res.json({ success: true, data: event });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch event' });
    }
  }

  /**
   * Book a ticket to an event
   */
  async bookEvent(req: Request, res: Response) {
    try {
      const { eventId } = req.params;
      const { ticketsCount = 1 } = req.body;
      const event = await Event.findOne({ eventId });

      if (!event) return res.status(404).json({ success: false, message: 'Event not found' });
      if (event.capacity - event.ticketsSold < ticketsCount) {
        return res.status(400).json({ success: false, message: 'Not enough tickets available' });
      }

      event.ticketsSold += ticketsCount;
      await event.save();

      res.json({ 
        success: true, 
        message: 'Tickets booked successfully', 
        data: {
          eventId,
          ticketsBooked: ticketsCount,
          totalPrice: event.price * ticketsCount
        }
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to book event' });
    }
  }

  /**
   * Fetch all Dining Places (Zomato/Dineout style)
   */
  async getDiningPlaces(req: Request, res: Response) {
    try {
      const places = await DiningPlace.find().sort({ rating: -1 });
      res.json({ success: true, data: places });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch dining places' });
    }
  }
}
