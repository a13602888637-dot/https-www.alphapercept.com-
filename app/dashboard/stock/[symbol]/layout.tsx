// Isolated layout for stock detail page.
// The parent /dashboard/layout.tsx adds TopNavBar + flex wrapper.
// We intentionally pass children through unchanged so the
// StockDetailView renders full-height without a double header.
export default function StockDetailLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
