import { TopNavBar } from "@/components/layout/TopNavBar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-dvh flex flex-col bg-[#080b10]">
      <TopNavBar />
      <div className="flex-1">{children}</div>
    </div>
  );
}
