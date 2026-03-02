export default function BookingFallback() {
  return (
    <div className="min-h-screen flex items-center justify-center p-8" style={{ background: '#0f0f13' }}>
      <div className="text-center">
        <p className="text-xl font-bold text-white mb-2">Link non valido</p>
        <p className="text-sm" style={{ color: '#71717a' }}>
          Chiedi al salone il link corretto per prenotare online.
        </p>
      </div>
    </div>
  );
}
