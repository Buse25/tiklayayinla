import { Tabs, Redirect } from 'expo-router';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors } from '@/constants/theme';
import { useAuth } from '@/context/auth-context';
import { isAdmin } from '@/lib/api';

export default function AdminLayout() {
  const { ready, user } = useAuth();
  if (!ready) return <View style={styles.loading}><ActivityIndicator color={Colors.light.primary} /></View>;
  if (!user) return <Redirect href="/login" />;
  if (!isAdmin(user)) return <Redirect href="/(tabs)" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: Colors.light.primary, tabBarStyle: { height: 70, paddingTop: 8, paddingBottom: 10 } }}>
    <Tabs.Screen name="index" options={{ title: 'Ana Sayfa', tabBarIcon: ({ color, size }) => <Ionicons name="grid-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="users" options={{ title: 'Kullanıcılar', tabBarIcon: ({ color, size }) => <Ionicons name="people-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="applications" options={{ title: 'Başvurular', tabBarIcon: ({ color, size }) => <Ionicons name="business-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="listings" options={{ title: 'İlanlar', tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="profile" options={{ title: 'Profil', tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" color={color} size={size} /> }} />
  </Tabs>;
}

const styles = StyleSheet.create({ loading: { flex: 1, alignItems: 'center', justifyContent: 'center' } });
