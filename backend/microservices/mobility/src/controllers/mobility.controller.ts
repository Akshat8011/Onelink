import { Request, Response } from 'express';
import axios from 'axios';
import { EVStation } from '../models/EVStation';
import { ParkingSpot } from '../models/ParkingSpot';

export class MobilityController {
  
  /**
   * Fetches all Smart Mobility data: EV Stations & Parking Spots
   */
  async getMobilityStatus(req: Request, res: Response) {
    try {
      // 1. Get Parking Spots
      const parkingSpots = await ParkingSpot.find().sort({ spotId: 1 }).lean();

      // 2. Try fetching live EV data from API Ninjas (Fallback to DB/Mock on fail)
      let evStations = [];
      try {
        const apiKey = process.env.API_NINJAS_KEY || 'MOCK_KEY';
        const response = await axios.get('https://api.api-ninjas.com/v1/evchargers?city=Lucknow', {
          headers: { 'X-Api-Key': apiKey },
          timeout: 5000 // 5s timeout
        });
        
        // Map API Ninjas format to our schema
        evStations = response.data.map((station: any, index: number) => ({
          stationId: `EV_LKO_${index + 1}`,
          type: 'EV_CHARGING',
          location: {
            type: 'Point',
            coordinates: [station.longitude || 80.9462, station.latitude || 26.8467],
            address: station.street_address || 'Lucknow City Center'
          },
          connectors: [
            { connectorId: 'C1', type: 'Type2', powerKw: 22, status: 'AVAILABLE' },
            { connectorId: 'C2', type: 'CCS2', powerKw: 50, status: 'OCCUPIED' }
          ],
          parkingStatus: 'AVAILABLE',
          ratePerMinute: 20
        }));

      } catch (err) {
        console.warn('API Ninjas EV fetch failed, using fallback database data.');
        // Fallback to database
        evStations = await EVStation.find().lean();
        
        // If DB is empty, provide some default mock data for Lucknow
        if (evStations.length === 0) {
          evStations = [
            {
              stationId: 'EV_LKO_1',
              type: 'EV_CHARGING',
              location: { type: 'Point', coordinates: [80.9462, 26.8467], address: 'Hazratganj EV Point' },
              connectors: [
                { connectorId: 'C1', type: 'CCS2', powerKw: 60, status: 'AVAILABLE' }
              ],
              parkingStatus: 'AVAILABLE',
              ratePerMinute: 25
            },
            {
              stationId: 'EV_LKO_2',
              type: 'EV_CHARGING',
              location: { type: 'Point', coordinates: [80.9833, 26.8600], address: 'Gomti Nagar Charger' },
              connectors: [
                { connectorId: 'C1', type: 'Type2', powerKw: 22, status: 'OCCUPIED' }
              ],
              parkingStatus: 'OCCUPIED',
              ratePerMinute: 15
            }
          ];
        }
      }

      res.json({
        success: true,
        data: {
          parkingSpots,
          evStations
        }
      });
    } catch (error) {
      console.error('Error fetching mobility status:', error);
      res.status(500).json({ success: false, message: 'Failed to fetch mobility data' });
    }
  }

  /**
   * Reserve a parking spot
   */
  async reserveSpot(req: Request, res: Response) {
    try {
      const { spotId, durationMinutes = 120 } = req.body;
      const userId = (req as any).user?.userId || 'unknown'; // assuming auth middleware attaches user

      const spot = await ParkingSpot.findOne({ spotId });
      if (!spot) {
        return res.status(404).json({ success: false, message: 'Spot not found' });
      }
      if (spot.status !== 'FREE') {
        return res.status(400).json({ success: false, message: `Spot ${spotId} is not available.` });
      }

      const reservedUntil = new Date(Date.now() + durationMinutes * 60000);
      spot.status = 'RESERVED';
      spot.occupiedBy = userId;
      spot.reservedUntil = reservedUntil;
      spot.ledColor = 'YELLOW';
      await spot.save();

      res.json({ success: true, message: `Spot ${spotId} reserved successfully`, spotId, reservedUntil });
    } catch (error) {
      console.error('Error reserving spot:', error);
      res.status(500).json({ success: false, message: 'Failed to reserve spot' });
    }
  }

  /**
   * Release a reservation
   */
  async releaseReservation(req: Request, res: Response) {
    try {
      const { spotId } = req.body;
      const spot = await ParkingSpot.findOne({ spotId });
      
      if (spot && spot.status === 'RESERVED') {
        spot.status = 'FREE';
        spot.occupiedBy = null;
        spot.reservedUntil = null;
        spot.ledColor = 'GREEN';
        await spot.save();
        return res.json({ success: true, message: 'Reservation released' });
      }
      
      res.status(400).json({ success: false, message: 'Spot is not reserved' });
    } catch (error) {
      console.error('Error releasing reservation:', error);
      res.status(500).json({ success: false, message: 'Failed to release reservation' });
    }
  }
}
