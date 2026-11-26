import type { Metadata, Viewport } from "next";
import "./globals.css";
import { SwRegister } from "@/components/sw-register";

export const metadata: Metadata = {
  title: { default: "Velkomo Signa", template: "%s · Velkomo Signa" },
  description: "Build forms, share them by link or QR, and approve requests by e-mail or in the app.",
  icons: { icon: [{ url: "/favicon.svg", type: "image/svg+xml" }, { url: "/favicon-32.png", sizes: "32x32" }], apple: "/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "Signa", statusBarStyle: "default" },
};
export const viewport: Viewport = { themeColor: "#0B1F4D", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {children}
        <SwRegister />
      </body>
    </html>
  );
}
