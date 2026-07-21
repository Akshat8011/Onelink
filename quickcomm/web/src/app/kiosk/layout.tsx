export default function KioskLayout({ children }: { children: React.ReactNode }) {
  return <div className="kiosk-root overflow-hidden touch-manipulation">{children}</div>;
}
