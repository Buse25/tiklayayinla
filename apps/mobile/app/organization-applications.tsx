import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { BackButton } from '../components/back-button';

type Profile = {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  role: string;
  organizationId?: string | null;
  organizationName?: string | null;
  organizationType?: string | null;
  membershipStatus?: string | null;
  organizationApplicationStatus?: string | null;
};

export default function OrganizationApplicationsScreen() {
  const { request } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [appRes, meRes] = await Promise.all([
        request('organizations/applications'),
        request('users/me'),
      ]);

      if (appRes.ok) setItems(await appRes.json());
      if (meRes.ok) setProfile(await meRes.json());
    } catch (e) {
      setError('Veriler yüklenirken bir hata oluştu.');
    } finally {
      setLoading(false);
    }
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const hasActiveOrg = profile?.membershipStatus === 'ACTIVE';

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <BackButton />
      <Text style={styles.title}>Kurumsal Hesap</Text>

      {loading ? (
        <ActivityIndicator color={Colors.light.primary} />
      ) : hasActiveOrg ? (
        <View style={styles.card}>
          <Text style={styles.activeBadge}>AKTİF KURUMSAL HESAP</Text>
          <Text style={styles.name}>{profile?.organizationName || 'Kurum Adı Belirtilmemiş'}</Text>
          <Text style={styles.status}>Durum: Aktif Üye</Text>
          <Text style={styles.muted}>
            Sektör: {profile?.organizationType === 'REAL_ESTATE_AGENCY' ? 'Emlak Ofisi' : 'Oto Galeri'}
          </Text>
          <Text style={styles.infoText}>
            Kurumsal hesabınız aktiftir. Portallara ilan gönderebilir ve kurumsal özelliklerden faydalanabilirsiniz.
          </Text>
        </View>
      ) : items.length ? (
        items.map((item) => (
          <View key={item.id} style={styles.card}>
            <Text style={styles.name}>{item.organizationName}</Text>
            <Text style={styles.status}>
              Başvuru Durumu: {
                item.status === 'PENDING' ? 'İncelemede' :
                item.status === 'APPROVED' ? 'Onaylandı' :
                item.status === 'REJECTED' ? 'Reddedildi' : item.status
              }
            </Text>
            <Text style={styles.muted}>{item.city}, {item.district}</Text>
            {item.rejectionReason ? (
              <Text style={styles.errorText}>{item.rejectionReason}</Text>
            ) : null}
          </View>
        ))
      ) : (
        <View style={styles.infoCard}>
          <Text style={styles.infoTitle}>Kurumsal Başvuru Bulunmuyor</Text>
          <Text style={styles.infoDescription}>
            Kurumsal hesap başvuruları web paneli üzerinden yapılmaktadır. Kurumsal hesaba geçiş yapmak için lütfen web tarayıcınızdan sisteme giriş yaparak başvurunuzu iletiniz.
          </Text>
        </View>
      )}

      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: { backgroundColor: Colors.light.background, flexGrow: 1, padding: 20, paddingBottom: 40 },
  title: { color: Colors.light.text, fontSize: 28, fontWeight: '800', marginBottom: 20 },
  card: { backgroundColor: Colors.light.card, borderColor: Colors.light.border, borderRadius: 16, borderWidth: 1, marginBottom: 12, padding: 16 },
  activeBadge: { color: Colors.light.primary, fontSize: 11, fontWeight: '800', letterSpacing: 1, marginBottom: 8 },
  name: { color: Colors.light.text, fontSize: 18, fontWeight: '800' },
  status: { color: Colors.light.primary, fontWeight: '800', marginTop: 8 },
  muted: { color: Colors.light.muted, lineHeight: 21, marginTop: 5 },
  infoText: { color: Colors.light.secondary, fontSize: 13, marginTop: 12, lineHeight: 18 },
  infoCard: {
    backgroundColor: Colors.light.soft,
    borderColor: Colors.light.border,
    borderRadius: 16,
    borderWidth: 1,
    padding: 20,
    marginTop: 10,
  },
  infoTitle: {
    color: Colors.light.primary,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 8,
  },
  infoDescription: {
    color: Colors.light.text,
    fontSize: 14,
    lineHeight: 22,
  },
  errorText: { backgroundColor: '#FFF0EE', borderRadius: 12, color: Colors.light.error, marginTop: 10, padding: 12 }
});
