import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';

type Summary = { total: number; active: number; suspended: number; draft: number; deleted: number; applicationPending: number; applicationApproved: number; applicationRejected: number; applicationSuspended: number };

export default function AdminHome() {
  const { request, user } = useAuth(); const [summary, setSummary] = useState<Summary | null>(null); const [loading, setLoading] = useState(true); const [refreshing, setRefreshing] = useState(false); const [error, setError] = useState('');
  const load = useCallback(async (refresh = false) => { refresh ? setRefreshing(true) : setLoading(true); try { const response = await request('dashboard/admin-summary'); if (!response.ok) throw new Error('Admin özeti alınamadı.'); setSummary(await response.json()); setError(''); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Veriler alınamadı.'); } finally { setLoading(false); setRefreshing(false); } }, [request]);
  useEffect(() => { void load(); }, [load]);
  if (loading) return <View style={styles.center}><ActivityIndicator color={Colors.light.primary} /></View>;
  return <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void load(true)} />}><Text style={styles.eyebrow}>YÖNETİM</Text><Text style={styles.title}>Merhaba, {user?.firstName}</Text><Text style={styles.subtitle}>Yalnızca ADMIN hesabına açık yönetim özeti.</Text>{error ? <Text style={styles.error}>{error}</Text> : null}<View style={styles.grid}>{[['Toplam ilan', summary?.total], ['Aktif ilan', summary?.active], ['Taslak ilan', summary?.draft], ['Bekleyen başvuru', summary?.applicationPending]].map(([label, value]) => <View key={String(label)} style={styles.card}><Text style={styles.value}>{value ?? '—'}</Text><Text style={styles.label}>{label}</Text></View>)}</View></ScrollView>;
}

const styles = StyleSheet.create({ content: { padding: 20, paddingTop: 32 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center' }, eyebrow: { color: Colors.light.primary, fontWeight: '800', letterSpacing: 1.2 }, title: { color: Colors.light.text, fontSize: 26, fontWeight: '800', marginTop: 8 }, subtitle: { color: Colors.light.secondary, marginTop: 6 }, error: { color: Colors.light.error, marginTop: 20 }, grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 28 }, card: { backgroundColor: Colors.light.card, borderColor: Colors.light.border, borderRadius: 16, borderWidth: 1, padding: 16, width: '47%' }, value: { color: Colors.light.primary, fontSize: 26, fontWeight: '800' }, label: { color: Colors.light.secondary, fontSize: 12, marginTop: 6 } });
