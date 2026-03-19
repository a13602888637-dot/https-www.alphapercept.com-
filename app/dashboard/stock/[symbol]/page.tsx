import { AssetDetailView } from "@/components/dashboard/AssetDetailView";

export const metadata = {
  title: "Stock Detail | Alpha-Quant-Copilot",
};

export default async function StockDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <AssetDetailView symbol={symbol} />;
}
