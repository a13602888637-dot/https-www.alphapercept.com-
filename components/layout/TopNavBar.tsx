"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { ArrowLeft, Brain, Globe, LayoutDashboard } from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "交易台", icon: LayoutDashboard },
  { href: "/osint", label: "OSINT 雷达", icon: Globe },
];

export function TopNavBar() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <nav className="flex-shrink-0 h-10 bg-[#060a12] border-b border-[#1a2035]/40 flex items-center px-3 gap-3 z-50">
      {/* Back button */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1 text-[11px] text-gray-400 hover:text-white transition-colors"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        <span className="hidden sm:inline">返回</span>
      </button>

      {/* Divider */}
      <div className="w-px h-4 bg-[#1a2035]" />

      {/* Branding */}
      <Link href="/dashboard" className="flex items-center gap-1.5 mr-2">
        <div className="h-5 w-5 rounded bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
          <Brain className="h-3 w-3 text-white" />
        </div>
        <span className="text-[11px] font-bold text-gray-300 hidden sm:inline">
          Alpha-Quant
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const isActive = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                isActive
                  ? "bg-blue-600/20 text-blue-400"
                  : "text-gray-500 hover:text-gray-300 hover:bg-[#111827]"
              }`}
            >
              <link.icon className="h-3 w-3" />
              {link.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
