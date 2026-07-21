import type { Metadata, Viewport } from 'next';
import KioskApp from '../../components/kiosk/KioskApp';

export const metadata: Metadata = {
  title: 'OneLink Kiosk',
  description: 'OneLink POS terminal',
};

export const viewport: Viewport = {
  width: 480,
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function KioskPage() {
  return <KioskApp />;
}
