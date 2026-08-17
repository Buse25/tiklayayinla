import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/theme';
import { WEB_URL } from '@/lib/api';
import { BackButton } from '../components/back-button';

export default function PlansScreen() {
  async function openPlans() { await Linking.openURL(`${WEB_URL}/plans`); }
  return <View style={styles.root}><BackButton /><Text style={styles.title}>Üyelik paketleri</Text><Text style={styles.subtitle}>Paket seçimi ve ödeme işlemleri güvenli web panelinden yapılır.</Text><View style={styles.card}><Text style={styles.cardTitle}>Web panelinden devam edin</Text><Text style={styles.text}>Paketleri karşılaştırmak, paket seçmek ve ödeme adımına geçmek için web panelini açın.</Text><Pressable onPress={() => void openPlans()} style={styles.button}><Text style={styles.buttonText}>Paketleri webde aç</Text></Pressable></View></View>;
}
const styles = StyleSheet.create({ root: { backgroundColor: Colors.light.background, flex: 1, padding: 20 }, title: { color: Colors.light.text, fontSize: 28, fontWeight: '800', marginTop: 8 }, subtitle: { color: Colors.light.secondary, lineHeight: 21, marginTop: 8 }, card: { backgroundColor: Colors.light.card, borderColor: Colors.light.border, borderRadius: 18, borderWidth: 1, marginTop: 28, padding: 20 }, cardTitle: { color: Colors.light.text, fontSize: 18, fontWeight: '800' }, text: { color: Colors.light.secondary, lineHeight: 21, marginTop: 8 }, button: { alignItems: 'center', backgroundColor: Colors.light.primary, borderRadius: 13, marginTop: 20, padding: 15 }, buttonText: { color: '#FFF', fontWeight: '800' } });
