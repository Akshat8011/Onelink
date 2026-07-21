import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import proxy from 'express-http-proxy';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(morgan('dev'));

// Microservice Routes mapping
// Smart Mobility (EV & Parking) -> Port 5001
app.use('/api/v1/mobility', proxy('http://localhost:5001', {
  proxyReqPathResolver: (req) => {
    return '/api/v1/mobility' + req.url;
  }
}));

// Transit Ticketing -> Port 5002
app.use('/api/v1/transit', proxy('http://localhost:5002', {
  proxyReqPathResolver: (req) => {
    return '/api/v1/transit' + req.url;
  }
}));

// Events & City -> Port 5003
app.use('/api/v1/city', proxy('http://localhost:5003', {
  proxyReqPathResolver: (req) => {
    return '/api/v1/city' + req.url;
  }
}));

// Retail & Shopping -> Port 5004
app.use('/api/v1/retail', proxy('http://localhost:5004', {
  proxyReqPathResolver: (req) => {
    return '/api/v1/retail' + req.url;
  }
}));

// Wallet & Ledger -> Port 5005
app.use('/api/v1/wallet', proxy('http://localhost:5005', {
  proxyReqPathResolver: (req) => {
    return '/api/v1/wallet' + req.url;
  }
}));

// Other routes will be mapped here as we build them out...

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'onelink-api-gateway',
    version: '1.0.0',
    routes: {
      mobility: 'http://localhost:5001',
      transit: 'http://localhost:5002',
      city: 'http://localhost:5003',
      retail: 'http://localhost:5004',
      wallet: 'http://localhost:5005',
    }
  });
});

app.listen(PORT, () => {
  console.log('═══════════════════════════════════════════');
  console.log(`  🌐 OneLink API Gateway running on port ${PORT}`);
  console.log('═══════════════════════════════════════════');
});
