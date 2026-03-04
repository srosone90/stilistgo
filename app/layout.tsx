import type { Metadata } from "next";
import "./globals.css";
import { AppProvider } from "@/context/AppContext";
import { SalonProvider } from "@/context/SalonContext";
import { ThemeProvider } from "@/context/ThemeContext";
import { NotificationProvider } from "@/context/NotificationContext";
import GdprConsentModal from "@/components/GdprConsentModal";
import CookieBanner from "@/components/CookieBanner";

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
      <head>
        {/* Blocking inline script: sets data-theme BEFORE React hydrates to prevent flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('stylistgo-theme');document.documentElement.setAttribute('data-theme',t==='light'?'light':'dark');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="antialiased">
        <ThemeProvider>
          <AppProvider>
            <SalonProvider>
              <NotificationProvider>
                {children}
                <GdprConsentModal />
                <CookieBanner />
              </NotificationProvider>
            </SalonProvider>
          </AppProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
