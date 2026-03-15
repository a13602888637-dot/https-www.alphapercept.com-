import { StockDetailView } from "@/components/dashboard/StockDetailView";

export const metadata = {
  title: "Stock Detail | Alpha-Quant-Copilot",
};

export default async function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <StockDetailView symbol={symbol} />;
}
