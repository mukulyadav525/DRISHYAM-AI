import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import LayoutShell from "@/components/LayoutShell";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sentinel 1930 | National Command Dashboard",
  description: "Bharat Anti-Scam Intelligence Grid (BASIG) Master Operational Interface",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className} suppressHydrationWarning>
        <LayoutShell>{children}</LayoutShell>
      </body>
    </html>
  );
}
