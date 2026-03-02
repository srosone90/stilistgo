export const metadata = { title: 'Admin — Stylistgo' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="it">
      <body style={{ margin: 0, background: '#0f0f13', color: '#f4f4f5', fontFamily: 'system-ui,sans-serif' }}>
        {children}
      </body>
    </html>
  );
}
