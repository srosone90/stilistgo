// Connessione al gestionale tramite le sue API esistenti
const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000';

// --- Tipi ---

export interface SalonInfo { name: string; address?: string; phone?: string; }

export interface ClientAppConfig {
  welcomeMessage: string;
  aboutText: string;
  accentColor: string;
  showPrices: boolean;
  requireLoginForBooking: boolean;
  maxAdvanceDays: number;
  minAdvanceHours: number;
  contactPhone: string;
  contactAddress: string;
  instagramHandle: string;
  facebookUrl: string;
  cancellationPolicy: string;
  bookingConfirmationMessage: string;
}

export const DEFAULT_CLIENT_APP_CONFIG: ClientAppConfig = {
  welcomeMessage: 'Benvenuta! 💇‍♀️',
  aboutText: '',
  accentColor: '#c084fc',
  showPrices: true,
  requireLoginForBooking: true,
  maxAdvanceDays: 90,
  minAdvanceHours: 2,
  contactPhone: '',
  contactAddress: '',
  instagramHandle: '',
  facebookUrl: '',
  cancellationPolicy: 'Per cancellare o modificare l\'appuntamento si prega di avvisare almeno 24 ore prima.',
  bookingConfirmationMessage: 'Prenotazione confermata! Ti aspettiamo. 🌸',
};

export interface Operator {
  id: string; name: string; role?: string; active: boolean; color?: string;
}

export interface Service {
  id: string; name: string; duration: number; price: number;
  category?: string; color?: string; active: boolean;
}

export interface TimeSlot {
  start: string; end: string;
  operatorId: string; operatorName: string; available: boolean;
}

export interface BookingPayload {
  salonId: string; clientName: string; clientPhone: string; clientEmail?: string;
  serviceId: string; serviceName: string; operatorId?: string;
  date: string; startTime: string; endTime: string; notes?: string;
}

// --- Fetch dati pubblici salone ---
export async function fetchSalonPublicData(salonId: string): Promise<{
  salon: SalonInfo; services: Service[]; operators: Operator[]; clientAppConfig: ClientAppConfig;
}> {
  const res = await fetch(`${BASE_URL}/api/booking-slots?salonId=${salonId}`);
  if (!res.ok) throw new Error('Errore nel caricamento dati salone');
  const data = await res.json();
  return {
    salon: { name: data.salonName ?? 'Le Ribelle Salon' },
    services: (data.services ?? []).map((s: Service) => ({ ...s, price: s.price ?? 0, active: true })),
    operators: (data.operators ?? []).map((o: Operator) => ({ ...o, active: true })),
    clientAppConfig: { ...DEFAULT_CLIENT_APP_CONFIG, ...(data.clientAppConfig ?? {}) },
  };
}

// --- Fetch slot disponibili ---
export async function fetchAvailableSlots(
  salonId: string, date: string, serviceId: string, operatorId?: string
): Promise<TimeSlot[]> {
  const salonData = await fetchSalonPublicData(salonId);
  const service = salonData.services.find(s => s.id === serviceId);
  const duration = service?.duration ?? 30;
  const operatorsToCheck = operatorId
    ? salonData.operators.filter(o => o.id === operatorId)
    : salonData.operators;

  const allSlots: TimeSlot[] = [];
  for (const op of operatorsToCheck) {
    const res = await fetch(`${BASE_URL}/api/booking-slots?salonId=${salonId}&date=${date}&operatorId=${op.id}`);
    if (!res.ok) continue;
    const data = await res.json();
    for (const slot of (data.available ?? []) as string[]) {
      allSlots.push({ start: slot, end: addMinutes(slot, duration), operatorId: op.id, operatorName: op.name, available: true });
    }
  }
  allSlots.sort((a, b) => a.start.localeCompare(b.start) || a.operatorName.localeCompare(b.operatorName));
  return allSlots;
}

// --- Crea prenotazione ---
export async function createBooking(payload: BookingPayload): Promise<{ id: string }> {
  const res = await fetch(`${BASE_URL}/api/bookings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientName: payload.clientName, clientPhone: payload.clientPhone, clientEmail: payload.clientEmail,
      service: payload.serviceName, serviceIds: [payload.serviceId], operatorId: payload.operatorId,
      preferredDate: payload.date, preferredTime: payload.startTime,
      notes: payload.notes ?? '', salonId: payload.salonId,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(err.error ?? 'Errore nella prenotazione');
  }
  return res.json();
}

function addMinutes(time: string, minutes: number): string {
  const [h, m] = time.split(':').map(Number);
  const total = h * 60 + m + minutes;
  return `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
}
