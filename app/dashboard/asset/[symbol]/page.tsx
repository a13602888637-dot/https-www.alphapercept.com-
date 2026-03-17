import { AssetDetailView } from "@/components/dashboard/AssetDetailView";

export const metadata = {
  title: "Asset Detail | Alpha-Quant-Copilot",
};

export default async function AssetDetailPage({ params }: { params: Promise<{ symbol: string }> }) {
  const { symbol } = await params;
  return <AssetDetailView symbol={decodeURIComponent(symbol)} />;
}
