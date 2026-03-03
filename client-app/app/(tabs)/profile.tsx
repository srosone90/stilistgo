import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, TouchableOpacity, Alert, Linking, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/context/AuthContext';
import { fetchSalonPublicData, type ClientAppConfig, DEFAULT_CLIENT_APP_CONFIG } from '@/lib/api';

const SALON_ID = process.env.EXPO_PUBLIC_SALON_ID ?? '';

export default function ProfileScreen() {
  const { user, signOut } = useAuth();
  const [appConfig, setAppConfig] = useState<ClientAppConfig>(DEFAULT_CLIENT_APP_CONFIG);
  const [salonName, setSalonName] = useState('');

  useEffect(() => {
    if (!SALON_ID) return;
    fetchSalonPublicData(SALON_ID)
      .then(data => { setAppConfig(data.clientAppConfig); setSalonName(data.salon.name); })
      .catch(() => {});
  }, []);

  const name = user?.user_metadata?.full_name ?? 'Cliente';
  const phone = user?.user_metadata?.phone ?? '—';
  const email = user?.email ?? '—';

  function handleLogout() {
    Alert.alert('Esci', 'Vuoi uscire dall\'app?', [
      { text: 'Annulla', style: 'cancel' },
      { text: 'Esci', style: 'destructive', onPress: async () => { await signOut(); router.replace('/(auth)/login'); } },
    ]);
  }

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView contentContainerStyle={s.container}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>{name.charAt(0).toUpperCase()}</Text>
        </View>
        <Text style={s.name}>{name}</Text>
        <Text style={s.sub}>{email}</Text>

        <View style={s.infoBox}>
          <Row label="📞 Telefono" value={phone} />
          <Row label="📧 Email" value={email} />
        </View>

        {/* Sezione salone */}
        {(appConfig.contactPhone || appConfig.contactAddress || appConfig.instagramHandle || appConfig.facebookUrl || appConfig.aboutText) && (
          <>
            <Text style={s.sectionTitle}>{salonName || 'Il salone'}</Text>
            <View style={s.infoBox}>
              {appConfig.contactPhone ? (
                <TouchableOpacity onPress={() => Linking.openURL(`tel:${appConfig.contactPhone}`)}>
                  <Row label="📞 Telefono" value={appConfig.contactPhone} />
                </TouchableOpacity>
              ) : null}
              {appConfig.contactAddress ? (
                <Row label="📍 Indirizzo" value={appConfig.contactAddress} />
              ) : null}
              {appConfig.instagramHandle ? (
                <TouchableOpacity onPress={() => Linking.openURL(`https://instagram.com/${appConfig.instagramHandle}`)}>
                  <Row label="📷 Instagram" value={`@${appConfig.instagramHandle}`} />
                </TouchableOpacity>
              ) : null}
              {appConfig.facebookUrl ? (
                <TouchableOpacity onPress={() => Linking.openURL(appConfig.facebookUrl)}>
                  <Row label="📚 Facebook" value="Visita la pagina" />
                </TouchableOpacity>
              ) : null}
            </View>
            {appConfig.aboutText ? (
              <Text style={s.about}>{appConfig.aboutText}</Text>
            ) : null}
          </>
        )}

        <TouchableOpacity style={s.logoutBtn} onPress={handleLogout}>
          <Text style={s.logoutText}>Esci dall&apos;account</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <Text style={s.rowValue}>{value}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },
  container: { alignItems: 'center', padding: 28, paddingBottom: 40 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: Colors.primary,
    justifyContent: 'center', alignItems: 'center', marginBottom: 14,
  },
  avatarText: { fontSize: 32, fontWeight: '700', color: '#fff' },
  name: { fontSize: 22, fontWeight: '800', color: Colors.text },
  sub: { fontSize: 13, color: Colors.muted, marginTop: 2, marginBottom: 28 },
  sectionTitle: { fontSize: 14, fontWeight: '700', color: Colors.muted, marginBottom: 10, alignSelf: 'flex-start' },
  infoBox: {
    width: '100%', backgroundColor: Colors.bgCard,
    borderRadius: 14, borderWidth: 1, borderColor: Colors.border,
    overflow: 'hidden', marginBottom: 20,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: Colors.border,
  },
  rowLabel: { fontSize: 13, color: Colors.muted },
  rowValue: { fontSize: 13, color: Colors.text, fontWeight: '500', flex: 1, textAlign: 'right', marginLeft: 8 },
  about: { fontSize: 13, color: Colors.muted, textAlign: 'center', marginBottom: 20, lineHeight: 20 },
  logoutBtn: {
    borderWidth: 1, borderColor: Colors.error,
    borderRadius: 12, paddingVertical: 14, paddingHorizontal: 40,
    marginTop: 8,
  },
  logoutText: { color: Colors.error, fontWeight: '700', fontSize: 14 },
});
