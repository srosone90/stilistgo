import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  KeyboardAvoidingView, Platform, ActivityIndicator, Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { useAuth } from '@/context/AuthContext';
import { Colors } from '@/constants/Colors';

export default function Login() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email || !password) { Alert.alert('Attenzione', 'Inserisci email e password'); return; }
    setLoading(true);
    const error = await signIn(email.trim().toLowerCase(), password);
    setLoading(false);
    if (error) {
      Alert.alert('Errore di accesso', error === 'Invalid login credentials'
        ? 'Email o password non corretti'
        : error);
    } else {
      router.replace('/(tabs)');
    }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={s.header}>
        <Text style={s.logo}>✂️</Text>
        <Text style={s.title}>Le Ribelle Salon</Text>
        <Text style={s.subtitle}>Accedi per prenotare</Text>
      </View>

      <View style={s.form}>
        <TextInput
          style={s.input}
          placeholder="Email"
          placeholderTextColor={Colors.muted}
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          placeholderTextColor={Colors.muted}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <TouchableOpacity style={s.btn} onPress={handleLogin} disabled={loading}>
          {loading
            ? <ActivityIndicator color="#fff" />
            : <Text style={s.btnText}>Accedi</Text>}
        </TouchableOpacity>

        <View style={s.row}>
          <Text style={s.rowText}>Non hai un account? </Text>
          <Link href="/(auth)/register">
            <Text style={s.link}>Registrati</Text>
          </Link>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.bg, justifyContent: 'center', padding: 24 },
  header: { alignItems: 'center', marginBottom: 40 },
  logo: { fontSize: 56, marginBottom: 12 },
  title: { fontSize: 26, fontWeight: '700', color: Colors.text, marginBottom: 4 },
  subtitle: { fontSize: 14, color: Colors.muted },
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
  btn: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    marginTop: 4,
  },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  row: { flexDirection: 'row', justifyContent: 'center', marginTop: 8 },
  rowText: { color: Colors.muted, fontSize: 13 },
  link: { color: Colors.primary, fontSize: 13, fontWeight: '600' },
});
