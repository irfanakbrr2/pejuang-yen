import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import { Toaster } from "sonner";
import TrackingBootstrap from "@/components/tracking/TrackingBootstrap";
import PWAManager from "@/components/pwa/PWAManager";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-jakarta",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PejuangYen — Dashboard",
  description: "Platform belajar & membership untuk PejuangYen.",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "PejuangYen",
  },
  icons: {
    shortcut: "/favicon-64.png",
    icon: "/icon-512.png",
    apple: "/icon-512.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#8B1414",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className={`${jakarta.variable} h-full`}>
      <head>
        <link rel="preconnect" href="https://www.youtube.com" />
        <link rel="dns-prefetch" href="https://img.youtube.com" />
      </head>
      <body className="min-h-full antialiased">
        {/* Google Analytics dinonaktifkan sampai GA4 Measurement ID PejuangYen diisi.
            Untuk mengaktifkan: tambahkan kembali <Script> gtag dengan ID asli. */}
        <TrackingBootstrap />
        <PWAManager />
        {children}
        <Toaster position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
