import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import transitRoutes from './routes/transit.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5002;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'transit-service', version: '1.0.0' });
});

// Routes
app.use('/api/v1/transit', transitRoutes);

async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onelink';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas (Transit DB)');

    app.listen(PORT, () => {
      console.log(`🚇 Transit Ticketing Microservice running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start Transit service:', err);
    process.exit(1);
  }
}

startServer();
