import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter/wght.css";
import "@fontsource/noto-sans-malayalam/400.css";
import "@fontsource/noto-sans-malayalam/600.css";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "ClientLoop — Review work beautifully",
    template: "%s · ClientLoop",
  },
  description:
    "A fast, focused place to review creative work, share feedback, and keep every version together.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "ClientLoop",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/brand/app-icon.svg", type: "image/svg+xml" },
    ],
    apple: "/icons/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#fffaf5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
