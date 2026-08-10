import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { Toaster as ShadcnToaster } from "@/components/ui/toaster";
import { Toaster as SonnerToaster } from "sonner";
import "./globals.css";

export const metadata: Metadata = {
  title: "AlphaPercept | 个人投资助理",
  description: "围绕个人持仓的实时监测、行动条件与 Uzi 深度研判。",
  keywords: ["个人投资助理", "持仓监测", "股票分析", "Uzi 深度研判"],
  authors: [{ name: "AlphaPercept" }],
  creator: "AlphaPercept",
  publisher: "AlphaPercept",
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
        <body className="antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            disableTransitionOnChange
          >
            {children}
            <ShadcnToaster />
            <SonnerToaster position="top-right" theme="dark" richColors />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
