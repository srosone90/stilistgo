export const metadata = { title: 'Admin — Stylistgo' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // NOTE: <html> and <body> are already provided by app/layout.tsx.
  // An additional html/body here would produce invalid nested HTML and hydration errors.
  return (
    <div style={{ margin: 0, background: '#0f0f13', color: '#f4f4f5', fontFamily: 'system-ui,sans-serif', minHeight: '100vh' }}>
      {children}
    </div>
  );
}
