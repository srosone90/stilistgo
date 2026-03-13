export const metadata = { title: 'Admin — Stylistgo' };

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ margin: 0, background: 'var(--bg-page)', color: 'var(--foreground)', fontFamily: "'DM Sans', system-ui, sans-serif", minHeight: '100vh' }}>
      {children}
    </div>
  );
}
