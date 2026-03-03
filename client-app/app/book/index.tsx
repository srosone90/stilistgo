import React, { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { Calendar, DateData } from 'react-native-calendars';
import { Colors } from '@/constants/Colors';
import { fetchAvailableSlots, createBooking, fetchSalonPublicData, type TimeSlot, type Operator, type ClientAppConfig, DEFAULT_CLIENT_APP_CONFIG } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

type Step = 'operator' | 'date' | 'time' | 'confirm';

export default function BookScreen() {
  const params = useLocalSearchParams<{ serviceId: string; serviceName: string; duration: string; price: string; salonId: string }>();
  const { user } = useAuth();

  const [step, setStep] = useState<Step>('operator');
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedOperator, setSelectedOperator] = useState<Operator | null>(null);
  const [selectedDate, setSelectedDate] = useState('');
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [appConfig, setAppConfig] = useState<ClientAppConfig>(DEFAULT_CLIENT_APP_CONFIG);

  useEffect(() => {
    loadOperators();
  }, []);

  useEffect(() => {
    if (selectedDate && step === 'time') {
      loadSlots();
    }
  }, [selectedDate, selectedOperator]);

  async function loadOperators() {
    setLoading(true);
    try {
      const data = await fetchSalonPublicData(params.salonId);
      setOperators(data.operators.filter(o => o.active));
      setAppConfig(data.clientAppConfig);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }

  async function loadSlots() {
    setSlotsLoading(true);
    try {
      const data = await fetchAvailableSlots(
        params.salonId,
        selectedDate,
        params.serviceId,
        selectedOperator?.id,
      );
      setSlots(data);
    } catch {
      setSlots([]);
    } finally {
      setSlotsLoading(false);
    }
  }

  async function handleConfirm() {
    if (!selectedSlot) return;
    const clientName = user?.user_metadata?.full_name ?? '';
    const clientPhone = user?.user_metadata?.phone ?? '';
    const clientEmail = user?.email ?? '';

    setLoading(true);
    try {
      await createBooking({
        salonId: params.salonId,
        clientName,
        clientPhone,
        clientEmail,
        serviceId: params.serviceId,
        serviceName: params.serviceName,
        operatorId: selectedSlot.operatorId,
        date: selectedDate,
        startTime: selectedSlot.start,
        endTime: selectedSlot.end,
        notes,
      });
      Alert.alert(
        '🎉 Prenotazione confermata!',
        appConfig.bookingConfirmationMessage + `\n\n${params.serviceName}\n${formatDate(selectedDate)} alle ${selectedSlot.start}\ncon ${selectedSlot.operatorName}`,
        [{ text: 'Perfetto!', onPress: () => { router.replace('/(tabs)/appointments'); } }]
      );
    } catch (e: unknown) {
      Alert.alert('Errore', e instanceof Error ? e.message : 'Impossibile completare la prenotazione');
    } finally {
      setLoading(false);
    }
  }

  function formatDate(d: string) {
    return new Date(d).toLocaleDateString('it-IT', { weekday: 'long', day: 'numeric', month: 'long' });
  }

  // Min date = oggi + minAdvanceHours
  const minDateObj = new Date(Date.now() + appConfig.minAdvanceHours * 3600000);
  const today = minDateObj.toISOString().slice(0, 10);
  // Max date = maxAdvanceDays giorni
  const maxDate = new Date(Date.now() + appConfig.maxAdvanceDays * 86400000).toISOString().slice(0, 10);

  const STEPS: Step[] = ['operator', 'date', 'time', 'confirm'];
  const stepIndex = STEPS.indexOf(step);

  return (
    <SafeAreaView style={s.safe}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => {
          if (stepIndex === 0) router.back();
          else setStep(STEPS[stepIndex - 1]);
        }}>
          <Text style={s.back}>← Indietro</Text>
        </TouchableOpacity>
        <Text style={s.headerTitle}>{params.serviceName}</Text>
        <Text style={s.headerPrice}>€ {Number(params.price).toFixed(2)}</Text>
      </View>

      {/* Progress */}
      <View style={s.progress}>
        {STEPS.map((st, i) => (
          <View key={st} style={[s.dot, i <= stepIndex && { backgroundColor: Colors.primary }]} />
        ))}
      </View>

      <ScrollView style={s.body} keyboardShouldPersistTaps="handled">

        {/* STEP 1: Scegli operatore */}
        {step === 'operator' && (
          <View style={s.stepBlock}>
            <Text style={s.stepTitle}>Scegli l&apos;operatore</Text>
            <TouchableOpacity
              style={[s.opCard, !selectedOperator && s.opCardSelected]}
              onPress={() => setSelectedOperator(null)}
            >
              <Text style={s.opEmoji}>🎲</Text>
              <View>
                <Text style={s.opName}>Qualsiasi disponibile</Text>
                <Text style={s.opRole}>Ti verrà assegnato il primo libero</Text>
              </View>
            </TouchableOpacity>

            {loading ? <ActivityIndicator color={Colors.primary} style={{ marginTop: 20 }} /> : (
              operators.map(op => (
                <TouchableOpacity
                  key={op.id}
                  style={[s.opCard, selectedOperator?.id === op.id && s.opCardSelected]}
                  onPress={() => setSelectedOperator(op)}
                >
                  <View style={[s.opAvatar, { backgroundColor: op.color ?? Colors.primary }]}>
                    <Text style={{ color: '#fff', fontWeight: '700' }}>{op.name.charAt(0)}</Text>
                  </View>
                  <View>
                    <Text style={s.opName}>{op.name}</Text>
                    <Text style={s.opRole}>{op.role}</Text>
                  </View>
                </TouchableOpacity>
              ))
            )}

            <TouchableOpacity style={s.nextBtn} onPress={() => setStep('date')}>
              <Text style={s.nextBtnText}>Avanti →</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 2: Scegli data */}
        {step === 'date' && (
          <View style={s.stepBlock}>
            <Text style={s.stepTitle}>Scegli la data</Text>
            <Calendar
              minDate={today}
              maxDate={maxDate}
              onDayPress={(day: DateData) => {
                setSelectedDate(day.dateString);
                setSelectedSlot(null);
              }}
              markedDates={selectedDate ? { [selectedDate]: { selected: true, selectedColor: Colors.primary } } : {}}
              theme={{
                backgroundColor: Colors.bgCard,
                calendarBackground: Colors.bgCard,
                textSectionTitleColor: Colors.muted,
                selectedDayBackgroundColor: Colors.primary,
                selectedDayTextColor: '#fff',
                todayTextColor: Colors.primary,
                dayTextColor: Colors.text,
                textDisabledColor: Colors.border,
                arrowColor: Colors.primary,
                monthTextColor: Colors.text,
              }}
              style={{ borderRadius: 14, overflow: 'hidden' }}
            />
            <TouchableOpacity
              style={[s.nextBtn, !selectedDate && s.btnDisabled]}
              onPress={() => selectedDate && setStep('time')}
              disabled={!selectedDate}
            >
              <Text style={s.nextBtnText}>
                {selectedDate ? `Avanti — ${formatDate(selectedDate)}` : 'Seleziona una data'}
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 3: Scegli orario */}
        {step === 'time' && (
          <View style={s.stepBlock}>
            <Text style={s.stepTitle}>Orari disponibili</Text>
            <Text style={s.stepSub}>{formatDate(selectedDate)}</Text>

            {slotsLoading ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 30 }} />
            ) : slots.length === 0 ? (
              <View style={s.noSlots}>
                <Text style={s.noSlotsText}>😕 Nessun orario disponibile per questa data</Text>
                <TouchableOpacity onPress={() => setStep('date')}>
                  <Text style={s.link}>Prova un&apos;altra data</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={s.slotsGrid}>
                {slots.map((slot, i) => (
                  <TouchableOpacity
                    key={i}
                    style={[s.slotBtn, selectedSlot === slot && s.slotBtnSelected, !slot.available && s.slotBtnDisabled]}
                    onPress={() => slot.available && setSelectedSlot(slot)}
                    disabled={!slot.available}
                  >
                    <Text style={[s.slotTime, selectedSlot === slot && { color: '#fff' }]}>{slot.start}</Text>
                    <Text style={[s.slotOp, selectedSlot === slot && { color: '#fff' }]}>{slot.operatorName}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            <TouchableOpacity
              style={[s.nextBtn, !selectedSlot && s.btnDisabled]}
              onPress={() => selectedSlot && setStep('confirm')}
              disabled={!selectedSlot}
            >
              <Text style={s.nextBtnText}>{selectedSlot ? `Conferma ${selectedSlot.start}` : 'Seleziona un orario'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* STEP 4: Conferma */}
        {step === 'confirm' && selectedSlot && (
          <View style={s.stepBlock}>
            <Text style={s.stepTitle}>Riepilogo</Text>

            <View style={s.summaryCard}>
              <SummaryRow icon="✂️" label="Servizio" value={params.serviceName} />
              <SummaryRow icon="📅" label="Data" value={formatDate(selectedDate)} />
              <SummaryRow icon="🕐" label="Orario" value={`${selectedSlot.start} – ${selectedSlot.end}`} />
              <SummaryRow icon="👤" label="Operatore" value={selectedSlot.operatorName} />
              {appConfig.showPrices && <SummaryRow icon="💶" label="Prezzo" value={`€ ${Number(params.price).toFixed(2)}`} />}
            </View>

            <Text style={s.notesLabel}>Note (opzionale)</Text>
            <TextInput
              style={s.notesInput}
              placeholder="Es: allergie, preferenze particolari..."
              placeholderTextColor={Colors.muted}
              value={notes}
              onChangeText={setNotes}
              multiline
              numberOfLines={3}
            />

            {appConfig.cancellationPolicy ? (
              <Text style={s.policy}>{appConfig.cancellationPolicy}</Text>
            ) : null}

            <TouchableOpacity style={s.confirmBtn} onPress={handleConfirm} disabled={loading}>
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.confirmBtnText}>✅ Prenota ora</Text>}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryRow({ icon, label, value }: { icon: string; label: string; value: string }) {
  return (
    <View style={s.summaryRow}>
      <Text style={s.summaryIcon}>{icon}</Text>
      <Text style={s.summaryLabel}>{label}</Text>
      <Text style={s.summaryValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  header: { padding: 20, paddingBottom: 10 },
  back: { color: Colors.primary, fontSize: 14, marginBottom: 6 },
  headerTitle: { fontSize: 22, fontWeight: '800', color: Colors.text },
  headerPrice: { fontSize: 14, color: Colors.muted, marginTop: 2 },
  progress: { flexDirection: 'row', gap: 6, paddingHorizontal: 20, marginBottom: 6 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: Colors.border },
  body: { flex: 1 },
  stepBlock: { padding: 20, gap: 14 },
  stepTitle: { fontSize: 18, fontWeight: '700', color: Colors.text },
  stepSub: { fontSize: 13, color: Colors.muted, marginTop: -8, textTransform: 'capitalize' },
  opCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: Colors.bgCard, borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: Colors.border,
  },
  opCardSelected: { borderColor: Colors.primary, backgroundColor: Colors.primary + '18' },
  opEmoji: { fontSize: 28 },
  opAvatar: { width: 44, height: 44, borderRadius: 22, justifyContent: 'center', alignItems: 'center' },
  opName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  opRole: { fontSize: 12, color: Colors.muted },
  nextBtn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 8 },
  nextBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  btnDisabled: { opacity: 0.4 },
  slotsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  slotBtn: {
    width: '30%', backgroundColor: Colors.bgCard,
    borderRadius: 10, padding: 12, alignItems: 'center',
    borderWidth: 1, borderColor: Colors.border,
  },
  slotBtnSelected: { backgroundColor: Colors.primary, borderColor: Colors.primary },
  slotBtnDisabled: { opacity: 0.3 },
  slotTime: { fontSize: 15, fontWeight: '700', color: Colors.text },
  slotOp: { fontSize: 10, color: Colors.muted, marginTop: 2, textAlign: 'center' },
  noSlots: { alignItems: 'center', paddingVertical: 30, gap: 10 },
  noSlotsText: { color: Colors.muted, fontSize: 14, textAlign: 'center' },
  link: { color: Colors.primary, fontWeight: '600', fontSize: 13 },
  summaryCard: { backgroundColor: Colors.bgCard, borderRadius: 14, borderWidth: 1, borderColor: Colors.border, overflow: 'hidden' },
  summaryRow: { flexDirection: 'row', alignItems: 'center', padding: 14, borderBottomWidth: 1, borderBottomColor: Colors.border, gap: 10 },
  summaryIcon: { fontSize: 16, width: 24 },
  summaryLabel: { fontSize: 13, color: Colors.muted, flex: 1 },
  summaryValue: { fontSize: 13, color: Colors.text, fontWeight: '600' },
  notesLabel: { fontSize: 13, color: Colors.muted },
  notesInput: {
    backgroundColor: Colors.bgInput, borderRadius: 12,
    borderWidth: 1, borderColor: Colors.border,
    padding: 14, color: Colors.text, fontSize: 13, minHeight: 80, textAlignVertical: 'top',
  },
  confirmBtn: { backgroundColor: Colors.success, borderRadius: 12, padding: 18, alignItems: 'center', marginTop: 6 },
  confirmBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  policy: { fontSize: 11, color: Colors.muted, textAlign: 'center', lineHeight: 16, paddingHorizontal: 4 },
});
