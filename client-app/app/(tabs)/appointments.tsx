import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, ActivityIndicator,
  TouchableOpacity, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/context/AuthContext';

interface Appointment {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  service_name: string;
  operator_name: string;
  status: string;
  notes?: string;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  confirmed:  { label: 'Confermato',  color: '#22c55e' },
  pending:    { label: 'In attesa',   color: '#f59e0b' },
  completed:  { label: 'Completato',  color: '#6366f1' },
  cancelled:  { label: 'Annullato',   color: '#ef4444' },
  'no-show':  { label: 'Non presentato', color: '#ef4444' },
};

export default function AppointmentsScreen() {
  const { user } = useAuth();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);

  useFocusEffect(useCallback(() => { loadAppointments(); }, [user]));

  async function loadAppointments() {
    if (!user?.email) return;
    setLoading(true);
    try {
      // Legge le prenotazioni create da questo cliente (filtrate per email)
      const { data, error } = await supabase
        .storage
        .from('salon-data')
        .list('');

      // Le prenotazioni sono salvate in salon-data/{salonId}.json
      // Recuperiamo tutti i file e filtriamo gli appuntamenti per email cliente
      if (error) throw error;

      const myAppointments: Appointment[] = [];

      for (const file of (data ?? [])) {
        if (!file.name.endsWith('.json')) continue;
        const { data: fileData } = await supabase.storage
          .from('salon-data')
          .download(file.name);
        if (!fileData) continue;
        try {
          const text = await fileData.text();
          const state = JSON.parse(text);
          const appts: Appointment[] = (state.appointments ?? [])
            .filter((a: { clientEmail?: string; clientPhone?: string; status: string }) =>
              a.clientEmail === user.email || a.clientPhone === user.user_metadata?.phone
            )
            .map((a: {
              id: string; date: string; startTime: string; endTime: string;
              serviceName?: string; services?: string[]; operatorName?: string; status: string; notes?: string;
            }) => ({
              id: a.id,
              date: a.date,
              start_time: a.startTime,
              end_time: a.endTime,
              service_name: a.serviceName ?? a.services?.join(', ') ?? '',
              operator_name: a.operatorName ?? '',
              status: a.status,
              notes: a.notes,
            }));
          myAppointments.push(...appts);
        } catch { /* skip invalid */ }
      }

      myAppointments.sort((a, b) => `${b.date}${b.start_time}`.localeCompare(`${a.date}${a.start_time}`));
      setAppointments(myAppointments);
    } catch (e) {
      console.warn('loadAppointments error:', e);
    } finally {
      setLoading(false);
    }
  }

  function formatDate(date: string) {
    const d = new Date(date);
    return d.toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  const upcoming = appointments.filter(a => a.date >= new Date().toISOString().slice(0, 10) && a.status !== 'cancelled');
  const past = appointments.filter(a => a.date < new Date().toISOString().slice(0, 10) || a.status === 'cancelled');

  return (
    <SafeAreaView style={s.safe}>
      <View style={s.topBar}>
        <Text style={s.title}>I miei appuntamenti</Text>
      </View>
      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 60 }} />
      ) : appointments.length === 0 ? (
        <View style={s.empty}>
          <Text style={s.emptyIcon}>📅</Text>
          <Text style={s.emptyTitle}>Nessun appuntamento</Text>
          <Text style={s.emptySub}>Prenota il tuo primo appuntamento dalla schermata principale</Text>
        </View>
      ) : (
        <FlatList
          data={[
            ...(upcoming.length ? [{ type: 'header', label: 'Prossimi' }] : []),
            ...upcoming.map(a => ({ type: 'item', ...a })),
            ...(past.length ? [{ type: 'header', label: 'Passati' }] : []),
            ...past.map(a => ({ type: 'item', ...a })),
          ]}
          keyExtractor={(item, i) => item.type === 'header' ? `h-${i}` : (item as Appointment).id}
          contentContainerStyle={{ padding: 20, gap: 10 }}
          renderItem={({ item }) => {
            if (item.type === 'header') {
              return <Text style={s.sectionLabel}>{(item as { label: string }).label}</Text>;
            }
            const appt = item as Appointment;
            const st = STATUS_LABELS[appt.status] ?? { label: appt.status, color: Colors.muted };
            return (
              <View style={s.card}>
                <View style={s.cardTop}>
                  <Text style={s.cardService}>{appt.service_name}</Text>
                  <View style={[s.badge, { backgroundColor: st.color + '22' }]}>
                    <Text style={[s.badgeText, { color: st.color }]}>{st.label}</Text>
                  </View>
                </View>
                <Text style={s.cardDate}>{formatDate(appt.date)}</Text>
                <Text style={s.cardTime}>🕐 {appt.start_time} – {appt.end_time}</Text>
                {appt.operator_name ? <Text style={s.cardOp}>👤 {appt.operator_name}</Text> : null}
                {appt.notes ? <Text style={s.cardNotes}>{appt.notes}</Text> : null}
              </View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  topBar: { padding: 20, paddingBottom: 10 },
  title: { fontSize: 22, fontWeight: '800', color: Colors.text },
  sectionLabel: { fontSize: 12, fontWeight: '700', color: Colors.muted, textTransform: 'uppercase', letterSpacing: 1 },
  card: { backgroundColor: Colors.bgCard, borderRadius: 14, padding: 16, borderWidth: 1, borderColor: Colors.border, gap: 4 },
  cardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  cardService: { fontSize: 15, fontWeight: '700', color: Colors.text, flex: 1 },
  badge: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 3 },
  badgeText: { fontSize: 11, fontWeight: '600' },
  cardDate: { fontSize: 13, color: Colors.text2, textTransform: 'capitalize' },
  cardTime: { fontSize: 13, color: Colors.muted },
  cardOp: { fontSize: 13, color: Colors.muted },
  cardNotes: { fontSize: 12, color: Colors.muted, fontStyle: 'italic', marginTop: 4 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 40 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: Colors.text, marginBottom: 6 },
  emptySub: { fontSize: 13, color: Colors.muted, textAlign: 'center' },
});
