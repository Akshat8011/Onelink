import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import mobilityRoutes from './routes/mobility.routes';
import { ParkingSpot } from './models/ParkingSpot';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5001;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'mobility-service', version: '1.0.0' });
});

// Routes
app.use('/api/v1/mobility', mobilityRoutes);

async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onelink';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas (Mobility DB)');

    // Initialize mock parking spots if empty
    const count = await ParkingSpot.countDocuments();
    if (count === 0) {
      const spots = ['A1', 'A2', 'A3', 'B1', 'B2', 'B3'];
      for (const spotId of spots) {
        await ParkingSpot.create({
          spotId,
          zone: spotId[0],
          spotNumber: parseInt(spotId[1]),
          status: 'FREE',
          ratePerMinute: 50,
        });
      }
      console.log('✅ Initialized 6 mock parking spots');
    }

    app.listen(PORT, () => {
      console.log(`🚗 Smart Mobility Microservice running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start Mobility service:', err);
    process.exit(1);
  }
}

startServer();
