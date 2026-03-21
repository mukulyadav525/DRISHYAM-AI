import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DRISHYAM AI | Simulation Portal",
  description: "DRISHYAM AI — Advanced AI Honeypot & Scam Interception Portal",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="font-sans antialiased bg-boxbg/30">
        {children}
      </body>
    </html>
  );
}
