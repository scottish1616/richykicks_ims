import type { Metadata } from "next";
import "./globals.css";
import Providers from "./providers";

export const metadata: Metadata = {
  title: "RichyKicks Inventory Management System",
  description: "Internal inventory & sales management for RichyKicks.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-midnight text-ivory antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
