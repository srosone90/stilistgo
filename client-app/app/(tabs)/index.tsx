import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  ActivityIndicator, Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors } from '@/constants/Colors';
import { fetchSalonPublicData, type Service, type Operator, type ClientAppConfig, DEFAULT_CLIENT_APP_CONFIG } from '@/lib/api';
import { useAuth } from '@/context/AuthContext';

// ID del salone — corrisponde all'userId del titolare nel gestionale
// Da impostare in .env oppure hardcoded per app monosalone
const SALON_ID = process.env.EXPO_PUBLIC_SALON_ID ?? '';

export default function HomeScreen() {
  const { user } = useAuth();
  const [services, setServices] = useState<Service[]>([]);
  const [operators, setOperators] = useState<Operator[]>([]);
  const [salonName, setSalonName] = useState('Le Ribelle Salon');
  const [appConfig, setAppConfig] = useState<ClientAppConfig>(DEFAULT_CLIENT_APP_CONFIG);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSalonData();
  }, []);

  async function loadSalonData() {
    setLoading(true);
    try {
      const data = await fetchSalonPublicData(SALON_ID);
      setSalonName(data.salon.name);
      setServices(data.services.filter(s => s.active));
      setOperators(data.operators.filter(o => o.active));
      setAppConfig(data.clientAppConfig);
    } catch (e) {
      // Se offline o salone non configurato, mostra dati vuoti
      console.warn('loadSalonData error:', e);
    } finally {
      setLoading(false);
    }
  }

  function handleBook(service: Service) {
    router.push({
      pathname: '/book',
      params: {
        serviceId: service.id,
        serviceName: service.name,
        duration: String(service.duration),
        price: String(service.price),
        salonId: SALON_ID,
      },
    });
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.container} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={s.header}>
          <Text style={s.greeting}>Ciao{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(' ')[0]}` : ''} 👋</Text>
          <Text style={s.salonName}>{salonName}</Text>
        </View>

        {/* Banner */}
        <View style={[s.banner, { borderColor: appConfig.accentColor + '40' }]}>
          <Text style={[s.bannerTitle, { color: appConfig.accentColor }]}>{appConfig.welcomeMessage}</Text>
          {appConfig.aboutText ? (
            <Text style={s.bannerSub}>{appConfig.aboutText}</Text>
          ) : (
            <Text style={s.bannerSub}>Scegli il servizio e la fascia oraria che preferisci</Text>
          )}
        </View>

        {/* Servizi */}
        <Text style={s.sectionTitle}>Servizi disponibili</Text>

        {loading ? (
          <ActivityIndicator color={Colors.primary} style={{ marginTop: 40 }} />
        ) : services.length === 0 ? (
          <View style={s.empty}>
            <Text style={s.emptyText}>Nessun servizio disponibile al momento</Text>
          </View>
        ) : (
          <View style={s.grid}>
            {services.map(service => (
              <TouchableOpacity key={service.id} style={s.card} onPress={() => handleBook(service)} activeOpacity={0.8}>
                <View style={[s.cardDot, { backgroundColor: service.color ?? appConfig.accentColor }]} />
                <Text style={s.cardName}>{service.name}</Text>
                <Text style={s.cardDuration}>⏱ {service.duration} min</Text>
                {appConfig.showPrices && <Text style={s.cardPrice}>€ {service.price.toFixed(2)}</Text>}
                <View style={[s.bookBtn, { backgroundColor: appConfig.accentColor + '30', borderColor: appConfig.accentColor + '50' }]}>
                  <Text style={[s.bookBtnText, { color: appConfig.accentColor }]}>Prenota →</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { flex: 1, padding: 20 },
  header: { marginBottom: 20 },
  greeting: { fontSize: 16, color: Colors.muted },
  salonName: { fontSize: 26, fontWeight: '800', color: Colors.text, marginTop: 2 },
  banner: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 20,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  bannerTitle: { fontSize: 18, fontWeight: '700', color: Colors.primary, marginBottom: 4 },
  bannerSub: { fontSize: 13, color: Colors.muted },
  sectionTitle: { fontSize: 16, fontWeight: '700', color: Colors.text2, marginBottom: 14 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 14,
    padding: 16,
    width: '47%',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: 4,
  },
  cardDot: { width: 10, height: 10, borderRadius: 5, marginBottom: 4 },
  cardName: { fontSize: 14, fontWeight: '700', color: Colors.text },
  cardDuration: { fontSize: 12, color: Colors.muted },
  cardPrice: { fontSize: 15, fontWeight: '700', color: Colors.primary, marginTop: 4 },
  bookBtn: {
    backgroundColor: Colors.primary + '22',
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
    marginTop: 8,
  },
  bookBtnText: { color: Colors.primary, fontWeight: '600', fontSize: 12 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: Colors.muted, fontSize: 14 },
});
