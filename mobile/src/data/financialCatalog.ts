export interface StockQuote {
  symbol: string;
  name: string;
  exchange: 'NSE';
  sector: string;
  basePrice: number;
}

export interface FdRate {
  bank: string;
  tenure: string;
  rate: number;
  minAmount: number;
}

export interface MutualFund {
  id: string;
  name: string;
  category: string;
  oneYearReturn: number;
  risk: 'Low' | 'Moderate' | 'High';
  minSip: number;
}

export interface LoanProduct {
  bank: string;
  type: string;
  rateMin: number;
  rateMax: number;
  maxAmount: number;
  maxTenureYears: number;
}

export interface InsurancePlan {
  id: string;
  provider: string;
  type: 'Health' | 'Life' | 'Vehicle' | 'Travel';
  planName: string;
  coverAmount: number;
  monthlyPremium: number;
  annualPremium: number;
  eligibility: string;
  benefits: string[];
  waitingPeriod?: string;
}

export const NSE_STOCKS: StockQuote[] = [
  { symbol: 'RELIANCE', name: 'Reliance Industries', exchange: 'NSE', sector: 'Energy', basePrice: 2945 },
  { symbol: 'TCS', name: 'Tata Consultancy Services', exchange: 'NSE', sector: 'IT', basePrice: 4120 },
  { symbol: 'HDFCBANK', name: 'HDFC Bank', exchange: 'NSE', sector: 'Banking', basePrice: 1685 },
  { symbol: 'INFY', name: 'Infosys', exchange: 'NSE', sector: 'IT', basePrice: 1825 },
  { symbol: 'ICICIBANK', name: 'ICICI Bank', exchange: 'NSE', sector: 'Banking', basePrice: 1248 },
  { symbol: 'SBIN', name: 'State Bank of India', exchange: 'NSE', sector: 'Banking', basePrice: 825 },
  { symbol: 'BHARTIARTL', name: 'Bharti Airtel', exchange: 'NSE', sector: 'Telecom', basePrice: 1585 },
  { symbol: 'ITC', name: 'ITC Ltd', exchange: 'NSE', sector: 'FMCG', basePrice: 465 },
  { symbol: 'LT', name: 'Larsen & Toubro', exchange: 'NSE', sector: 'Infra', basePrice: 3580 },
  { symbol: 'MARUTI', name: 'Maruti Suzuki', exchange: 'NSE', sector: 'Auto', basePrice: 12450 },
];

export const FD_RATES: FdRate[] = [
  { bank: 'SBI', tenure: '1 year', rate: 7.0, minAmount: 1000 },
  { bank: 'HDFC Bank', tenure: '1 year', rate: 7.25, minAmount: 5000 },
  { bank: 'ICICI Bank', tenure: '1 year', rate: 7.2, minAmount: 10000 },
  { bank: 'Axis Bank', tenure: '1 year', rate: 7.1, minAmount: 5000 },
  { bank: 'PNB', tenure: '1 year', rate: 6.9, minAmount: 1000 },
  { bank: 'Post Office', tenure: '5 years', rate: 7.5, minAmount: 1000 },
];

export const MUTUAL_FUNDS: MutualFund[] = [
  { id: 'mf_1', name: 'SBI Bluechip Fund', category: 'Large Cap', oneYearReturn: 18.4, risk: 'Moderate', minSip: 500 },
  { id: 'mf_2', name: 'Axis Midcap Fund', category: 'Mid Cap', oneYearReturn: 24.1, risk: 'High', minSip: 500 },
  { id: 'mf_3', name: 'Parag Parikh Flexi Cap', category: 'Flexi Cap', oneYearReturn: 21.6, risk: 'Moderate', minSip: 1000 },
  { id: 'mf_4', name: 'HDFC Short Term Debt', category: 'Debt', oneYearReturn: 7.8, risk: 'Low', minSip: 500 },
];

