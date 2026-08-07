import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAuth } from '@/context/auth-context';
import { Colors } from '@/constants/theme';

export default function LoginScreen() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit() {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return setError('Geçerli bir e-posta adresi girin.');
    if (password.length < 8) return setError('Şifre en az 8 karakter olmalıdır.');
    setLoading(true); setError('');
    try { await signIn(normalizedEmail, password); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Giriş işlemi tamamlanamadı.'); } finally { setLoading(false); }
  }

  return <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.root}><ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled"><View style={styles.brandMark}><Ionicons color="#FFFFFF" name="home" size={28} /></View><Text style={styles.brand}>tiklayayinla</Text><Text style={styles.kicker}>EMLAK YÖNETİM PANELİ</Text><View style={styles.card}><Text style={styles.title}>Tekrar hoş geldiniz</Text><Text style={styles.subtitle}>Hesabınıza giriş yaparak ilanlarınızı yönetin.</Text>{error ? <View style={styles.error}><Ionicons color={Colors.light.error} name="alert-circle-outline" size={18} /><Text style={styles.errorText}>{error}</Text></View> : null}<Text style={styles.label}>E-posta Adresi</Text><TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" onChangeText={setEmail} placeholder="ornek@email.com" placeholderTextColor={Colors.light.muted} style={styles.input} value={email} /><Text style={styles.label}>Şifre</Text><View style={styles.passwordWrap}><TextInput autoCapitalize="none" onChangeText={setPassword} placeholder="Şifrenizi girin" placeholderTextColor={Colors.light.muted} secureTextEntry={!showPassword} style={styles.passwordInput} value={password} /><Pressable accessibilityLabel={showPassword ? 'Şifreyi gizle' : 'Şifreyi göster'} hitSlop={12} onPress={() => setShowPassword((value) => !value)}><Ionicons color={Colors.light.secondary} name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={21} /></Pressable></View><Pressable disabled={loading} onPress={() => void submit()} style={({ pressed }) => [styles.button, pressed && styles.pressed, loading && styles.disabled]}>{loading ? <ActivityIndicator color="#FFFFFF" /> : <Text style={styles.buttonText}>Giriş Yap</Text>}</Pressable></View><Text style={styles.footer}>Güvenli ve kolay emlak yönetimi</Text></ScrollView></KeyboardAvoidingView>;
}

const styles = StyleSheet.create({ root: { flex: 1, backgroundColor: Colors.light.background }, content: { flexGrow: 1, justifyContent: 'center', padding: 24 }, brandMark: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center', width: 58, height: 58, borderRadius: 17, backgroundColor: Colors.light.primary, marginBottom: 14 }, brand: { color: Colors.light.primary, fontSize: 28, fontWeight: '800', textAlign: 'center' }, kicker: { color: Colors.light.secondary, fontSize: 10, fontWeight: '700', letterSpacing: 2, textAlign: 'center', marginTop: 5, marginBottom: 32 }, card: { backgroundColor: Colors.light.card, borderColor: Colors.light.border, borderRadius: 22, borderWidth: 1, padding: 22, shadowColor: '#0F172A', shadowOpacity: 0.06, shadowRadius: 18, shadowOffset: { width: 0, height: 6 }, elevation: 2 }, title: { color: Colors.light.text, fontSize: 24, fontWeight: '800' }, subtitle: { color: Colors.light.secondary, fontSize: 14, lineHeight: 21, marginTop: 8, marginBottom: 22 }, label: { color: Colors.light.secondary, fontSize: 12, fontWeight: '700', marginBottom: 7, marginTop: 15 }, input: { backgroundColor: '#F2F4F5', borderColor: Colors.light.border, borderRadius: 12, borderWidth: 1, color: Colors.light.text, fontSize: 15, paddingHorizontal: 15, paddingVertical: 14 }, passwordWrap: { alignItems: 'center', backgroundColor: '#F2F4F5', borderColor: Colors.light.border, borderRadius: 12, borderWidth: 1, flexDirection: 'row', paddingRight: 15 }, passwordInput: { color: Colors.light.text, flex: 1, fontSize: 15, paddingHorizontal: 15, paddingVertical: 14 }, button: { alignItems: 'center', backgroundColor: Colors.light.primary, borderRadius: 14, justifyContent: 'center', marginTop: 26, minHeight: 54 }, buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '800' }, pressed: { opacity: 0.86 }, disabled: { opacity: 0.65 }, error: { alignItems: 'center', backgroundColor: '#FFF0EE', borderRadius: 12, flexDirection: 'row', gap: 8, padding: 12 }, errorText: { color: Colors.light.error, flex: 1, fontSize: 13 }, footer: { color: Colors.light.muted, fontSize: 12, marginTop: 26, textAlign: 'center' } });
