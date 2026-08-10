import { TopNavBar } from "@/components/layout/TopNavBar";

export default function UziReportsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="h-dvh overflow-hidden bg-[#060a12]">
      <div className="flex h-full flex-col">
        <TopNavBar />
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </div>
    </div>
  );
}
