import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { TransitJourney } from '../models/TransitJourney';

// UPMRC Red Line Stations (Lucknow)
const LUCKNOW_METRO_STATIONS = [
  'CCS Airport', 'Amausi', 'Transport Nagar', 'Krishna Nagar', 'Singar Nagar',
  'Alambagh', 'Alambagh Bus Stand', 'Mawaiya', 'Durgapuri', 'Charbagh',
  'Hussain Ganj', 'Sachivalaya', 'Hazratganj', 'KD Singh Stadium',
  'Vishwavidyalaya', 'IT College', 'Badshah Nagar', 'Lekhraj Market',
  'Bhootnath Market', 'Indira Nagar', 'Munshipulia'
];

// City Bus Routes (Mock data)
const CITY_BUS_ROUTES = [
  { routeNo: '11', name: 'Charbagh to Munshipulia', stops: ['Charbagh', 'Hazratganj', 'Gomti Nagar', 'Munshipulia'] },
  { routeNo: '33', name: 'Alambagh to Kamta', stops: ['Alambagh Bus Stand', 'Charbagh', 'Polytechnic', 'Kamta'] },
];

export class TransitController {

  /**
   * Get all available transit stations and routes
   */
  async getTransitOptions(req: Request, res: Response) {
    try {
      res.json({
        success: true,
        data: {
          metroStations: LUCKNOW_METRO_STATIONS,
          busRoutes: CITY_BUS_ROUTES
        }
      });
    } catch (error) {
      console.error('Error fetching transit options:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch transit options' });
    }
  }

  /**
   * Generate a Dynamic QR Code Ticket (JWT)
   */
  async generateTicket(req: Request, res: Response) {
    try {
      const { entryStation, exitStation, mode = 'METRO' } = req.body;
      const userId = (req as any).user?.userId || 'unknown';

      // 1. Calculate UPMRC exact fare based on number of stations
      let fare = 10; // Default bus or minimum metro fare
      if (mode === 'METRO' && entryStation && exitStation) {
        const startIndex = LUCKNOW_METRO_STATIONS.indexOf(entryStation);
        const endIndex = LUCKNOW_METRO_STATIONS.indexOf(exitStation);
        
        if (startIndex !== -1 && endIndex !== -1) {
          const stationsTravelled = Math.abs(endIndex - startIndex);
          if (stationsTravelled === 1) fare = 10;
          else if (stationsTravelled === 2) fare = 15;
          else if (stationsTravelled >= 3 && stationsTravelled <= 6) fare = 20;
          else if (stationsTravelled >= 7 && stationsTravelled <= 9) fare = 30;
          else if (stationsTravelled >= 10 && stationsTravelled <= 13) fare = 40;
          else if (stationsTravelled >= 14 && stationsTravelled <= 17) fare = 50;
          else if (stationsTravelled >= 18) fare = 60;
        }
      }

      const journeyId = `JNY_${Date.now()}`;
      const payload = {
        journeyId,
        userId,
        mode,
        entryStation,
        exitStation,
        fare,
        type: 'SINGLE_JOURNEY'
      };

      const secret = process.env.JWT_SECRET || 'onelink_transit_secret';
      const jwtToken = jwt.sign(payload, secret, { expiresIn: '1h' });

      // Save journey as pending (waiting for tap at gate)
      await TransitJourney.create({
        journeyId,
        userId,
        mode,
        entryStation,
        exitStation,
        entryTime: new Date(),
        fare,
        status: 'IN_PROGRESS',
        ticketType: 'JWT_QR',
        jwtToken
      });

      res.json({
        success: true,
        data: {
          journeyId,
          qrToken: jwtToken,
          fare,
          expiresIn: '1 hour'
        }
      });
    } catch (error) {
      console.error('Error generating ticket:', error);
      res.status(500).json({ success: false, message: 'Failed to generate ticket' });
    }
  }

  /**
   * Get active journey
   */
  async getActiveJourney(req: Request, res: Response) {
    try {
      const userId = (req as any).user?.userId || 'unknown';
      const activeJourney = await TransitJourney.findOne({ userId, status: 'IN_PROGRESS' });
      
      res.json({
        success: true,
        data: activeJourney || null
      });
    } catch (error) {
      res.status(500).json({ success: false, message: 'Failed to fetch active journey' });
    }
  }
}
