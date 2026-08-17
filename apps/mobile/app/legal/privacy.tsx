import { ScrollView, StyleSheet, Text } from 'react-native';
import { BackButton } from '../../components/back-button';
export default function Privacy() { return <ScrollView contentContainerStyle={styles.content}><BackButton /><Text style={styles.title}>Gizlilik ve KVKK</Text><Text style={styles.text}>Bu metin web uygulamasındaki güncel hukuki içerikle birlikte güncellenecektir.</Text></ScrollView>; }
const styles = StyleSheet.create({ content: { padding: 24 }, title: { fontSize: 26, fontWeight: '800' }, text: { fontSize: 15, lineHeight: 23, marginTop: 18 } });
