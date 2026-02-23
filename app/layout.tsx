import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster } from "@/components/ui/toaster";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Alpha-Quant-Copilot | AI量化交易助手",
  description: "基于五大投资流派融合的AI量化交易分析系统，实时市场数据与智能策略推荐",
  keywords: ["量化投资", "股票分析", "AI助手", "实时数据", "投资策略"],
  authors: [{ name: "Alpha-Quant-Copilot Team" }],
  creator: "Alpha-Quant-Copilot",
  publisher: "Alpha-Quant-Copilot",
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider
      appearance={{
        variables: {
          colorPrimary: "#2563eb",
          colorBackground: "#0f172a",
          colorText: "#f8fafc",
          colorInputBackground: "#1e293b",
          colorInputText: "#f8fafc",
        },
        elements: {
          formButtonPrimary: "bg-blue-600 hover:bg-blue-700",
          card: "bg-slate-900 border-slate-700",
          headerTitle: "text-slate-100",
          headerSubtitle: "text-slate-400",
          socialButtonsBlockButton: "bg-slate-800 border-slate-700 hover:bg-slate-700",
          dividerLine: "bg-slate-700",
          dividerText: "text-slate-400",
          formFieldLabel: "text-slate-300",
          formFieldInput: "bg-slate-800 border-slate-700 text-slate-100",
          footerActionLink: "text-blue-400 hover:text-blue-300",
        },
      }}
    >
      <html lang="zh-CN" suppressHydrationWarning>
        <body className={`${inter.className} antialiased`}>
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <Toaster />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}