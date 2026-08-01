import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Family Table",
  description: "An AI-driven D&D 5e table for the family.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
