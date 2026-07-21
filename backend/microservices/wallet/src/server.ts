import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import walletRoutes from './routes/wallet.routes';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5005;

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(morgan('dev'));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'wallet-service', version: '1.0.0' });
});

// Routes
app.use('/api/v1/wallet', walletRoutes);

async function startServer() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/onelink';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB Atlas (Wallet DB)');

    app.listen(PORT, () => {
      console.log(`💳 Wallet & Ledger Microservice running on port ${PORT}`);
    });
  } catch (err) {
    console.error('❌ Failed to start Wallet service:', err);
    process.exit(1);
  }
}

startServer();
