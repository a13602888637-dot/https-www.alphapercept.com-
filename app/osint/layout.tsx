import { TopNavBar } from "@/components/layout/TopNavBar";

export default function OSINTLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-dvh flex flex-col overflow-hidden">
      <TopNavBar />
      <div className="flex-1 min-h-0">{children}</div>
    </div>
  );
}
