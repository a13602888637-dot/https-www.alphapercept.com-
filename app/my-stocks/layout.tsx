import { TopNavBar } from "@/components/layout/TopNavBar";

export default function MyStocksLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <TopNavBar />
      <div className="flex-1 min-h-0 overflow-y-auto">{children}</div>
    </div>
  );
}
