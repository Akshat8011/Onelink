/** Lucknow events — live BookMyShow scraped data shape */
export interface LiveEvent {
  eventId: string;
  title: string;
  description: string;
  venue: string;
  city: string;
  date: string;
  showTime?: string;
  displayTime?: string;
  price: number;
  capacity: number;
  ticketsSold: number;
  category: string;
  imageUrl: string;
  source: 'bookmyshow' | 'paytm_insider' | 'onelink';
  bookingUrl: string;
  bookMyShowUrl?: string;
  artist?: string;
  syncedAt?: string;
  language?: string;
  censorRating?: string;
  userRating?: string;
  heartCount?: string;
  scrapedAt?: string;
  isLiveData?: boolean;
}
