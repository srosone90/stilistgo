import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert, ScrollView,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

export default function Register() {
  const { signUp } = useAuth();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name || !phone || !email || !password) {
      Alert.alert('Attenzione', 'Compila tutti i campi');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Attenzione', 'La password deve essere di almeno 6 caratteri');
      return;
    }
    setLoading(true);
    const error = await signUp(email.trim().toLowerCase(), password, name.trim(), phone.trim());
    setLoading(false);
    if (error) {
      Alert.alert('Errore registrazione', error);
    } else {
      Alert.alert('✅ Registrazione completata!', 'Controlla la tua email per confermare l\'account, poi accedi.', [
        { text: 'Vai al login', onPress: () => router.replace('/(auth)/login') },
      ]);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: Colors.bg }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Text style={s.logo}>✂️</Text>
          <Text style={s.title}>Crea account</Text>
          <Text style={s.subtitle}>Registrati per prenotare in pochi tap</Text>
        </View>

        <View style={s.form}>
          <TextInput style={s.input} placeholder="Nome e cognome" placeholderTextColor={Colors.muted} value={name} onChangeText={setName} />
          <TextInput style={s.input} placeholder="Telefono" placeholderTextColor={Colors.muted} value={phone} onChangeText={setPhone} keyboardType="phone-pad" />
          <TextInput style={s.input} placeholder="Email" placeholderTextColor={Colors.muted} value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" />
          <TextInput style={s.input} placeholder="Password (minimo 6 caratteri)" placeholderTextColor={Colors.muted} value={password} onChangeText={setPassword} secureTextEntry />

          <TouchableOpacity style={s.btn} onPress={handleRegister} disabled={loading}>
            {loading
              ? <ActivityIndicator color="#fff" />
              : <Text style={s.btnText}>Crea account</Text>}
          </TouchableOpacity>

          <View style={s.row}>
            <Text style={s.rowText}>Hai già un account? </Text>
            <Link href="/(auth)/login">
              <Text style={s.link}>Accedi</Text>
            </Link>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { padding: 24, paddingTop: 60 },
  header: { alignItems: 'center', marginBottom: 36 },
  logo: { fontSize: 48, marginBottom: 12 },
  title: { fontSize: 24, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 13, color: Colors.muted },
  form: { gap: 14 },
  input: {
    backgroundColor: Colors.bgInput,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: 12,
    padding: 14,
    color: Colors.text,
    fontSize: 15,
  },
  btn: { backgroundColor: Colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 4 },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  rowText: { color: Colors.muted, fontSize: 13 },
  link: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
