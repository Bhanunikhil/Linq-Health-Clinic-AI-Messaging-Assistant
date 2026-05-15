import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Linq Health Clinic — Admin Dashboard",
  description: "Real-time appointment management dashboard for Linq Health Clinic powered by AI.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
