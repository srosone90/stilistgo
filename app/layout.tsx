import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { SalonProvider } from "@/context/SalonContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";

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
        <ThemeProvider>
          <AppProvider>
            <SalonProvider>
              <NotificationProvider>{children}</NotificationProvider>
            </SalonProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
