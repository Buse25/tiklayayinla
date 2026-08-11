import { ScrollView, StyleSheet, Text } from 'react-native';
export default function Terms() { return <ScrollView contentContainerStyle={styles.content}><Text style={styles.title}>Kullanım Şartları</Text><Text style={styles.text}>Bu metin web uygulamasındaki güncel hukuki içerikle birlikte güncellenecektir.</Text></ScrollView>; }
const styles = StyleSheet.create({ content: { padding: 24 }, title: { fontSize: 26, fontWeight: '800' }, text: { fontSize: 15, lineHeight: 23, marginTop: 18 } });
