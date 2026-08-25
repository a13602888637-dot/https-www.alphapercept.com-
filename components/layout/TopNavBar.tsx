"use client";

import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { UserButton, SignInButton, useUser } from "@clerk/nextjs";
import {
  ArrowLeft,
  Aperture,
  FileChartColumnIncreasing,
  Globe,
  LayoutDashboard,
  LogIn,
} from "lucide-react";

const NAV_LINKS = [
  { href: "/dashboard", label: "今日", icon: LayoutDashboard },
  { href: "/uzi-reports", label: "深度研究", icon: FileChartColumnIncreasing },
  { href: "/osint", label: "OSINT 情报", icon: Globe },
];

export function TopNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { isSignedIn, isLoaded } = useUser();

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
      <Link href="/dashboard" prefetch={false} className="flex items-center gap-1.5 mr-2">
        <div className="h-5 w-5 rounded border border-cyan-300/25 bg-cyan-300/[0.07] flex items-center justify-center">
          <Aperture className="h-3 w-3 text-cyan-300" />
        </div>
        <span className="text-[11px] font-bold text-gray-300 hidden sm:inline">
          AlphaPercept
        </span>
      </Link>

      {/* Nav links */}
      <div className="flex items-center gap-1">
        {NAV_LINKS.map((link) => {
          const isActive =
            pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              prefetch={false}
              aria-label={link.label}
              title={link.label}
              className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-colors ${
                isActive
                  ? "bg-cyan-300/[0.08] text-cyan-300"
                  : "text-gray-500 hover:text-gray-300 hover:bg-[#111827]"
              }`}
            >
              <link.icon className="h-3 w-3" />
              <span className="hidden md:inline">{link.label}</span>
            </Link>
          );
        })}
      </div>

      {/* Spacer */}
      <div className="flex-1" />

      {/* Auth */}
      {isLoaded && (
        <div className="flex items-center">
          {isSignedIn ? (
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-6 w-6",
                },
              }}
              afterSignOutUrl="/sign-in"
            />
          ) : (
            <SignInButton mode="redirect" forceRedirectUrl="/dashboard">
              <button className="flex items-center gap-1 text-[10px] text-gray-400 hover:text-white bg-[#111827] hover:bg-[#1a2035] px-2.5 py-1 rounded transition-colors">
                <LogIn className="h-3 w-3" />
                <span>登录</span>
              </button>
            </SignInButton>
          )}
        </div>
      )}
    </nav>
  );
}