export const LOAN_PRODUCTS: LoanProduct[] = [
  { bank: 'SBI', type: 'Home Loan', rateMin: 8.5, rateMax: 9.2, maxAmount: 50000000, maxTenureYears: 30 },
  { bank: 'HDFC Bank', type: 'Home Loan', rateMin: 8.6, rateMax: 9.4, maxAmount: 100000000, maxTenureYears: 30 },
  { bank: 'ICICI Bank', type: 'Personal Loan', rateMin: 10.5, rateMax: 16.0, maxAmount: 5000000, maxTenureYears: 5 },
  { bank: 'Axis Bank', type: 'Personal Loan', rateMin: 10.75, rateMax: 15.5, maxAmount: 4000000, maxTenureYears: 5 },
  { bank: 'Bajaj Finserv', type: 'Personal Loan', rateMin: 11.0, rateMax: 17.0, maxAmount: 3500000, maxTenureYears: 5 },
  { bank: 'SBI', type: 'Car Loan', rateMin: 8.75, rateMax: 9.5, maxAmount: 2000000, maxTenureYears: 7 },
  { bank: 'HDFC Bank', type: 'Education Loan', rateMin: 9.0, rateMax: 12.0, maxAmount: 7500000, maxTenureYears: 15 },
];

export const INSURANCE_PLANS: InsurancePlan[] = [
  {
    id: 'ins_h1', provider: 'Star Health', type: 'Health', planName: 'Comprehensive',
    coverAmount: 500000, monthlyPremium: 899, annualPremium: 10499,
    eligibility: 'Age 18–65, no pre-existing for 48 months',
    benefits: ['Cashless at 14,000+ hospitals', 'No room rent cap', 'AYUSH covered', 'Annual health check-up'],
    waitingPeriod: '30 days general, 24 months pre-existing',
  },
  {
    id: 'ins_h2', provider: 'HDFC ERGO', type: 'Health', planName: 'Optima Secure',
    coverAmount: 1000000, monthlyPremium: 1249, annualPremium: 14599,
    eligibility: 'Age 18–60, medical test above ₹50L cover',
    benefits: ['Restore benefit 100%', 'Worldwide emergency', 'Maternity add-on', 'OPD rider available'],
    waitingPeriod: '30 days',
  },
  {
    id: 'ins_l1', provider: 'LIC', type: 'Life', planName: 'Jeevan Anand',
    coverAmount: 2500000, monthlyPremium: 2150, annualPremium: 24800,
    eligibility: 'Age 18–50, income proof required',
    benefits: ['Death + maturity benefit', 'Bonus accrued', 'Loan against policy', 'Tax benefit 80C'],
  },
  {
    id: 'ins_v1', provider: 'ICICI Lombard', type: 'Vehicle', planName: 'Motor Comprehensive',
    coverAmount: 800000, monthlyPremium: 1850, annualPremium: 21500,
    eligibility: 'Private car up to 10 years old',
    benefits: ['Own damage + third party', 'Zero dep add-on', 'Engine protect', '24x7 roadside'],
  },
  {
    id: 'ins_t1', provider: 'Tata AIG', type: 'Travel', planName: 'International Gold',
    coverAmount: 500000, monthlyPremium: 450, annualPremium: 5200,
    eligibility: 'Indian passport holders, trip up to 180 days',
    benefits: ['Medical up to $250K', 'Trip cancellation', 'Baggage loss', 'Flight delay'],
  },
];

/** Simulated live NSE price with small daily drift */
export function liveStockPrice(stock: StockQuote): { price: number; changePct: number } {
  const day = Math.floor(Date.now() / 86400000);
  let hash = 0;
  for (let i = 0; i < stock.symbol.length; i++) hash += stock.symbol.charCodeAt(i);
  const drift = (((day + hash) % 401) - 200) / 10000;
  const price = Math.round(stock.basePrice * (1 + drift) * 100) / 100;
  const changePct = Math.round(drift * 10000) / 100;
  return { price, changePct };
}

export function calcEmi(principal: number, annualRate: number, tenureMonths: number): {
  emi: number;
  totalPayment: number;
  totalInterest: number;
} {
  if (tenureMonths <= 0 || principal <= 0) return { emi: 0, totalPayment: 0, totalInterest: 0 };
  const r = annualRate / 12 / 100;
  if (r === 0) {
    const emi = principal / tenureMonths;
    return { emi, totalPayment: principal, totalInterest: 0 };
  }
  const pow = Math.pow(1 + r, tenureMonths);
  const emi = (principal * r * pow) / (pow - 1);
  const totalPayment = emi * tenureMonths;
  return {
    emi: Math.round(emi),
    totalPayment: Math.round(totalPayment),
    totalInterest: Math.round(totalPayment - principal),
  };
}

export function billPenalty(amount: number, dueDate: string, penaltyPerDay = 0.02): number {
  const due = new Date(dueDate);
  const now = new Date();
  if (now <= due) return 0;
  const days = Math.ceil((now.getTime() - due.getTime()) / 86400000);
  return Math.round(amount * penaltyPerDay * days);
}
