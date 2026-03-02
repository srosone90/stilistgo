import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { SalonProvider } from "@/context/SalonContext";

export const metadata: Metadata = {
  title: "Stylistgo — Gestionale",
  description: "Gestione economica e contabilità per Stylistgo",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="it">
      <body className="antialiased">
        <AppProvider>
          <SalonProvider>{children}</SalonProvider>
        </AppProvider>
      </body>
    </html>
  );
}
